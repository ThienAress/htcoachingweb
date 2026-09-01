import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  runExerciseSearchBenchmark,
} from "./benchmark.mjs";
import {
  EXERCISE_FIXTURE,
  JUDGED_QUERIES,
} from "./fixture.mjs";
import {
  meanReciprocalRank,
  noResultRate,
  recallAtK,
  retrievedPrecisionAtK,
  summarizeLatency,
} from "./metrics.mjs";

const TEST_CORPUS_METADATA = Object.freeze({
  corpusId: "custom-synthetic",
  version: "v1",
  dataClassification: "synthetic-non-sensitive",
  containsCustomerData: false,
  provenance: "caller-attested-synthetic",
});

const knownEvaluations = [
  {
    relevantIds: ["exercise-a", "exercise-b"],
    resultIds: ["noise", "exercise-a", "exercise-b"],
  },
  {
    relevantIds: ["exercise-c"],
    resultIds: ["exercise-c"],
  },
  {
    relevantIds: [],
    resultIds: [],
  },
];

test("search metrics match a worked ranking fixture", () => {
  assert.deepEqual(
    {
      recallAt2: recallAtK(knownEvaluations, 2),
      retrievedPrecisionAt2: retrievedPrecisionAtK(knownEvaluations, 2),
      mrr: meanReciprocalRank(knownEvaluations),
      noResultRate: noResultRate(knownEvaluations),
      latency: summarizeLatency([4, 1, 3, 2]),
    },
    {
      recallAt2: 0.75,
      retrievedPrecisionAt2: 0.75,
      mrr: 0.75,
      noResultRate: 1 / 3,
      latency: {
        sampleCount: 4,
        averageMs: 2.5,
        p50Ms: 2,
        p95Ms: 4,
        maxMs: 4,
      },
    },
  );
});

test("current search results and quality metrics are stable across repeated runs", () => {
  const first = runExerciseSearchBenchmark();
  const second = runExerciseSearchBenchmark();

  assert.deepEqual(second, first);
  assert.equal("latencyMs" in first.metrics, false);
  assert.equal(first.cases.some((entry) => "durationMs" in entry), false);
});

test("latency is opt-in and remains report-only", () => {
  const samples = [0, 2, 2, 5];
  const report = runExerciseSearchBenchmark({
    queries: [
      { id: "first", queryClass: "exact", searchTerm: "burpee", relevantIds: ["burpee"] },
      { id: "second", queryClass: "exact", searchTerm: "plank", relevantIds: ["forearm-plank"] },
    ],
    corpusMetadata: TEST_CORPUS_METADATA,
    includeLatency: true,
    now: () => samples.shift(),
  });

  assert.deepEqual(
    {
      latencyGate: report.policy.latencyGate,
      durations: report.cases.map((entry) => entry.durationMs),
      latency: report.metrics.latencyMs,
    },
    {
      latencyGate: "report-only",
      durations: [2, 3],
      latency: { sampleCount: 2, averageMs: 2.5, p50Ms: 2, p95Ms: 3, maxMs: 3 },
    },
  );
});

test("baseline reports known substring-search gaps without making them a gate", () => {
  const report = runExerciseSearchBenchmark();
  const missedQueryIds = report.cases
    .filter((entry) => entry.outcome === "miss-at-5")
    .map((entry) => entry.id);

  assert.deepEqual(
    {
      mode: report.policy.qualityGate,
      judgedQueryCount: report.corpus.judgedQueryCount,
      queryCount: report.corpus.queryCount,
      relevantQueryNoResultRate: report.metrics.relevantQueryNoResultRate,
      expectedNoResultAccuracy: report.metrics.expectedNoResultAccuracy,
      missedQueryIds,
    },
    {
      mode: "report-only",
      judgedQueryCount: 16,
      queryCount: 16,
      relevantQueryNoResultRate: 0.5,
      expectedNoResultAccuracy: 0.5,
      missedQueryIds: [
        "vi-unaccented-d-stroke",
        "typo",
        "missing-token",
        "synonym",
        "cross-field-plank-core",
        "cross-field-pull-back",
      ],
    },
  );
});

test("case outcome treats a relevant result below rank five as a miss-at-5", () => {
  const report = runExerciseSearchBenchmark({
    queries: [{
      id: "relevant-below-five",
      queryClass: "ranking",
      relevantIds: ["burpee"],
    }],
    corpusMetadata: TEST_CORPUS_METADATA,
  });
  const [rankingCase] = report.cases;

  assert.deepEqual(
    {
      outcome: rankingCase.outcome,
      recallAt5: rankingCase.recallAt5,
      firstRelevantRank: rankingCase.firstRelevantRank,
    },
    {
      outcome: "miss-at-5",
      recallAt5: 0,
      firstRelevantRank: 11,
    },
  );
});

