import { normalizeKnowledgeQuestion } from "../utils/knowledgeBase.js";

// These constants describe vectors written before embedding profiles existed.
// Keep them independent from the current runtime profile so rerunning the
// historical migration can never relabel existing vectors.
export const HISTORICAL_EMBEDDING_DIMENSION = 768;
export const HISTORICAL_EMBEDDING_VERSION = "gemini-embedding-2:768";

export const KNOWLEDGE_INTEGRITY_PROJECTION = Object.freeze({
  question: 1,
  variants: 1,
  tags: 1,
  embedding: 1,
  embeddingVersion: 1,
  embeddingUpdatedAt: 1,
  status: 1,
});

const isHistoricalVectorReady = (vector) =>
  Array.isArray(vector) &&
  vector.length === HISTORICAL_EMBEDDING_DIMENSION &&
  vector.every(Number.isFinite);

const hasStoredEmbeddingVersion = (value) =>
  typeof value === "string" && value.trim().length > 0;

const hasStoredEmbeddingTimestamp = (value) => {
  if (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim().length === 0)
  ) {
    return false;
  }
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(timestamp);
};

export function buildKnowledgeEntryIntegritySet(entry, { now = new Date() } = {}) {
  const mainReady = isHistoricalVectorReady(entry.embedding);
  const variantsReady = (entry.variants || []).every((variant) =>
    isHistoricalVectorReady(variant.embedding),
  );
  const ready = mainReady && variantsReady;

  const integritySet = {
    normalizedQuestion: normalizeKnowledgeQuestion(entry.question),
    variantCount: entry.variants?.length || 0,
    embeddingStatus: ready ? "ready" : "failed",
    embeddingUpdatedAt: ready
      ? hasStoredEmbeddingTimestamp(entry.embeddingUpdatedAt)
        ? entry.embeddingUpdatedAt
        : now
      : null,
    embeddingError: ready
      ? null
      : "Backfill: embedding missing or invalid; regenerate required",
    ...(entry.status === "published" && !ready && { status: "draft" }),
  };
  if (!hasStoredEmbeddingVersion(entry.embeddingVersion)) {
    integritySet.embeddingVersion = ready ? HISTORICAL_EMBEDDING_VERSION : null;
  }
  return integritySet;
}
