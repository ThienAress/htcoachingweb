import { performance } from "node:perf_hooks";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { filterExerciseCatalog } from "../../client/src/pages/ExercisesPage/exerciseLibraryFilters.js";
import {
  EXERCISE_FIXTURE,
  FIXTURE_VERSION,
  JUDGED_QUERIES,
} from "./fixture.mjs";
import {
  meanReciprocalRank,
  noResultRate,
  recallAtK,
  retrievedPrecisionAtK,
  summarizeLatency,
} from "./metrics.mjs";
import { findPrivacyTypes } from "../lib/docs-privacy.mjs";
import { hasSecretLikeText } from "../lib/sensitive-text.mjs";

const IMPLEMENTATION_SOURCE = "client/src/pages/ExercisesPage/exerciseLibraryFilters.js";
const TOP_K = 5;
const CORPUS_METADATA_FIELDS = Object.freeze([
  "containsCustomerData",
  "corpusId",
  "dataClassification",
  "provenance",
  "version",
]);
const DEFAULT_CORPUS_METADATA = Object.freeze({
  corpusId: "exercise-library-synthetic-fixture",
  dataClassification: "synthetic-non-sensitive",
  containsCustomerData: false,
  provenance: "bundled-fixture",
  version: FIXTURE_VERSION,
});

const round = (value) => Number(value.toFixed(6));

const assertNoSensitiveCorpusText = (...values) => {
  const visited = new WeakSet();
  const inspect = (value) => {
    if (typeof value === "string" || (typeof value === "number" && Number.isFinite(value))) {
      const candidate = String(value);
      if (
        findPrivacyTypes(candidate).length > 0
        || hasSecretLikeText(candidate, { allowStandaloneGoogleAppPassword: true })
      ) {
        throw new Error("Custom corpus contains sensitive text");
      }
      return;
    }
    if (!value || typeof value !== "object") return;
    if (visited.has(value)) return;
    visited.add(value);
    for (const nestedValue of Object.values(value)) inspect(nestedValue);
  };
  for (const value of values) inspect(value);
};

const resolveCorpusMetadata = (exercises, queries, corpusMetadata) => {
  if (
    exercises === EXERCISE_FIXTURE
    && queries === JUDGED_QUERIES
    && corpusMetadata === undefined
  ) {
    return DEFAULT_CORPUS_METADATA;
  }
  const metadataFields = corpusMetadata && typeof corpusMetadata === "object"
    ? Object.keys(corpusMetadata).sort()
    : [];
  if (
    !corpusMetadata
    || Array.isArray(corpusMetadata)
    || metadataFields.length !== CORPUS_METADATA_FIELDS.length
    || metadataFields.some((field, index) => field !== CORPUS_METADATA_FIELDS[index])
    || typeof corpusMetadata.corpusId !== "string"
    || !/^[a-z0-9][a-z0-9._-]{0,79}$/i.test(corpusMetadata.corpusId)
    || typeof corpusMetadata.version !== "string"
    || !/^[a-z0-9][a-z0-9._-]{0,79}$/i.test(corpusMetadata.version)
    || corpusMetadata.dataClassification !== "synthetic-non-sensitive"
    || corpusMetadata.containsCustomerData !== false
    || corpusMetadata.provenance !== "caller-attested-synthetic"
  ) {
    throw new Error("Custom corpus metadata is required");
  }
  assertNoSensitiveCorpusText(exercises, queries, corpusMetadata);
  return Object.freeze(Object.fromEntries(
    CORPUS_METADATA_FIELDS.map((field) => [field, corpusMetadata[field]]),
  ));
};

