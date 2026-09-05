import {
  CUSTOMER_STORY_SHOWCASE_PROJECTION,
  SHOWCASE_TRAINER_SLUG,
  TRAINER_SHOWCASE_PROJECTION,
  sanitizeCustomerStory,
  sanitizeTrainer,
} from "./showcaseDataSync.contract.js";
import { fingerprintDocument } from "./singleAccountSync.contract.js";
import { assertProductionSourceReadOnly } from "./singleAccountSync.runtime.js";

export { assertProductionSourceReadOnly };

const SHOWCASE_COLLECTIONS = Object.freeze([
  { name: "trainers", sanitize: sanitizeTrainer },
  { name: "customerstories", sanitize: sanitizeCustomerStory },
]);
const STAGING_DATABASE = "htcoaching_staging";
const STAGING_ALLOWED_ROLES = Object.freeze([
  { role: "stagingAccountSyncReadWrite", db: "admin" },
  { role: "readWrite", db: STAGING_DATABASE },
]);
const STAGING_REQUIRED_ACTIONS = Object.freeze([
  "find",
  "insert",
  "update",
  "createIndex",
  "listIndexes",
]);
const SHOWCASE_SLUG_INDEXES = Object.freeze(
  SHOWCASE_COLLECTIONS.map(({ name }) => ({
    collection: name,
    name: "slug_1",
  })),
);

const makeSyncError = (code, metadata = {}) =>
  Object.assign(new Error(code), { code, ...metadata });

const sameIdentity = (left, right) => String(left || "") === String(right || "");

export const assertStagingTargetWriteScope = async (targetDb) => {
  let status;
  try {
    status = await targetDb.command({ connectionStatus: 1, showPrivileges: true });
  } catch {
    throw makeSyncError("SHOWCASE_SYNC_STAGING_TARGET_ROLE_UNVERIFIED");
  }

  const roles = status?.authInfo?.authenticatedUserRoles || [];
  const hasOneAllowedRole =
    roles.length === 1 &&
    STAGING_ALLOWED_ROLES.some(
      (allowed) =>
        roles[0]?.role === allowed.role && roles[0]?.db === allowed.db,
    );
  if (!hasOneAllowedRole) {
    throw makeSyncError("SHOWCASE_SYNC_STAGING_TARGET_ROLE_REQUIRED");
  }

  const privileges = status?.authInfo?.authenticatedUserPrivileges || [];
  const staysInsideStaging =
    privileges.length > 0 &&
    privileges.every(
      (privilege) =>
        privilege?.resource?.db === STAGING_DATABASE &&
        privilege.resource.cluster !== true &&
        privilege.resource.anyResource !== true,
    );
  if (!staysInsideStaging) {
    throw makeSyncError(
      "SHOWCASE_SYNC_STAGING_TARGET_PRIVILEGE_SCOPE_REJECTED",
    );
  }

  const actions = new Set(
    privileges.flatMap((privilege) =>
      Array.isArray(privilege?.actions) ? privilege.actions : [],
    ),
  );
  if (!STAGING_REQUIRED_ACTIONS.every((action) => actions.has(action))) {
    throw makeSyncError("SHOWCASE_SYNC_STAGING_TARGET_CAPABILITY_REQUIRED");
  }
  return { verified: true };
};

const assertSafeShowcaseGraph = (graph) => {
  const trainers = Array.isArray(graph?.trainers)
    ? graph.trainers.map(sanitizeTrainer)
    : [];
  const customerstories = Array.isArray(graph?.customerstories)
    ? graph.customerstories.map(sanitizeCustomerStory)
    : [];
  if (
    trainers.length !== 1 ||
    trainers[0]?.slug !== SHOWCASE_TRAINER_SLUG ||
    trainers[0]?.status !== "published" ||
    !trainers[0]?._id
  ) {
    throw makeSyncError("SHOWCASE_SYNC_EXACT_SOURCE_TRAINER_REQUIRED");
  }

  const trainer = trainers[0];
  const ids = new Set();
  const slugs = new Set();
  for (const story of customerstories) {
    const storyId = String(story?._id || "");
    const storySlug = String(story?.slug || "");
    const isDirectStory = sameIdentity(story?.trainerId, trainer._id);
    const isLegacyHeadCoachStory =
      trainer.isHeadCoach &&
      (!Object.hasOwn(story, "trainerId") || story.trainerId === null);
    if (
      !storyId ||
      !storySlug ||
      story.status !== "published" ||
      (!isDirectStory && !isLegacyHeadCoachStory) ||
      ids.has(storyId) ||
      slugs.has(storySlug)
    ) {
      throw makeSyncError("SHOWCASE_SYNC_SOURCE_STORY_IDENTITY_INVALID");
    }
    ids.add(storyId);
    slugs.add(storySlug);
  }

  return { trainers, customerstories };
};

