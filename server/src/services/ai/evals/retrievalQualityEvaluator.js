import {
  isKnowledgeEntryStale,
  rankKnowledgeCandidates,
} from "../retrievalRuntime.js";

const REQUIRED_METRICS = Object.freeze([
  "top1Accuracy",
  "top3Recall",
  "noHitAccuracy",
  "variantCoverage",
  "staleExclusionRate",
  "legacyExclusionRate",
]);

const MATCH_SOURCES = new Set(["primary", "variant"]);
const KNOWLEDGE_STATUSES = new Set(["draft", "published", "archived"]);
const EMBEDDING_STATUSES = new Set(["pending", "ready", "failed"]);
const EVIDENCE_LEVELS = new Set([
  "legacy_unverified",
  "editor_reviewed",
  "source_backed",
  "canonical_internal",
]);
const REVIEW_STATUSES = new Set(["needs_review", "reviewed", "stale"]);
const CASE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{2,99}$/;
const ENTRY_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{1,119}$/;

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const assertEntryId = (value, field) => {
  if (typeof value !== "string" || !ENTRY_ID_PATTERN.test(value)) {
    throw new Error(`${field} must be a bounded entry ID`);
  }
  return value;
};

const assertEnum = (value, allowed, field) => {
  if (!allowed.has(value)) throw new Error(`${field} is invalid`);
  return value;
};

const readExcludedIds = (golden, kind, queryId) => {
  const values = golden.excluded?.[kind] ?? [];
  if (!Array.isArray(values)) {
    throw new Error(`Query ${queryId} golden.excluded.${kind} must be an array`);
  }
  const ids = values.map((value, index) =>
    assertEntryId(value, `Query ${queryId} golden.excluded.${kind}[${index}]`),
  );
  if (new Set(ids).size !== ids.length) {
    throw new Error(`Query ${queryId} has duplicate ${kind} exclusion IDs`);
  }
  return ids;
};

const validateMinimumMetrics = (minimumMetrics) => {
  if (!isPlainObject(minimumMetrics)) {
    throw new Error("expected.minimumMetrics must be an object");
  }
  for (const metric of REQUIRED_METRICS) {
    const value = minimumMetrics[metric];
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > 1
    ) {
      throw new Error(`expected.minimumMetrics.${metric} must be between 0 and 1`);
    }
  }
};

const validateRuntime = (runtime) => {
  if (!isPlainObject(runtime)) {
    throw new Error("input.runtime must define deterministic retrieval settings");
  }
  const embeddingVersion = assertEntryId(
    runtime.embeddingVersion,
    "input.runtime.embeddingVersion",
  );
  const now = new Date(runtime.now);
  if (!Number.isFinite(now.getTime())) {
    throw new Error("input.runtime.now must be a valid date");
  }
  if (!Number.isInteger(runtime.limit) || runtime.limit < 1 || runtime.limit > 10) {
    throw new Error("input.runtime.limit must be an integer between 1 and 10");
  }
  if (
    typeof runtime.threshold !== "number" ||
    !Number.isFinite(runtime.threshold) ||
    runtime.threshold < 0 ||
    runtime.threshold > 1
  ) {
    throw new Error("input.runtime.threshold must be between 0 and 1");
  }
  return {
    embeddingVersion,
    limit: runtime.limit,
    now,
    threshold: runtime.threshold,
  };
};