const validateFixture = (exercises, queries) => {
  const exerciseIds = exercises.map((exercise) => exercise._id);
  if (new Set(exerciseIds).size !== exerciseIds.length) {
    throw new Error("Exercise fixture IDs must be unique");
  }

  const queryIds = queries.map((query) => query.id);
  if (new Set(queryIds).size !== queryIds.length) {
    throw new Error("Judged query IDs must be unique");
  }

  const knownExerciseIds = new Set(exerciseIds);
  for (const query of queries) {
    if (
      typeof query.id !== "string"
      || query.id.length === 0
      || typeof query.queryClass !== "string"
      || query.queryClass.length === 0
      || !Array.isArray(query.relevantIds)
    ) {
      throw new Error("Each judged query needs id, queryClass and relevantIds");
    }
    if (query.relevantIds.some((id) => !knownExerciseIds.has(id))) {
      throw new Error(`Query ${query.id} references an unknown exercise ID`);
    }
    if (query.relevantIds.length === 0 && query.expectedNoResults !== true) {
      throw new Error(`Query ${query.id} needs an explicit expectedNoResults judgment`);
    }
    if (query.relevantIds.length > 0 && query.expectedNoResults === true) {
      throw new Error(`Query ${query.id} has conflicting relevance judgments`);
    }
  }
};

const getOutcome = ({ relevantIds, top5ResultIds, resultIds, expectedNoResults }) => {
  if (expectedNoResults) {
    return resultIds.length === 0 ? "expected-no-result" : "unexpected-results";
  }
  const relevantSet = new Set(relevantIds);
  return top5ResultIds.some((id) => relevantSet.has(id))
    ? "hit-at-5"
    : "miss-at-5";
};

const evaluateQuery = (exercises, query, { includeLatency, now }) => {
  const filters = {
    searchTerm: query.searchTerm || "",
    muscleGroup: query.muscleGroup || "",
    difficulty: query.difficulty || "",
  };
  const startedAt = includeLatency ? now() : null;
  const results = filterExerciseCatalog(exercises, filters);
  const durationMs = includeLatency ? Math.max(0, now() - startedAt) : null;
  const resultIds = results.map((exercise) => exercise._id);
  const top5ResultIds = resultIds.slice(0, TOP_K);
  const relevantIds = [...query.relevantIds];
  const relevantSet = new Set(relevantIds);
  const firstRelevantIndex = resultIds.findIndex((id) => relevantSet.has(id));
  const relevantAt5 = new Set(top5ResultIds
    .filter((id) => relevantSet.has(id))).size;

  return {
    id: query.id,
    queryClass: query.queryClass,
    request: filters,
    relevantIds,
    expectedNoResults: query.expectedNoResults === true,
    resultIds,
    top5ResultIds,
    returnedCount: resultIds.length,
    relevantAt5,
    recallAt5: relevantIds.length === 0
      ? null
      : round(relevantAt5 / new Set(relevantIds).size),
    firstRelevantRank: firstRelevantIndex === -1 ? null : firstRelevantIndex + 1,
    outcome: getOutcome({
      relevantIds,
      top5ResultIds,
      resultIds,
      expectedNoResults: query.expectedNoResults,
    }),
    ...(includeLatency ? { durationMs: round(durationMs) } : {}),
  };
};

const roundLatency = (latency) => Object.fromEntries(
  Object.entries(latency).map(([key, value]) => [
    key,
    key === "sampleCount" ? value : round(value),
  ]),
);

