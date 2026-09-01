import { performance } from "node:perf_hooks";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { runExerciseSearchBenchmark } from "./benchmark.mjs";
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

const TOP_K = 5;
const PRODUCTION_FILTER_SOURCE = "client/src/pages/ExercisesPage/exerciseLibraryFilters.js";
const QUERY_SYNONYMS = new Map([["hit dat", ["chong", "day"]]]);

export const PILOT_TARGETS = Object.freeze({
  recallAt5: Object.freeze({ operator: "min", value: 0.9 }),
  retrievedPrecisionAt5: Object.freeze({ operator: "min", value: 0.9 }),
  mrr: Object.freeze({ operator: "min", value: 0.9 }),
  relevantQueryNoResultRate: Object.freeze({ operator: "max", value: 0.1 }),
  expectedNoResultAccuracy: Object.freeze({ operator: "equal", value: 1 }),
  expectedNoResultFalsePositiveRate: Object.freeze({ operator: "equal", value: 0 }),
});

const round = (value) => Number(value.toFixed(6));

const normalizeText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const tokenize = (value) => {
  const normalized = normalizeText(value);
  if (!normalized) return [];
  return normalized.split(/\s+/);
};
const queryTokens = (searchTerm) => {
  const normalized = normalizeText(searchTerm);
  return QUERY_SYNONYMS.get(normalized) || tokenize(normalized);
};
const isWithinOneEdit = (left, right) => {
  if (left === right) return true;
  if (Math.abs(left.length - right.length) > 1) return false;

  if (left.length === right.length) {
    const mismatches = [];
    for (let index = 0; index < left.length; index += 1) {
      if (left[index] !== right[index]) mismatches.push(index);
      if (mismatches.length > 2) return false;
    }
    if (mismatches.length === 1) return true;
    return mismatches.length === 2
      && mismatches[1] === mismatches[0] + 1
      && left[mismatches[0]] === right[mismatches[1]]
      && left[mismatches[1]] === right[mismatches[0]];
  }

  const [shorter, longer] = left.length < right.length
    ? [left, right] : [right, left];
  let shortIndex = 0;
  let longIndex = 0;
  let skipped = false;
  while (shortIndex < shorter.length && longIndex < longer.length) {
    if (shorter[shortIndex] === longer[longIndex]) {
      shortIndex += 1;
      longIndex += 1;
    } else if (skipped) {
      return false;
    } else {
      skipped = true;
      longIndex += 1;
    }
  }
  return true;
};
const isAdjacentTransposition = (left, right) => {
  if (left.length !== right.length || left.length < 4) return false;
  const mismatches = [];
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) mismatches.push(index);
    if (mismatches.length > 2) return false;
  }
  return mismatches.length === 2
    && mismatches[1] === mismatches[0] + 1
    && left[mismatches[0]] === right[mismatches[1]]
    && left[mismatches[1]] === right[mismatches[0]];
};
const tokenSimilarity = (queryToken, candidateToken) => {
  if (queryToken === candidateToken) return 1;
  if (
    isAdjacentTransposition(queryToken, candidateToken)
    || (queryToken.length >= 5
      && candidateToken.length >= 5
    && isWithinOneEdit(queryToken, candidateToken)
    )
  ) {
    return 0.75;
  }
  return 0;
};
const scoreExercise = (exercise, tokens) => {
  const fields = [
    [tokenize(exercise.name), 4],
    [tokenize(exercise.muscleGroup), 2],
    [tokenize(exercise.description), 1],
  ];
  const fieldScores = fields.map(([candidateTokens, weight]) => {
    let fieldScore = 0;
    for (const token of tokens) {
      const bestSimilarity = candidateTokens.reduce(
        (best, candidateToken) => Math.max(
          best,
          tokenSimilarity(token, candidateToken),
        ),
        0,
      );
      if (bestSimilarity === 0) return 0;
      fieldScore += bestSimilarity * weight;
    }
    return fieldScore;
  });
  let crossFieldScore = 0;
  for (const token of tokens) {
    const bestWeightedSimilarity = fields.reduce((fieldBest, [candidateTokens, weight]) =>
      Math.max(
        fieldBest,
        candidateTokens.reduce((tokenBest, candidateToken) => Math.max(
          tokenBest,
          tokenSimilarity(token, candidateToken) * weight,
        ), 0),
      ), 0);
    if (bestWeightedSimilarity === 0) return 0;
    crossFieldScore += bestWeightedSimilarity;
  }
  const coherentScore = Math.max(...fieldScores);
  const score = Math.max(coherentScore, crossFieldScore);
  return {
    coherent: coherentScore >= 2,
    score: score >= 2 ? score : 0,
  };
};
const matchesFilters = (exercise, { muscleGroup, difficulty }) => {
  const matchesMuscleGroup = !muscleGroup || exercise.muscleGroup === muscleGroup;
  const matchesDifficulty = !difficulty
    || (difficulty === "unrated"
      ? exercise.technicalDifficultyRating == null
      : exercise.technicalDifficultyRating === Number(difficulty));
  return matchesMuscleGroup && matchesDifficulty;
};
export const searchExercisePilot = (
  exercises,
  { searchTerm = "", muscleGroup = "", difficulty = "" } = {},
) => {
  if (!Array.isArray(exercises)) {
    throw new TypeError("exercises must be an array");
  }

  const tokens = queryTokens(searchTerm);
  const filtered = exercises
    .map((exercise, sourceIndex) => ({ exercise, sourceIndex }))
    .filter(({ exercise }) => matchesFilters(exercise, {
      muscleGroup,
      difficulty,
    }));
  if (tokens.length === 0) {
    return filtered.map(({ exercise }) => exercise);
  }

  const scored = filtered
    .map(({ exercise, sourceIndex }) => ({
      exercise,
      sourceIndex,
      ...scoreExercise(exercise, tokens),
    }))
    .filter(({ score }) => score > 0)
    .sort((left, right) =>
      right.score - left.score || left.sourceIndex - right.sourceIndex);
  const coherentMatchExists = scored.some(({ coherent }) => coherent);
  return scored
    .filter(({ coherent }) => !coherentMatchExists || coherent)
    .map(({ exercise }) => exercise);
};

