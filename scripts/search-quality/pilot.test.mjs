import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { filterExerciseCatalog } from "../../client/src/pages/ExercisesPage/exerciseLibraryFilters.js";
import {
  EXERCISE_FIXTURE,
  FIXTURE_VERSION,
} from "./fixture.mjs";
import {
  evaluatePilotTargets,
  runSearchPilotComparison,
  searchExercisePilot,
} from "./pilot.mjs";

const productionFilterPath = fileURLToPath(new URL(
  "../../client/src/pages/ExercisesPage/exerciseLibraryFilters.js",
  import.meta.url,
));

test("pilot recovers every known baseline miss class at rank five", () => {
  const report = runSearchPilotComparison();
  const cases = new Map(report.pilot.cases.map((entry) => [entry.id, entry]));

  assert.deepEqual(
    Object.fromEntries([
      "vi-unaccented-d-stroke",
      "typo",
      "missing-token",
      "synonym",
    ].map((id) => [id, cases.get(id).top5ResultIds])),
    {
      "vi-unaccented-d-stroke": ["chest-dumbbell-press"],
      typo: ["wide-grip-lat-pulldown"],
      "missing-token": [
        "chest-dumbbell-press",
        "shoulder-dumbbell-press",
      ],
      synonym: ["basic-push-up"],
    },
  );
});

test("pilot keeps expected no-result and filter judgments safe", () => {
  const report = runSearchPilotComparison();
  const cases = new Map(report.pilot.cases.map((entry) => [entry.id, entry]));

  assert.deepEqual(
    {
      noHit: cases.get("no-hit").resultIds,
      hardNegativeStop: cases.get("hard-negative-stop").resultIds,
      hardNegativeHorse: cases.get("hard-negative-horse").resultIds,
      crossFieldPlank: cases.get("cross-field-plank-core").resultIds,
      crossFieldBack: cases.get("cross-field-pull-back").resultIds,
      filteredNoHit: cases.get("filter-no-hit").resultIds,
      muscleFilter: cases.get("filter-muscle-group").resultIds,
      difficultyFilter: cases.get("filter-difficulty").resultIds,
      unratedFilter: cases.get("filter-unrated").resultIds,
    },
    {
      noHit: [],
      hardNegativeStop: [],
      hardNegativeHorse: [],
      crossFieldPlank: ["forearm-plank"],
      crossFieldBack: ["wide-grip-lat-pulldown"],
      filteredNoHit: [],
      muscleFilter: ["hip-thrust", "glute-bridge"],
      difficultyFilter: [
        "chest-dumbbell-press",
        "shoulder-dumbbell-press",
      ],
      unratedFilter: ["forearm-plank"],
    },
  );
});

test("comparison reports the literal baseline and enforces P2 targets", () => {
  const report = runSearchPilotComparison();

  assert.deepEqual(
    {
      fixtureVersion: report.fixtureVersion,
      baseline: report.baseline.metrics,
      pilot: report.pilot.metrics,
      gate: report.gate,
    },
    {
      fixtureVersion: FIXTURE_VERSION,
      baseline: {
        recallAt5: 0.5,
        retrievedPrecisionAt5: 0.458333,
        mrr: 0.5,
        relevantQueryNoResultRate: 0.5,
        expectedNoResultAccuracy: 0.5,
        expectedNoResultFalsePositiveRate: 0.5,
      },
      pilot: {
        recallAt5: 1,
        retrievedPrecisionAt5: 1,
        mrr: 1,
        relevantQueryNoResultRate: 0,
        expectedNoResultAccuracy: 1,
        expectedNoResultFalsePositiveRate: 0,
      },
      gate: {
        passed: true,
        checks: {
          recallAt5: true,
          retrievedPrecisionAt5: true,
          mrr: true,
          relevantQueryNoResultRate: true,
          expectedNoResultAccuracy: true,
          expectedNoResultFalsePositiveRate: true,
        },
      },
    },
  );
});

test("threshold evaluator fails closed when any target is missed", () => {
  assert.deepEqual(
    evaluatePilotTargets({
      recallAt5: 0.89,
      retrievedPrecisionAt5: 0.89,
      mrr: 0.89,
      relevantQueryNoResultRate: 0.11,
      expectedNoResultAccuracy: 0.99,
      expectedNoResultFalsePositiveRate: 0.01,
    }),
    {
      passed: false,
      checks: {
        recallAt5: false,
        retrievedPrecisionAt5: false,
        mrr: false,
        relevantQueryNoResultRate: false,
        expectedNoResultAccuracy: false,
        expectedNoResultFalsePositiveRate: false,
      },
    },
  );
});

test("pilot imports production search only as an unchanged baseline contract", async () => {
  const sourceBefore = await readFile(productionFilterPath, "utf8");
  const baselineResultIds = filterExerciseCatalog(EXERCISE_FIXTURE, {
    searchTerm: "day nguc",
  }).map((exercise) => exercise._id);
  const pilotResultIds = searchExercisePilot(EXERCISE_FIXTURE, {
    searchTerm: "day nguc",
  }).map((exercise) => exercise._id);
  const sourceAfter = await readFile(productionFilterPath, "utf8");
  const report = runSearchPilotComparison();

  assert.deepEqual(
    {
      baselineResultIds,
      pilotResultIds,
      sourceUnchanged: sourceAfter === sourceBefore,
      boundary: report.runtimeBoundary,
    },
    {
      baselineResultIds: [],
      pilotResultIds: ["chest-dumbbell-press"],
      sourceUnchanged: true,
      boundary: {
        productionSource: "client/src/pages/ExercisesPage/exerciseLibraryFilters.js",
        productionFilterUsage: "baseline-only-read-only",
        productRuntimeModified: false,
      },
    },
  );
});

test("direct CLI output is machine-readable and byte-stable", () => {
  const pilotPath = fileURLToPath(new URL("./pilot.mjs", import.meta.url));
  const first = spawnSync(process.execPath, [pilotPath], { encoding: "utf8" });
  const second = spawnSync(process.execPath, [pilotPath], { encoding: "utf8" });

  assert.deepEqual(
    {
      exitCodes: [first.status, second.status],
      stderr: [first.stderr, second.stderr],
      byteStable: second.stdout === first.stdout,
      reportType: JSON.parse(first.stdout).reportType,
    },
    {
      exitCodes: [0, 0],
      stderr: ["", ""],
      byteStable: true,
      reportType: "baseline-vs-pilot",
    },
  );
});