export const listSourceShowcaseGraph = async (sourceDb) => {
  const sourceTrainers = await sourceDb
    .collection("trainers")
    .find({ slug: SHOWCASE_TRAINER_SLUG, status: "published" })
    .project(TRAINER_SHOWCASE_PROJECTION)
    .limit(2)
    .toArray();
  if (sourceTrainers.length !== 1) {
    throw makeSyncError("SHOWCASE_SYNC_EXACT_SOURCE_TRAINER_REQUIRED");
  }

  const sourceTrainer = sourceTrainers[0];
  const storyQuery = { status: "published" };
  if (sourceTrainer.isHeadCoach) {
    storyQuery.$or = [
      { trainerId: sourceTrainer._id },
      { trainerId: null },
      { trainerId: { $exists: false } },
    ];
  } else {
    storyQuery.trainerId = sourceTrainer._id;
  }

  const sourceStories = await sourceDb
    .collection("customerstories")
    .find(storyQuery)
    .project(CUSTOMER_STORY_SHOWCASE_PROJECTION)
    .sort({ _id: 1 })
    .toArray();
  const graph = assertSafeShowcaseGraph({
    trainers: [sourceTrainer],
    customerstories: sourceStories,
  });
  return { trainer: graph.trainers[0], graph };
};

export const showcaseGraphCounts = (graph) => ({
  trainers: Array.isArray(graph?.trainers) ? graph.trainers.length : 0,
  customerstories: Array.isArray(graph?.customerstories)
    ? graph.customerstories.length
    : 0,
});

export const showcaseGraphFingerprint = (graph) => {
  const safeGraph = assertSafeShowcaseGraph(graph);
  return fingerprintDocument(
    Object.fromEntries(
      SHOWCASE_COLLECTIONS.map(({ name }) => [
        name,
        safeGraph[name]
          .map((document) => ({
            id: String(document._id),
            fingerprint: fingerprintDocument(document),
          }))
          .sort((left, right) => left.id.localeCompare(right.id)),
      ]),
    ),
  );
};

const preflightCollectionSlugs = async (
  targetDb,
  collectionName,
  documents,
  { session } = {},
) => {
  if (documents.length === 0) return;
  const incomingById = new Map(
    documents.map((document) => [String(document._id), document]),
  );
  const incomingBySlug = new Map(
    documents.map((document) => [String(document.slug), document]),
  );
  const targetMatches = await targetDb
    .collection(collectionName)
    .find(
      {
        $or: [
          { _id: { $in: documents.map((document) => document._id) } },
          { slug: { $in: documents.map((document) => document.slug) } },
        ],
      },
      session ? { session } : undefined,
    )
    .toArray();

  for (const targetDocument of targetMatches) {
    const expectedById = incomingById.get(String(targetDocument._id));
    const expectedBySlug = incomingBySlug.get(String(targetDocument.slug));
    if (
      !expectedById ||
      !expectedBySlug ||
      expectedById.slug !== targetDocument.slug ||
      !sameIdentity(expectedBySlug._id, targetDocument._id)
    ) {
      throw makeSyncError("SHOWCASE_SYNC_TARGET_SLUG_CONFLICT", {
        collection: collectionName,
      });
    }
  }
};

export const preflightTargetShowcase = async (
  targetDb,
  graph,
  { session } = {},
) => {
  const safeGraph = assertSafeShowcaseGraph(graph);
  for (const { name } of SHOWCASE_COLLECTIONS) {
    await preflightCollectionSlugs(targetDb, name, safeGraph[name], { session });
  }
  return { verified: true };
};

const isNamespaceMissing = (error) =>
  error?.code === 26 || error?.codeName === "NamespaceNotFound";

const listCollectionIndexes = async (targetDb, collectionName) => {
  try {
    return await targetDb.collection(collectionName).listIndexes().toArray();
  } catch (error) {
    if (isNamespaceMissing(error)) return [];
    throw makeSyncError("SHOWCASE_SYNC_TARGET_INDEX_VERIFY_FAILED", {
      collection: collectionName,
      indexFields: ["slug"],
    });
  }
};