const evaluateCase = (exercises, query, { includeLatency, now }) => {
  const request = {
    searchTerm: query.searchTerm || "",
    muscleGroup: query.muscleGroup || "",
    difficulty: query.difficulty || "",
  };
  const startedAt = includeLatency ? now() : null;
  const results = searchExercisePilot(exercises, request);
  const durationMs = includeLatency ? Math.max(0, now() - startedAt) : null;
  const resultIds = results.map((exercise) => exercise._id);
  const top5ResultIds = resultIds.slice(0, TOP_K);
  const relevantIds = [...query.relevantIds];
  const relevantSet = new Set(relevantIds);
  const relevantAt5 = new Set(top5ResultIds
    .filter((id) => relevantSet.has(id))).size;
  const firstRelevantIndex = resultIds.findIndex((id) => relevantSet.has(id));

  return {
    id: query.id,
    queryClass: query.queryClass,
    request,
    relevantIds,
    expectedNoResults: query.expectedNoResults === true,
    resultIds,
    top5ResultIds,
    relevantAt5,
    firstRelevantRank: firstRelevantIndex === -1 ? null : firstRelevantIndex + 1,
    ...(includeLatency ? { durationMs: round(durationMs) } : {}),
  };
};

const targetMetrics = (cases) => {
  const evaluations = cases.map(({ relevantIds, resultIds }) => ({
    relevantIds,
    resultIds,
  }));
  const relevant = evaluations
    .filter((evaluation) => evaluation.relevantIds.length > 0);
  const expectedNoResult = evaluations
    .filter((evaluation) => evaluation.relevantIds.length === 0);
  return {
    recallAt5: round(recallAtK(evaluations, TOP_K)),
    retrievedPrecisionAt5: round(retrievedPrecisionAtK(evaluations, TOP_K)),
    mrr: round(meanReciprocalRank(evaluations)),
    relevantQueryNoResultRate: round(noResultRate(relevant)),
    expectedNoResultAccuracy: round(noResultRate(expectedNoResult)),
    expectedNoResultFalsePositiveRate: round(1 - noResultRate(expectedNoResult)),
  };
};

