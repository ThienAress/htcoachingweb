import mongodb from "mongodb";

import {
  EMBEDDING_VERSION,
} from "../services/ai/embeddingProfile.js";
import {
  MAX_KB_DOCUMENTS,
  PRODUCTION_KB_DATABASE,
  fingerprint,
  prepareKnowledgeEntry,
  summarizeSkips,
  syncError,
} from "./stagingKnowledgeBaseSync.contract.js";

const SOURCE_PROJECTION = {
  _id: 1,
  question: 1,
  normalizedQuestion: 1,
  answer: 1,
  category: 1,
  tags: 1,
  variants: 1,
  embedding: 1,
  embeddingStatus: 1,
  embeddingVersion: 1,
  embeddingError: 1,
  embeddingUpdatedAt: 1,
  sources: 1,
  evidenceLevel: 1,
  reviewStatus: 1,
  reviewedBy: 1,
  reviewedAt: 1,
  reviewDueAt: 1,
  freshnessClass: 1,
  revision: 1,
  source: 1,
  status: 1,
  updatedAt: 1,
};

const TARGET_PROJECTION = {
  _id: 1,
  normalizedQuestion: 1,
  question: 1,
  answer: 1,
  category: 1,
  tags: 1,
  variants: 1,
  variantCount: 1,
  embedding: 1,
  embeddingStatus: 1,
  embeddingVersion: 1,
  embeddingError: 1,
  embeddingUpdatedAt: 1,
  sources: 1,
  evidenceLevel: 1,
  reviewStatus: 1,
  reviewedAt: 1,
  reviewDueAt: 1,
  freshnessClass: 1,
  revision: 1,
  source: 1,
  status: 1,
  usageCount: 1,
  lastUsedAt: 1,
  reviewedBy: 1,
  createdBy: 1,
};

const sourceWriteActions = new Set([
  "bypassDocumentValidation",
  "collMod",
  "convertToCapped",
  "createCollection",
  "createIndex",
  "dropCollection",
  "dropIndex",
  "insert",
  "remove",
  "renameCollectionSameDB",
  "update",
]);

export const assertProductionKnowledgeSourceReadOnly = async (sourceDb) => {
  let status;
  try {
    status = await sourceDb.command({ connectionStatus: 1, showPrivileges: true });
  } catch {
    throw syncError("KB_SYNC_SOURCE_ROLE_UNVERIFIED");
  }
  const roles = status?.authInfo?.authenticatedUserRoles || [];
  if (
    roles.length !== 1 ||
    roles[0]?.role !== "read" ||
    roles[0]?.db !== PRODUCTION_KB_DATABASE
  ) {
    throw syncError("KB_SYNC_SOURCE_READ_ONLY_ROLE_REQUIRED");
  }
  const privileges = status?.authInfo?.authenticatedUserPrivileges || [];
  if (
    privileges.some((privilege) =>
      (privilege?.actions || []).some((action) => sourceWriteActions.has(action)),
    )
  ) {
    throw syncError("KB_SYNC_SOURCE_WRITE_PRIVILEGE_REJECTED");
  }
  return { verified: true };
};

const loadEntries = async (db, projection, { session } = {}) => {
  const entries = await db
    .collection("knowledgeentries")
    .find({}, { projection, ...(session ? { session } : {}) })
    .sort({ _id: 1 })
    .limit(MAX_KB_DOCUMENTS + 1)
    .toArray();
  if (entries.length > MAX_KB_DOCUMENTS) {
    throw syncError("KB_SYNC_DOCUMENT_LIMIT_EXCEEDED");
  }
  return entries;
};

export const loadProductionKnowledgeEntries = (sourceDb) =>
  loadEntries(sourceDb, SOURCE_PROJECTION);

export const loadTargetKnowledgeEntries = (targetDb, options) =>
  loadEntries(targetDb, TARGET_PROJECTION, options);

export const resolveStagingReviewer = async (targetDb, email) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) throw syncError("KB_SYNC_REVIEWER_EMAIL_REQUIRED");
  const users = await targetDb
    .collection("users")
    .find({ email: normalizedEmail }, { projection: { _id: 1, email: 1, role: 1 } })
    .limit(2)
    .toArray();
  if (users.length !== 1 || users[0].role !== "admin") {
    throw syncError("KB_SYNC_STAGING_ADMIN_REQUIRED");
  }
  return users[0]._id;
};

const compareCandidates = (left, right) => {
  const leftDate = new Date(left?.updatedAt || 0).getTime();
  const rightDate = new Date(right?.updatedAt || 0).getTime();
  if (leftDate !== rightDate) return rightDate - leftDate;
  return String(left?._id).localeCompare(String(right?._id));
};

const chooseSourceEntries = (entries) => {
  const byQuestion = new Map();
  const duplicateSourceIds = [];
  for (const entry of entries) {
    const key = String(entry?.normalizedQuestion || "").trim();
    if (!key) continue;
    const current = byQuestion.get(key);
    if (!current) {
      byQuestion.set(key, entry);
      continue;
    }
    const [winner, loser] = [current, entry].sort(compareCandidates);
    byQuestion.set(key, winner);
    duplicateSourceIds.push(String(loser._id));
  }
  return {
    entries: [...byQuestion.values()].sort((left, right) =>
      String(left.normalizedQuestion).localeCompare(String(right.normalizedQuestion)),
    ),
    duplicateSourceIds,
  };
};

const comparableTarget = (entry) => {
  if (!entry) return null;
  const {
    _id,
    ...value
  } = entry;
  return value;
};

