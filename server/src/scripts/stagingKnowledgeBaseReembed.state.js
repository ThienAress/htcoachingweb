import { createHash } from "node:crypto";

import {
  EMBEDDING_DIMENSION,
  QUESTION_ANSWERING_EMBEDDING_PROFILE_ID,
  getEmbeddingProfile,
} from "../services/ai/embeddingProfile.js";

export const QUESTION_ANSWERING_EMBEDDING_VERSION =
  getEmbeddingProfile(QUESTION_ANSWERING_EMBEDDING_PROFILE_ID).version;

const fail = (code, message = code) =>
  Object.assign(new Error(`${code}: ${message}`), { code });

const sha256 = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

const isoDate = (value) => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const vector = (value) =>
  Array.isArray(value) ? value.map((item) => Number(item)) : [];

const isValidVector = (value) =>
  Array.isArray(value) &&
  value.length === EMBEDDING_DIMENSION &&
  value.every(Number.isFinite);

const isStoredVector = (value) =>
  Array.isArray(value) &&
  (value.length === 0 || value.length === EMBEDDING_DIMENSION) &&
  value.every(Number.isFinite);

const toDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw fail("KB_REEMBED_VECTOR_STATE_DATE_INVALID");
  }
  return parsed;
};

const assertStoredState = (state, { rollback = false } = {}) => {
  if (
    !isStoredVector(state?.embedding) ||
    !Array.isArray(state?.variantEmbeddings) ||
    !state.variantEmbeddings.every(isStoredVector) ||
    !new Set(["pending", "ready", "failed"]).has(state.embeddingStatus) ||
    (state.embeddingVersion !== null &&
      (typeof state.embeddingVersion !== "string" ||
        state.embeddingVersion.length > 100))
  ) {
    throw fail("KB_REEMBED_VECTOR_STATE_INVALID");
  }
  if (
    state.embeddingVersion === QUESTION_ANSWERING_EMBEDDING_VERSION &&
    (!rollback || state.embeddingStatus === "ready") &&
    (state.embeddingStatus !== "ready" ||
      state.embedding.length !== EMBEDDING_DIMENSION ||
      state.variantEmbeddings.some(
        (item) => item.length !== EMBEDDING_DIMENSION,
      ))
  ) {
    throw fail("KB_REEMBED_TARGET_VECTOR_STATE_INVALID");
  }
};

export const buildKnowledgeVectorUpdateSet = (
  liveEntry,
  state,
  { rollback = false } = {},
) => {
  assertStoredState(state, { rollback });
  const currentVariants = Array.isArray(liveEntry.variants)
    ? liveEntry.variants
    : [];
  const variantEmbeddings = Array.isArray(state.variantEmbeddings)
    ? state.variantEmbeddings
    : [];
  if (variantEmbeddings.length !== currentVariants.length) {
    throw fail("KB_REEMBED_VARIANT_COUNT_DRIFT");
  }
  return {
    embedding: [...state.embedding],
    variants: currentVariants.map((variant, index) => ({
      ...variant,
      embedding: [...variantEmbeddings[index]],
    })),
    embeddingStatus: state.embeddingStatus,
    embeddingVersion: state.embeddingVersion,
    embeddingError: state.embeddingError,
    embeddingUpdatedAt: toDate(state.embeddingUpdatedAt),
  };
};

const variants = (entry) =>
  Array.isArray(entry?.variants) ? entry.variants : [];

export const createKnowledgeContentHash = (entry) =>
  sha256({
    question: String(entry?.question || ""),
    variants: variants(entry).map((variant) => String(variant?.text || "")),
  });

export const extractKnowledgeVectorState = (entry) => ({
  embedding: vector(entry?.embedding),
  variantEmbeddings: variants(entry).map((variant) => vector(variant?.embedding)),
  embeddingStatus: String(entry?.embeddingStatus || "pending"),
  embeddingVersion: entry?.embeddingVersion
    ? String(entry.embeddingVersion)
    : null,
  embeddingError: entry?.embeddingError
    ? String(entry.embeddingError).slice(0, 500)
    : null,
  embeddingUpdatedAt: isoDate(entry?.embeddingUpdatedAt),
});

export const createKnowledgeVectorStateHash = (entry) =>
  sha256(extractKnowledgeVectorState(entry));