export const runExerciseSearchBenchmark = ({
  exercises = EXERCISE_FIXTURE,
  queries = JUDGED_QUERIES,
  corpusMetadata,
  includeLatency = false,
  now = () => performance.now(),
} = {}) => {
  const resolvedCorpusMetadata = resolveCorpusMetadata(exercises, queries, corpusMetadata);
  validateFixture(exercises, queries);
  const cases = queries.map((query) =>
    evaluateQuery(exercises, query, { includeLatency, now }),
  );
  const evaluations = cases.map(({ relevantIds, resultIds }) => ({
    relevantIds,
    resultIds,
  }));
  const relevantEvaluations = evaluations
    .filter((evaluation) => evaluation.relevantIds.length > 0);
  const expectedNoResultEvaluations = evaluations
    .filter((evaluation) => evaluation.relevantIds.length === 0);

  return {
    schemaVersion: 1,
    reportType: "baseline",
    benchmark: "exercise-library-current-search",
    fixtureVersion: resolvedCorpusMetadata.version,
    implementation: {
      source: IMPLEMENTATION_SOURCE,
      behavior: "normalized contiguous substring; source catalog order",
    },
    policy: {
      qualityGate: "report-only",
      latencyGate: "report-only",
      exitPolicy: "nonzero only for invalid fixture or runtime failure",
    },
    determinism: {
      stableProjection: includeLatency ? "all fields except observed latency" : "entire report",
      excludedFields: includeLatency
        ? ["metrics.latencyMs", "cases[].durationMs"]
        : [],
    },
    corpus: {
      ...resolvedCorpusMetadata,
      querySet: queries === JUDGED_QUERIES
        ? "bundled-judgments"
        : "caller-provided-judgments",
      exerciseCount: exercises.length,
      queryCount: queries.length,
      judgedQueryCount: queries.length,
      relevantQueryCount: relevantEvaluations.length,
      expectedNoResultQueryCount: expectedNoResultEvaluations.length,
    },
    definitions: {
      recallAt5: "macro mean over queries with at least one relevant exercise",
      retrievedPrecisionAt5: "macro precision over actually retrieved results among the first five, for queries with at least one relevant exercise",
      mrr: "macro mean reciprocal rank over queries with at least one relevant exercise",
      noResultRate: "share of all query cases returning zero exercises",
      relevantQueryNoResultRate: "share of queries with relevant exercises returning zero exercises",
      expectedNoResultAccuracy: "share of expected no-result queries returning zero exercises",
      expectedNoResultFalsePositiveRate: "share of expected no-result queries returning one or more exercises",
      latencyMs: "opt-in nearest-rank wall-clock samples; reported only with --include-latency",
    },
    metrics: {
      recallAt5: round(recallAtK(evaluations, TOP_K)),
      retrievedPrecisionAt5: round(retrievedPrecisionAtK(evaluations, TOP_K)),
      mrr: round(meanReciprocalRank(evaluations)),
      noResultRate: round(noResultRate(evaluations)),
      relevantQueryNoResultRate: round(noResultRate(relevantEvaluations)),
      expectedNoResultAccuracy: round(noResultRate(expectedNoResultEvaluations)),
      expectedNoResultFalsePositiveRate: round(
        1 - noResultRate(expectedNoResultEvaluations),
      ),
      ...(includeLatency
        ? { latencyMs: roundLatency(summarizeLatency(cases.map((entry) => entry.durationMs))) }
        : {}),
    },
    cases,
  };
};

export const createDeterministicReport = (report) => ({
  ...report,
  metrics: {
    recallAt5: report.metrics.recallAt5,
    retrievedPrecisionAt5: report.metrics.retrievedPrecisionAt5,
    mrr: report.metrics.mrr,
    noResultRate: report.metrics.noResultRate,
    relevantQueryNoResultRate: report.metrics.relevantQueryNoResultRate,
    expectedNoResultAccuracy: report.metrics.expectedNoResultAccuracy,
    expectedNoResultFalsePositiveRate:
      report.metrics.expectedNoResultFalsePositiveRate,
  },
  cases: report.cases.map(({ durationMs: _durationMs, ...entry }) => entry),
});

const isDirectRun = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isDirectRun) {
  const args = process.argv.slice(2);
  const unknownArgs = args.filter((arg) => arg !== "--include-latency");
  if (unknownArgs.length > 0) {
    process.stderr.write(`${JSON.stringify({ error: "unsupported_argument" })}\n`);
    process.exitCode = 1;
  } else {
    const includeLatency = args.includes("--include-latency");
    process.stdout.write(
      `${JSON.stringify(runExerciseSearchBenchmark({ includeLatency }), null, 2)}\n`,
    );
  }
}