const isUniqueSlugIndex = (index) => {
  const keys = Object.keys(index?.key || {});
  const hasGlobalScope =
    index?.sparse !== true &&
    !Object.hasOwn(index || {}, "partialFilterExpression");
  const hasCompatibleCollation =
    !index?.collation || index.collation.locale === "simple";
  return (
    keys.length === 1 &&
    keys[0] === "slug" &&
    index.key.slug === 1 &&
    index.unique === true &&
    hasGlobalScope &&
    hasCompatibleCollation &&
    index.hidden !== true
  );
};

const findMissingSlugIndexes = async (targetDb) => {
  const planned = [];
  for (const policy of SHOWCASE_SLUG_INDEXES) {
    const indexes = await listCollectionIndexes(targetDb, policy.collection);
    if (!indexes.some(isUniqueSlugIndex)) planned.push(policy);
  }
  return planned;
};

const assertNoDuplicateTargetSlugs = async (targetDb, collectionName) => {
  try {
    const duplicates = await targetDb
      .collection(collectionName)
      .aggregate([
        { $group: { _id: "$slug", count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
        { $limit: 1 },
        { $project: { _id: 0, duplicate: { $literal: true } } },
      ])
      .toArray();
    if (duplicates.length > 0) {
      throw makeSyncError("SHOWCASE_SYNC_TARGET_INDEX_CREATE_FAILED", {
        collection: collectionName,
        indexFields: ["slug"],
      });
    }
  } catch (error) {
    if (isNamespaceMissing(error)) return;
    if (error?.code === "SHOWCASE_SYNC_TARGET_INDEX_CREATE_FAILED") throw error;
    throw makeSyncError("SHOWCASE_SYNC_TARGET_INDEX_VERIFY_FAILED", {
      collection: collectionName,
      indexFields: ["slug"],
    });
  }
};

export const ensureTargetShowcaseIndexes = async ({
  targetDb,
  apply = false,
}) => {
  const planned = await findMissingSlugIndexes(targetDb);
  if (!apply || planned.length === 0) {
    return {
      verified: planned.length === 0,
      planned,
      created: 0,
    };
  }

  for (const { collection } of planned) {
    await assertNoDuplicateTargetSlugs(targetDb, collection);
  }

  let created = 0;
  for (const policy of planned) {
    try {
      await targetDb.collection(policy.collection).createIndex(
        { slug: 1 },
        { unique: true, name: policy.name },
      );
      created += 1;
    } catch {
      throw makeSyncError("SHOWCASE_SYNC_TARGET_INDEX_CREATE_FAILED", {
        collection: policy.collection,
        indexFields: ["slug"],
      });
    }
  }

  const missingAfterApply = await findMissingSlugIndexes(targetDb);
  if (missingAfterApply.length > 0) {
    throw makeSyncError("SHOWCASE_SYNC_TARGET_INDEX_VERIFY_FAILED", {
      collection: missingAfterApply[0].collection,
      indexFields: ["slug"],
    });
  }
  return { verified: true, planned, created };
};

export const syncShowcaseGraphToTarget = async ({
  targetDb,
  targetClient,
  graph,
  apply = false,
}) => {
  const safeGraph = assertSafeShowcaseGraph(graph);
  if (!apply) return { written: 0 };
  if (!targetClient?.startSession) {
    throw makeSyncError("SHOWCASE_SYNC_TARGET_TRANSACTION_REQUIRED");
  }

  const session = targetClient.startSession();
  try {
    return await session.withTransaction(
      async () => {
        let written = 0;
        await preflightTargetShowcase(targetDb, safeGraph, { session });
        for (const { name } of SHOWCASE_COLLECTIONS) {
          for (const sourceDocument of safeGraph[name]) {
            try {
              await targetDb
                .collection(name)
                .replaceOne({ _id: sourceDocument._id }, sourceDocument, {
                  upsert: true,
                  session,
                });
            } catch (error) {
              throw makeSyncError(
                error?.code === 11000
                  ? "SHOWCASE_SYNC_TARGET_UNIQUE_CONFLICT"
                  : "SHOWCASE_SYNC_TARGET_WRITE_FAILED",
                {
                  collection: name,
                  indexFields: Object.keys(error?.keyPattern || {}),
                },
              );
            }
            written += 1;

            const targetDocument = await targetDb
              .collection(name)
              .findOne({ _id: sourceDocument._id }, { session });
            if (
              !targetDocument ||
              fingerprintDocument(targetDocument) !== fingerprintDocument(sourceDocument)
            ) {
              throw makeSyncError("SHOWCASE_SYNC_TARGET_FINGERPRINT_MISMATCH", {
                collection: name,
              });
            }
          }
        }
        return { written };
      },
      {
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
      },
    );
  } finally {
    await session.endSession();
  }
};