export const buildKnowledgeSyncPlan = ({
  sourceEntries,
  targetEntries,
  reviewerId,
  now = new Date(),
} = {}) => {
  const prepared = [];
  const skips = [];
  for (const entry of sourceEntries || []) {
    const result = prepareKnowledgeEntry(entry, { reviewerId, now });
    if (result.skip) skips.push(result.skip);
    else prepared.push(result);
  }
  const selected = chooseSourceEntries(prepared.map((item) => ({
    ...item.value,
    _id: item.sourceId,
    sourceId: item.sourceId,
    updatedAt: item.sourceUpdatedAt,
    sourceEmbeddingVersion: item.sourceEmbeddingVersion,
    ready: item.ready,
  })));
  const preparedBySourceId = new Map(
    prepared.map((item) => [item.sourceId, item]),
  );
  const targetByQuestion = new Map(
    (targetEntries || []).map((entry) => [entry.normalizedQuestion, entry]),
  );
  const operations = [];
  for (const selectedEntry of selected.entries) {
    const item = preparedBySourceId.get(selectedEntry.sourceId);
    const target = targetByQuestion.get(selectedEntry.normalizedQuestion) || null;
    const expected = item.value;
    const expectedFingerprint = fingerprint(expected);
    const targetFingerprint = target ? fingerprint(comparableTarget(target)) : null;
    operations.push({
      type: target ? "update" : "insert",
      normalizedQuestion: expected.normalizedQuestion,
      sourceId: item.sourceId,
      sourceEmbeddingVersion: item.sourceEmbeddingVersion,
      targetId: target?._id || null,
      expectedFingerprint,
      targetFingerprint,
      update: expected,
    });
  }
  const changed = operations.filter((operation) =>
    operation.targetFingerprint !== operation.expectedFingerprint,
  );
  const unchanged = operations.length - changed.length;
  const digestPayload = {
    version: 1,
    embeddingVersion: EMBEDDING_VERSION,
    reviewerId: String(reviewerId),
    operations: operations.map((operation) => ({
      type: operation.type,
      normalizedQuestion: operation.normalizedQuestion,
      sourceId: operation.sourceId,
      expectedFingerprint: operation.expectedFingerprint,
      targetFingerprint: operation.targetFingerprint,
    })),
    skips: summarizeSkips(skips),
    duplicateSourceCount: selected.duplicateSourceIds.length,
  };
  return {
    planDigest: fingerprint(digestPayload),
    digestPayload,
    operations: changed,
    summary: {
      sourceDocuments: sourceEntries?.length || 0,
      eligibleDocuments: prepared.length,
      skippedDocuments: skips.length,
      skippedByReason: summarizeSkips(skips),
      duplicateSourceDocuments: selected.duplicateSourceIds.length,
      targetDocuments: targetEntries?.length || 0,
      inserts: changed.filter((operation) => operation.type === "insert").length,
      updates: changed.filter((operation) => operation.type === "update").length,
      unchanged,
      embeddingReady: prepared.filter((item) => item.ready).length,
      embeddingPending: prepared.filter((item) => !item.ready).length,
    },
  };
};

const assertTargetPlanState = async (targetDb, plan, options) => {
  const targetEntries = await loadTargetKnowledgeEntries(targetDb, options);
  const currentByQuestion = new Map(
    targetEntries.map((entry) => [entry.normalizedQuestion, entry]),
  );
  for (const operation of plan.operations) {
    const current = currentByQuestion.get(operation.normalizedQuestion);
    const currentFingerprint = current
      ? fingerprint(comparableTarget(current))
      : null;
    if (currentFingerprint !== operation.targetFingerprint) {
      throw syncError("KB_SYNC_TARGET_DRIFT");
    }
  }
};

export const applyKnowledgeSyncPlan = async ({ targetDb, targetClient, plan }) => {
  if (!targetClient?.startSession) throw syncError("KB_SYNC_TRANSACTION_REQUIRED");
  const session = targetClient.startSession();
  try {
    return await session.withTransaction(
      async () => {
        await assertTargetPlanState(targetDb, plan, { session });
        let written = 0;
        for (const operation of plan.operations) {
          const result = await targetDb.collection("knowledgeentries").updateOne(
            { normalizedQuestion: operation.normalizedQuestion },
            {
              $set: {
                ...operation.update,
                updatedAt: new Date(),
              },
              $setOnInsert: { createdAt: new Date() },
            },
            { upsert: true, session },
          );
          if (result.matchedCount !== 1 && result.upsertedCount !== 1) {
            throw syncError("KB_SYNC_WRITE_FAILED");
          }
          written += 1;
        }
        await assertTargetPlanState(targetDb, plan, { session });
        return { documentsWritten: written };
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

export const verifyKnowledgeSyncPostState = async ({ targetDb, plan }) => {
  const targetEntries = await loadTargetKnowledgeEntries(targetDb);
  const targetByQuestion = new Map(
    targetEntries.map((entry) => [entry.normalizedQuestion, entry]),
  );
  const failed = plan.operations.filter((operation) => {
    const current = targetByQuestion.get(operation.normalizedQuestion);
    return !current || fingerprint(comparableTarget(current)) !== operation.expectedFingerprint;
  });
  if (failed.length) throw syncError("KB_SYNC_POST_VERIFY_FAILED");
  return {
    verifiedDocuments: plan.operations.length,
    targetDocuments: targetEntries.length,
  };
};