export const evaluatePilotTargets = (metrics) => {
  const checks = {
    recallAt5: Number.isFinite(metrics?.recallAt5)
      && metrics.recallAt5 >= PILOT_TARGETS.recallAt5.value,
    retrievedPrecisionAt5: Number.isFinite(metrics?.retrievedPrecisionAt5)
      && metrics.retrievedPrecisionAt5 >= PILOT_TARGETS.retrievedPrecisionAt5.value,
    mrr: Number.isFinite(metrics?.mrr)
      && metrics.mrr >= PILOT_TARGETS.mrr.value,
    relevantQueryNoResultRate: Number.isFinite(metrics?.relevantQueryNoResultRate)
      && metrics.relevantQueryNoResultRate
        <= PILOT_TARGETS.relevantQueryNoResultRate.value,
    expectedNoResultAccuracy: Number.isFinite(metrics?.expectedNoResultAccuracy)
      && metrics.expectedNoResultAccuracy
        === PILOT_TARGETS.expectedNoResultAccuracy.value,
    expectedNoResultFalsePositiveRate:
      Number.isFinite(metrics?.expectedNoResultFalsePositiveRate)
      && metrics.expectedNoResultFalsePositiveRate
        === PILOT_TARGETS.expectedNoResultFalsePositiveRate.value,
  };
  return {
    passed: Object.values(checks).every(Boolean),
    checks,
  };
};
const selectBaselineMetrics = (metrics) => ({
  recallAt5: metrics.recallAt5,
  retrievedPrecisionAt5: metrics.retrievedPrecisionAt5,
  mrr: metrics.mrr,
  relevantQueryNoResultRate: metrics.relevantQueryNoResultRate,
  expectedNoResultAccuracy: metrics.expectedNoResultAccuracy,
  expectedNoResultFalsePositiveRate: metrics.expectedNoResultFalsePositiveRate,
  ...(metrics.latencyMs ? { latencyMs: metrics.latencyMs } : {}),
});

export const runSearchPilotComparison = ({
  includeLatency = false,
  now = () => performance.now(),
} = {}) => {
  const baselineReport = runExerciseSearchBenchmark({ includeLatency, now });
  const cases = JUDGED_QUERIES.map((query) =>
    evaluateCase(EXERCISE_FIXTURE, query, { includeLatency, now }));
  const metrics = targetMetrics(cases);
  if (includeLatency) {
    metrics.latencyMs = Object.fromEntries(
      Object.entries(summarizeLatency(cases.map((entry) => entry.durationMs)))
        .map(([key, value]) => [
          key, key === "sampleCount" ? value : round(value),
        ]),
    );
  }

  return {
    schemaVersion: 1,
    reportType: "baseline-vs-pilot",
    fixtureVersion: FIXTURE_VERSION,
    runtimeBoundary: {
      productionSource: PRODUCTION_FILTER_SOURCE,
      productionFilterUsage: "baseline-only-read-only",
      productRuntimeModified: false,
    },
    policy: {
      qualityGate: "enforced",
      latencyGate: "report-only",
      exitPolicy: "nonzero when any P2 quality target fails",
    },
    determinism: {
      stableProjection: includeLatency
        ? "all fields except observed latency"
        : "entire report",
    },
    thresholds: PILOT_TARGETS,
    baseline: {
      metrics: selectBaselineMetrics(baselineReport.metrics),
      cases: baselineReport.cases,
    },
    pilot: {
      implementation: {
        mode: "offline-pure-js",
        capabilities: ["d-stroke", "token-and", "one-edit-typo", "synonym"],
      },
      metrics,
      cases,
    },
    gate: evaluatePilotTargets(metrics),
  };
};

const isDirectRun = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isDirectRun) {
  const args = process.argv.slice(2);
  const unknownArgs = args.filter((arg) => arg !== "--include-latency");
  if (unknownArgs.length > 0) {
    process.stderr.write(`${JSON.stringify({ error: "unsupported_argument" })}\n`);
    process.exitCode = 1;
  } else {
    const report = runSearchPilotComparison({
      includeLatency: args.includes("--include-latency"),
    });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (!report.gate.passed) process.exitCode = 1;
  }
}
