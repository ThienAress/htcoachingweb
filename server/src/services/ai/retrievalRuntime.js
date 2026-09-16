import { validateKnowledgeEntryPrivacy } from "./knowledgePrivacy.js";

const RETRIEVABLE_EVIDENCE_LEVELS = Object.freeze([
  "editor_reviewed",
  "source_backed",
  "canonical_internal",
]);
const CANONICAL_INTERNAL_CATEGORIES = Object.freeze([
  "service",
  "hlv",
  "platform",
]);
const internalCategorySet = new Set(CANONICAL_INTERNAL_CATEGORIES);

const MATCH_SOURCES = new Set(["primary", "variant"]);

const toTime = (value) => {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  return new Date(value).getTime();
};

export function isKnowledgeEntryStale(entry, { now = Date.now() } = {}) {
  if (entry?.reviewStatus === "stale") return true;
  if (entry?.reviewDueAt === null || entry?.reviewDueAt === undefined) {
    return false;
  }
  const dueAt = toTime(entry.reviewDueAt);
  const referenceTime = toTime(now);
  return (
    !Number.isFinite(dueAt) ||
    !Number.isFinite(referenceTime) ||
    dueAt <= referenceTime
  );
}

export function buildKnowledgeRetrievalFilter({
  embeddingVersion,
  category,
  requireVariants = false,
}) {
  if (typeof embeddingVersion !== "string" || !embeddingVersion.trim()) {
    throw new Error("Knowledge retrieval requires an embedding version");
  }
  return {
    status: "published",
    embeddingStatus: "ready",
    embeddingVersion,
    reviewStatus: "reviewed",
    evidenceLevel: { $in: [...RETRIEVABLE_EVIDENCE_LEVELS] },
    $nor: [
      {
        category: { $in: [...CANONICAL_INTERNAL_CATEGORIES] },
        evidenceLevel: { $ne: "canonical_internal" },
      },
      {
        category: { $nin: [...CANONICAL_INTERNAL_CATEGORIES] },
        evidenceLevel: "canonical_internal",
      },
    ],
    ...(category && { category }),
    ...(requireVariants && { variantCount: { $gt: 0 } }),
  };
}

export function isKnowledgeRetrievalEligible(
  entry,
  { embeddingVersion, now = Date.now() } = {},
) {
  if (!entry || typeof entry !== "object") return false;
  if (typeof embeddingVersion !== "string" || !embeddingVersion.trim()) {
    return false;
  }
  if (
    entry.status !== "published" ||
    entry.embeddingStatus !== "ready" ||
    entry.embeddingVersion !== embeddingVersion ||
    entry.reviewStatus !== "reviewed" ||
    !RETRIEVABLE_EVIDENCE_LEVELS.includes(entry.evidenceLevel)
  ) {
    return false;
  }
  if (
    internalCategorySet.has(entry.category) !==
    (entry.evidenceLevel === "canonical_internal")
  ) {
    return false;
  }

  return !isKnowledgeEntryStale(entry, { now });
}

export function rankKnowledgeCandidates(
  candidates,
  {
    embeddingVersion,
    limit = 3,
    threshold = 0.75,
    now = Date.now(),
  } = {},
) {
  if (!Array.isArray(candidates)) return [];
  const boundedLimit = Math.min(Math.max(Number(limit) || 3, 1), 10);
  const numericThreshold = Number(threshold);
  const boundedThreshold = Number.isFinite(numericThreshold)
    ? Math.min(Math.max(numericThreshold, 0), 1)
    : 0.75;
  const merged = new Map();

  for (const candidate of candidates) {
    if (!isKnowledgeRetrievalEligible(candidate, { embeddingVersion, now })) {
      continue;
    }
    const identity = candidate?._id ?? candidate?.entryId;
    const score = Number(candidate?.similarity);
    if (
      identity === null ||
      identity === undefined ||
      !Number.isFinite(score) ||
      score < boundedThreshold ||
      score > 1 ||
      !MATCH_SOURCES.has(candidate.matchSource)
    ) {
      continue;
    }
    // A previously imported/reviewed record can bypass the current write gate.
    // Exclude it before returning evidence IDs or prompt context.
    if (!validateKnowledgeEntryPrivacy(candidate).valid) continue;

    const key = String(identity);
    const existing = merged.get(key);
    if (!existing || score > Number(existing.similarity)) {
      merged.set(key, candidate);
    }
  }

  return [...merged.values()]
    .sort((left, right) => Number(right.similarity) - Number(left.similarity))
    .slice(0, boundedLimit);
}