const validateCandidate = (candidate, queryId, index) => {
  if (!isPlainObject(candidate)) {
    throw new Error(`Query ${queryId} candidate ${index} must be an object`);
  }
  const field = `Query ${queryId} candidate ${index}`;
  const entryId = assertEntryId(candidate.entryId, `${field}.entryId`);
  const similarity = Number(candidate.similarity);
  if (!Number.isFinite(similarity) || similarity < 0 || similarity > 1) {
    throw new Error(`${field}.similarity must be between 0 and 1`);
  }
  let reviewDueAt = null;
  if (candidate.reviewDueAt !== null && candidate.reviewDueAt !== undefined) {
    reviewDueAt = new Date(candidate.reviewDueAt);
    if (!Number.isFinite(reviewDueAt.getTime())) {
      throw new Error(`${field}.reviewDueAt must be null or a valid date`);
    }
  }
  if (typeof candidate.embeddingVersion !== "string") {
    throw new Error(`${field}.embeddingVersion must be a string`);
  }

  return {
    entryId,
    similarity,
    matchSource: assertEnum(candidate.matchSource, MATCH_SOURCES, `${field}.matchSource`),
    status: assertEnum(candidate.status, KNOWLEDGE_STATUSES, `${field}.status`),
    embeddingStatus: assertEnum(
      candidate.embeddingStatus,
      EMBEDDING_STATUSES,
      `${field}.embeddingStatus`,
    ),
    embeddingVersion: candidate.embeddingVersion,
    evidenceLevel: assertEnum(
      candidate.evidenceLevel,
      EVIDENCE_LEVELS,
      `${field}.evidenceLevel`,
    ),
    reviewStatus: assertEnum(
      candidate.reviewStatus,
      REVIEW_STATUSES,
      `${field}.reviewStatus`,
    ),
    reviewDueAt,
  };
};

const validateQuery = (query, seenIds, runtime) => {
  if (!isPlainObject(query) || !CASE_ID_PATTERN.test(query.id || "")) {
    throw new Error("Retrieval golden query id is invalid");
  }
  if (seenIds.has(query.id)) {
    throw new Error(`Duplicate retrieval golden query id: ${query.id}`);
  }
  seenIds.add(query.id);

  if (!isPlainObject(query.golden)) {
    throw new Error(`Query ${query.id} golden contract must be an object`);
  }
  const hasExpectedEntry = query.golden.entryId !== undefined;
  const expectsNoHit = query.golden.noHit === true;
  if (hasExpectedEntry === expectsNoHit) {
    throw new Error(
      `Query ${query.id} must define exactly one of golden.entryId or golden.noHit`,
    );
  }

  const expectedEntryId = hasExpectedEntry
    ? assertEntryId(query.golden.entryId, `Query ${query.id} golden.entryId`)
    : null;
  const expectedMatchSource = query.golden.matchSource ?? null;
  if (expectedMatchSource !== null && !MATCH_SOURCES.has(expectedMatchSource)) {
    throw new Error(`Query ${query.id} golden.matchSource is invalid`);
  }
  if (expectedMatchSource !== null && !expectedEntryId) {
    throw new Error(`Query ${query.id} cannot set matchSource for a no-hit case`);
  }

  if (
    !Array.isArray(query.candidates) ||
    query.candidates.length === 0 ||
    query.candidates.length > 50
  ) {
    throw new Error(`Query ${query.id} candidates must contain 1 to 50 entries`);
  }
  const candidateKeys = new Set();
  const candidates = query.candidates.map((candidate, index) => {
    const validated = validateCandidate(candidate, query.id, index);
    const key = `${validated.entryId}:${validated.matchSource}`;
    if (candidateKeys.has(key)) {
      throw new Error(`Query ${query.id} contains duplicate candidate ${key}`);
    }
    candidateKeys.add(key);
    return validated;
  });

  const candidateIds = new Set(candidates.map(({ entryId }) => entryId));
  if (expectedEntryId && !candidateIds.has(expectedEntryId)) {
    throw new Error(`Query ${query.id} candidates omit expected entry`);
  }
  const staleIds = readExcludedIds(query.golden, "stale", query.id);
  const legacyIds = readExcludedIds(query.golden, "legacy", query.id);
  if ([...staleIds, ...legacyIds].includes(expectedEntryId)) {
    throw new Error(`Query ${query.id} cannot exclude its expected entry`);
  }

  for (const entryId of staleIds) {
    const matches = candidates.filter((candidate) => candidate.entryId === entryId);
    if (
      matches.length === 0 ||
      matches.every((candidate) => !isKnowledgeEntryStale(candidate, runtime))
    ) {
      throw new Error(`Query ${query.id} stale exclusion is not a stale candidate`);
    }
  }
  for (const entryId of legacyIds) {
    const matches = candidates.filter((candidate) => candidate.entryId === entryId);
    if (
      matches.length === 0 ||
      matches.every(
        (candidate) =>
          candidate.evidenceLevel !== "legacy_unverified" &&
          candidate.embeddingVersion === runtime.embeddingVersion,
      )
    ) {
      throw new Error(`Query ${query.id} legacy exclusion is not a legacy candidate`);
    }
  }

  return {
    candidates,
    expectedEntryId,
    expectedMatchSource,
    expectsNoHit,
    legacyIds,
    staleIds,
  };
};