const isTargetReady = (entry) =>
  entry?.embeddingStatus === "ready" &&
  entry?.embeddingVersion === QUESTION_ANSWERING_EMBEDDING_VERSION &&
  isValidVector(entry?.embedding) &&
  variants(entry).every((variant) => isValidVector(variant?.embedding));

export const buildStagingKnowledgeBaseReembedPlan = (entries = []) => {
  const planEntries = entries
    .map((entry) => {
      const id = String(entry?._id || "");
      if (!/^[a-f0-9]{24}$/i.test(id)) {
        throw fail("KB_REEMBED_ENTRY_ID_INVALID");
      }
      const variantCount = variants(entry).length;
      const needsUpdate = !isTargetReady(entry);
      return {
        id,
        contentHash: createKnowledgeContentHash(entry),
        priorStateHash: createKnowledgeVectorStateHash(entry),
        variantCount,
        needsUpdate,
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));
  const documentsToUpdate = planEntries.filter(
    ({ needsUpdate }) => needsUpdate,
  );
  const summary = {
    documents: planEntries.length,
    documentsToUpdate: documentsToUpdate.length,
    rootEmbeddingsToGenerate: documentsToUpdate.length,
    variantEmbeddingsToGenerate: documentsToUpdate.reduce(
      (total, entry) => total + entry.variantCount,
      0,
    ),
    providerCalls: documentsToUpdate.reduce(
      (total, entry) => total + 1 + entry.variantCount,
      0,
    ),
  };
  const digestInput = {
    schemaVersion: 1,
    targetProfile: QUESTION_ANSWERING_EMBEDDING_PROFILE_ID,
    targetVersion: QUESTION_ANSWERING_EMBEDDING_VERSION,
    entries: planEntries,
  };
  return {
    ...digestInput,
    planDigest: sha256(digestInput),
    summary,
  };
};

export const generateKnowledgeTargetStates = async ({
  plan,
  entries,
  generateEmbedding,
  now = new Date(),
}) => {
  const byId = new Map(entries.map((entry) => [String(entry._id), entry]));
  const targetStates = [];
  for (const planned of plan.entries.filter(({ needsUpdate }) => needsUpdate)) {
    const entry = byId.get(planned.id);
    if (
      !entry ||
      createKnowledgeContentHash(entry) !== planned.contentHash ||
      createKnowledgeVectorStateHash(entry) !== planned.priorStateHash
    ) {
      throw fail("KB_REEMBED_SOURCE_DRIFT");
    }
    const embedding = await generateEmbedding(entry.question, {
      inputType: "document",
      profileId: QUESTION_ANSWERING_EMBEDDING_PROFILE_ID,
    });
    const targetVariants = [];
    for (const variant of variants(entry)) {
      targetVariants.push({
        ...variant,
        embedding: await generateEmbedding(variant.text, {
          inputType: "document",
          profileId: QUESTION_ANSWERING_EMBEDDING_PROFILE_ID,
        }),
      });
    }
    const targetEntry = {
      ...entry,
      embedding,
      variants: targetVariants,
      embeddingStatus: "ready",
      embeddingVersion: QUESTION_ANSWERING_EMBEDDING_VERSION,
      embeddingError: null,
      embeddingUpdatedAt: now,
    };
    if (!isTargetReady(targetEntry)) {
      throw fail("KB_REEMBED_PROVIDER_VECTOR_INVALID");
    }
    targetStates.push({
      id: planned.id,
      contentHash: planned.contentHash,
      priorStateHash: planned.priorStateHash,
      targetEntry,
      targetStateHash: createKnowledgeVectorStateHash(targetEntry),
    });
  }
  return targetStates;
};

const assertEntryMap = (entries, expectedIds, { exact = true } = {}) => {
  const byId = new Map(entries.map((entry) => [String(entry._id), entry]));
  if (exact && byId.size !== expectedIds.length) {
    throw fail("KB_REEMBED_DOCUMENT_COUNT_MISMATCH");
  }
  for (const id of expectedIds) {
    if (!byId.has(id)) throw fail("KB_REEMBED_DOCUMENT_MISSING");
  }
  return byId;
};

export const verifyKnowledgeReembedPostState = ({
  plan,
  targetStates = [],
  entries = [],
}) => {
  const byId = assertEntryMap(entries, plan.entries.map(({ id }) => id));
  const targets = new Map(targetStates.map((state) => [state.id, state]));
  for (const planned of plan.entries) {
    const entry = byId.get(planned.id);
    if (createKnowledgeContentHash(entry) !== planned.contentHash) {
      throw fail("KB_REEMBED_CONTENT_DRIFT");
    }
    const expectedStateHash = planned.needsUpdate
      ? targets.get(planned.id)?.targetStateHash
      : planned.priorStateHash;
    if (!expectedStateHash) throw fail("KB_REEMBED_TARGET_STATE_MISSING");
    if (createKnowledgeVectorStateHash(entry) !== expectedStateHash) {
      throw fail("KB_REEMBED_TARGET_STATE_MISMATCH");
    }
    if (!isTargetReady(entry)) throw fail("KB_REEMBED_TARGET_PROFILE_INVALID");
  }
  return { valid: true, documentsVerified: plan.entries.length };
};

export const verifyKnowledgeRollbackPostState = ({ snapshot, entries = [] }) => {
  const expected = Array.isArray(snapshot?.inventory) ? snapshot.inventory : [];
  const byId = assertEntryMap(entries, expected.map(({ id }) => id));
  for (const saved of expected) {
    const entry = byId.get(saved.id);
    if (createKnowledgeContentHash(entry) !== saved.contentHash) {
      throw fail("KB_REEMBED_ROLLBACK_CONTENT_DRIFT");
    }
    if (createKnowledgeVectorStateHash(entry) !== saved.priorStateHash) {
      throw fail("KB_REEMBED_ROLLBACK_STATE_MISMATCH");
    }
  }
  return { valid: true, documentsVerified: expected.length };
};

export const verifyKnowledgeRollbackPreState = ({ snapshot, entries = [] }) => {
  const expected = Array.isArray(snapshot?.inventory) ? snapshot.inventory : [];
  const byId = assertEntryMap(entries, expected.map(({ id }) => id));
  for (const saved of expected) {
    const entry = byId.get(saved.id);
    if (createKnowledgeContentHash(entry) !== saved.contentHash) {
      throw fail("KB_REEMBED_ROLLBACK_CONTENT_DRIFT");
    }
    if (
      createKnowledgeVectorStateHash(entry) !== saved.expectedTargetStateHash
    ) {
      throw fail("KB_REEMBED_ROLLBACK_TARGET_STATE_DRIFT");
    }
  }
  for (const saved of snapshot.entries) {
    const entry = byId.get(saved.id);
    if (!entry) throw fail("KB_REEMBED_DOCUMENT_MISSING");
    buildKnowledgeVectorUpdateSet(entry, saved.priorState, { rollback: true });
  }
  return { valid: true, documentsVerified: expected.length };
};

export const buildKnowledgeSnapshotPayload = ({
  plan,
  entries,
  targetStates,
  snapshotId,
  now = new Date(),
}) => {
  const byId = new Map(entries.map((entry) => [String(entry._id), entry]));
  const targets = new Map(targetStates.map((state) => [state.id, state]));
  for (const planned of plan.entries.filter(({ needsUpdate }) => needsUpdate)) {
    if (!byId.has(planned.id) || !targets.get(planned.id)?.targetStateHash) {
      throw fail("KB_REEMBED_SNAPSHOT_STATE_INCOMPLETE");
    }
  }
  return {
    schemaVersion: 1,
    snapshotId,
    targetDatabase: "htcoaching_staging",
    targetProfile: QUESTION_ANSWERING_EMBEDDING_PROFILE_ID,
    targetVersion: QUESTION_ANSWERING_EMBEDDING_VERSION,
    planDigest: plan.planDigest,
    createdAt: now.toISOString(),
    inventory: plan.entries.map((planned) => ({
      id: planned.id,
      contentHash: planned.contentHash,
      priorStateHash: planned.priorStateHash,
      expectedTargetStateHash: planned.needsUpdate
        ? targets.get(planned.id).targetStateHash
        : planned.priorStateHash,
    })),
    entries: plan.entries
      .filter(({ needsUpdate }) => needsUpdate)
      .map((planned) => ({
        id: planned.id,
        contentHash: planned.contentHash,
        priorStateHash: planned.priorStateHash,
        priorState: extractKnowledgeVectorState(byId.get(planned.id)),
        targetStateHash: targets.get(planned.id)?.targetStateHash,
      })),
  };
};