test("direct CLI writes one machine-readable JSON report", () => {
  const benchmarkPath = fileURLToPath(new URL("./benchmark.mjs", import.meta.url));
  const firstResult = spawnSync(process.execPath, [benchmarkPath], {
    encoding: "utf8",
  });
  const secondResult = spawnSync(process.execPath, [benchmarkPath], {
    encoding: "utf8",
  });
  const firstReport = JSON.parse(firstResult.stdout);
  const secondReport = JSON.parse(secondResult.stdout);

  assert.deepEqual(
    {
      exitCodes: [firstResult.status, secondResult.status],
      stderr: [firstResult.stderr, secondResult.stderr],
      schemaVersion: firstReport.schemaVersion,
      deterministicReport: secondReport,
      hasLatency: "latencyMs" in secondReport.metrics,
    },
    {
      exitCodes: [0, 0],
      stderr: ["", ""],
      schemaVersion: 1,
      deterministicReport: firstReport,
      hasLatency: false,
    },
  );
});

test("custom corpus requires explicit provenance metadata", () => {
  assert.throws(
    () => runExerciseSearchBenchmark({
      exercises: [{
        _id: "custom",
        name: "Custom",
        muscleGroup: "Synthetic",
        description: "Synthetic fixture",
        technicalDifficultyRating: 1,
      }],
      queries: [{
        id: "custom-query",
        queryClass: "exact",
        searchTerm: "custom",
        relevantIds: ["custom"],
      }],
    }),
    /custom corpus metadata is required/i,
  );
});

test("custom judgments cannot inherit bundled fixture provenance", () => {
  assert.throws(
    () => runExerciseSearchBenchmark({
      queries: [{
        id: "custom-query",
        queryClass: "exact",
        searchTerm: "burpee",
        relevantIds: ["burpee"],
      }],
    }),
    /custom corpus metadata is required/i,
  );
});

test("custom corpus rejects sensitive strings before producing a report", () => {
  const personalPhone = ["0912", "345", "678"].join("");
  const numericPhone = Number(["84", "912", "345", "678"].join(""));
  const personalEmail = ["member", "gmail.com"].join("@");

  for (const input of [
    {
      queries: [{
        id: personalPhone,
        queryClass: "exact",
        searchTerm: "burpee",
        relevantIds: ["burpee"],
      }],
      corpusMetadata: TEST_CORPUS_METADATA,
    },
    {
      queries: [{
        id: numericPhone,
        queryClass: "exact",
        searchTerm: "burpee",
        relevantIds: ["burpee"],
      }],
      corpusMetadata: TEST_CORPUS_METADATA,
    },
    {
      exercises: [{
        _id: "custom",
        name: "Custom",
        muscleGroup: "Synthetic",
        description: personalEmail,
        technicalDifficultyRating: 1,
      }],
      queries: [{
        id: "custom-query",
        queryClass: "exact",
        searchTerm: "custom",
        relevantIds: ["custom"],
      }],
      corpusMetadata: TEST_CORPUS_METADATA,
    },
    {
      queries: JUDGED_QUERIES,
      corpusMetadata: { ...TEST_CORPUS_METADATA, corpusId: personalPhone },
    },
  ]) {
    assert.throws(
      () => runExerciseSearchBenchmark(input),
      /custom corpus contains sensitive text/i,
    );
  }
});

test("bundled fixture and nested judgments are deeply immutable", () => {
  assert.deepEqual(
    {
      exercise: Object.isFrozen(EXERCISE_FIXTURE[0]),
      query: Object.isFrozen(JUDGED_QUERIES[0]),
      relevantIds: Object.isFrozen(JUDGED_QUERIES[0].relevantIds),
    },
    { exercise: true, query: true, relevantIds: true },
  );
  assert.throws(() => {
    JUDGED_QUERIES[0].relevantIds.push("burpee");
  }, TypeError);
});

test("custom synthetic corpus reports only closed attested provenance", () => {
  const exercises = [{
    _id: "custom",
    name: "Custom",
    muscleGroup: "Synthetic",
    description: "Synthetic fixture",
    technicalDifficultyRating: 1,
  }];
  const queries = [{
    id: "custom-query",
    queryClass: "exact",
    searchTerm: "custom",
    relevantIds: ["custom"],
  }];
  const corpusMetadata = TEST_CORPUS_METADATA;
  const report = runExerciseSearchBenchmark({
    exercises,
    queries,
    corpusMetadata,
  });

  assert.deepEqual(
    {
      fixtureVersion: report.fixtureVersion,
      corpus: report.corpus,
    },
    {
      fixtureVersion: "v1",
      corpus: {
        containsCustomerData: false,
        corpusId: "custom-synthetic",
        dataClassification: "synthetic-non-sensitive",
        provenance: "caller-attested-synthetic",
        version: "v1",
        querySet: "caller-provided-judgments",
        exerciseCount: 1,
        queryCount: 1,
        judgedQueryCount: 1,
        relevantQueryCount: 1,
        expectedNoResultQueryCount: 0,
      },
    },
  );
  assert.throws(
    () => runExerciseSearchBenchmark({
      exercises,
      queries,
      corpusMetadata: { ...corpusMetadata, note: "unbounded" },
    }),
    /custom corpus metadata is required/i,
  );
});

test("baseline CLI fails closed for unsupported arguments", () => {
  const benchmarkPath = fileURLToPath(new URL("./benchmark.mjs", import.meta.url));
  const result = spawnSync(process.execPath, [benchmarkPath, "--include-latncy"], {
    encoding: "utf8",
  });

  assert.deepEqual(
    {
      status: result.status,
      stdout: result.stdout,
      error: JSON.parse(result.stderr).error,
    },
    { status: 1, stdout: "", error: "unsupported_argument" },
  );
});