const ratio = (hits, total) => (total === 0 ? 0 : hits / total);

const formatMetric = (value) => Number(value.toFixed(4));

export function evaluateRetrievalGoldenQueries(input, expected) {
  if (
    !isPlainObject(input) ||
    !Array.isArray(input.queries) ||
    input.queries.length === 0
  ) {
    throw new Error("input.queries must contain retrieval golden queries");
  }
  validateMinimumMetrics(expected?.minimumMetrics);
  const runtime = validateRuntime(input.runtime);

  const seenIds = new Set();
  const counters = {
    answerable: 0,
    top1Hits: 0,
    top3Hits: 0,
    noHit: 0,
    noHitHits: 0,
    variant: 0,
    variantHits: 0,
    staleChecks: 0,
    staleExclusions: 0,
    legacyChecks: 0,
    legacyExclusions: 0,
  };

  for (const rawQuery of input.queries) {
    const query = validateQuery(rawQuery, seenIds, runtime);
    const results = rankKnowledgeCandidates(query.candidates, runtime);
    const topThree = results.slice(0, 3);

    if (query.expectsNoHit) {
      counters.noHit += 1;
      if (results.length === 0) counters.noHitHits += 1;
    } else {
      counters.answerable += 1;
      if (results[0]?.entryId === query.expectedEntryId) {
        counters.top1Hits += 1;
      }
      if (topThree.some((result) => result.entryId === query.expectedEntryId)) {
        counters.top3Hits += 1;
      }
    }

    if (query.expectedMatchSource === "variant") {
      counters.variant += 1;
      if (
        topThree.some(
          (result) =>
            result.entryId === query.expectedEntryId &&
            result.matchSource === "variant",
        )
      ) {
        counters.variantHits += 1;
      }
    }

    const rankedIds = new Set(results.map((result) => result.entryId));
    counters.staleChecks += query.staleIds.length;
    counters.staleExclusions += query.staleIds.filter(
      (entryId) => !rankedIds.has(entryId),
    ).length;
    counters.legacyChecks += query.legacyIds.length;
    counters.legacyExclusions += query.legacyIds.filter(
      (entryId) => !rankedIds.has(entryId),
    ).length;
  }

  const counts = {
    answerable: counters.answerable,
    noHit: counters.noHit,
    variant: counters.variant,
    staleChecks: counters.staleChecks,
    legacyChecks: counters.legacyChecks,
  };
  for (const [dimension, count] of Object.entries(counts)) {
    if (count === 0) {
      throw new Error(`Retrieval golden corpus has no coverage for ${dimension}`);
    }
  }

  const rawMetrics = {
    top1Accuracy: ratio(counters.top1Hits, counters.answerable),
    top3Recall: ratio(counters.top3Hits, counters.answerable),
    noHitAccuracy: ratio(counters.noHitHits, counters.noHit),
    variantCoverage: ratio(counters.variantHits, counters.variant),
    staleExclusionRate: ratio(
      counters.staleExclusions,
      counters.staleChecks,
    ),
    legacyExclusionRate: ratio(
      counters.legacyExclusions,
      counters.legacyChecks,
    ),
  };
  const metrics = Object.fromEntries(
    Object.entries(rawMetrics).map(([name, value]) => [name, formatMetric(value)]),
  );
  metrics.counts = counts;

  const failures = [];
  for (const metric of REQUIRED_METRICS) {
    if (rawMetrics[metric] < expected.minimumMetrics[metric]) {
      failures.push(
        `${metric} ${formatMetric(rawMetrics[metric])} was below minimum ${expected.minimumMetrics[metric]}`,
      );
    }
  }

  return { failures, metrics };
}
