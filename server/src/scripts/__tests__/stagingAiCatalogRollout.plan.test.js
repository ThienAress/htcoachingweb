import { describe, expect, it } from "vitest";

import {
  PLAN_043_FIXTURE_KEY,
  STAGING_AI_CATALOG_ROLLOUT_KEY,
  STAGING_AI_CATALOG_EXERCISES,
  STAGING_AI_CATALOG_FOODS,
} from "../stagingAiCatalogRollout.contract.js";
import { createStagingAiCatalogSource } from "../stagingAiCatalogRollout.sourceContract.js";
import { buildStagingAiCatalogPlan } from "../stagingAiCatalogRollout.plan.js";

const NOW = new Date("2026-09-18T08:00:00.000Z");
const objectId = (index) => index.toString(16).padStart(24, "0");

const sourceExercises = () => STAGING_AI_CATALOG_EXERCISES.map(({ id, name }) => ({
  _id: id,
  name,
  muscleGroup: "Cơ ngực",
  description: "Bodyweight push-up không cần dụng cụ, phù hợp cho người mới bắt đầu.",
  imageUrl: `https://cdn.example.test/${id}.jpg`,
  videoUrl: "",
  instructions: [{ title: "Chuẩn bị", description: "Giữ thân người thẳng và siết cơ trung tâm." }],
  technicalDifficulty: {
    coordination: 0,
    stability: 0,
    mobility: 0,
    setup: 0,
    errorConsequence: 0,
    rationale: "Beginner bodyweight movement",
  },
}));

const sourceFoods = () => STAGING_AI_CATALOG_FOODS.map((entry, index) => ({
  _id: objectId(index + 101),
  label: entry.label,
  protein: entry.macroGroup === "protein" ? 31 : 2,
  carb: entry.macroGroup === "carb" ? 17 : 8,
  fat: entry.macroGroup === "fat" ? 15 : 1,
  calories: 100,
  nutritionBasis: "per_100g",
  source: { type: "official_database" },
}));

const targetFoods = () => STAGING_AI_CATALOG_FOODS.map((entry, index) => ({
  _id: objectId(index + 1),
  label: entry.label,
  protein: entry.macroGroup === "protein" ? 31 : 2,
  carb: entry.macroGroup === "carb" ? 17 : 8,
  fat: entry.macroGroup === "fat" ? 15 : 1,
  calories: 100,
  allergenProfile: { reviewStatus: "unreviewed" },
  _testCatalogFixture: { managed: true, key: PLAN_043_FIXTURE_KEY },
}));

const source = () => createStagingAiCatalogSource({
  exercises: sourceExercises(),
  foods: sourceFoods(),
});

const emptyTarget = () => ({
  exercises: [],
  foods: targetFoods(),
  priceObservations: [],
  exerciseReviewCounts: {},
});

const applyInMemory = (plan, target) => {
  const next = structuredClone(target);
  for (const operation of plan.operations) {
    if (operation.type === "insert_exercise") next.exercises.push(operation.document);
    if (operation.type === "update_food") {
      const food = next.foods.find(({ _id }) => String(_id) === operation.id);
      food.allergenProfile = operation.allergenProfile;
      food._stagingAiCatalogRollout = operation.marker;
    }
    if (operation.type === "insert_price") {
      next.priceObservations.push({
        _id: objectId(200 + next.priceObservations.length),
        ...operation.document,
      });
    }
  }
  return next;
};

describe("staging AI catalog rollout planner", () => {
  it("plans only five exercise inserts, three food updates and three prices", () => {
    const plan = buildStagingAiCatalogPlan({
      operation: "sync",
      source: source(),
      target: emptyTarget(),
      now: NOW,
    });
    expect(plan.summary).toEqual({
      insertExercise: 5,
      updateFood: 3,
      insertPrice: 3,
      deleteExercise: 0,
      restoreFood: 0,
      deletePrice: 0,
      unchanged: 0,
    });
  });

  it("binds reviewed allergen evidence into every managed food marker", () => {
    const plan = buildStagingAiCatalogPlan({
      operation: "sync",
      source: source(),
      target: emptyTarget(),
      now: NOW,
    });
    const foodWrites = plan.operations.filter(({ type }) => type === "update_food");

    expect(foodWrites).toHaveLength(3);
    expect(foodWrites.every(({ marker }) =>
      marker.evidence?.scope === "generic_whole_food_big_9_identity_only" &&
      marker.evidence?.crossContactStatus === "not_asserted" &&
      /^[a-f0-9]{64}$/.test(marker.evidenceHash) &&
      /^[a-f0-9]{64}$/.test(marker.priorStateHash),
    )).toBe(true);
  });

  it("is idempotent after the exact managed state has been applied", () => {
    const first = buildStagingAiCatalogPlan({
      operation: "sync", source: source(), target: emptyTarget(), now: NOW,
    });
    const rerun = buildStagingAiCatalogPlan({
      operation: "sync",
      source: source(),
      target: applyInMemory(first, emptyTarget()),
      now: NOW,
    });
    expect(rerun.operations).toEqual([]);
    expect(rerun.summary.unchanged).toBe(11);
  });

  it("fails closed when managed allergen evidence is changed after apply", () => {
    const initial = emptyTarget();
    const first = buildStagingAiCatalogPlan({
      operation: "sync", source: source(), target: initial, now: NOW,
    });
    const applied = applyInMemory(first, initial);
    applied.foods[0]._stagingAiCatalogRollout.evidence.crossContactStatus =
      "asserted_none";

    expect(() => buildStagingAiCatalogPlan({
      operation: "sync", source: source(), target: applied, now: NOW,
    })).toThrowError(/STAGING_AI_CATALOG_FOOD_MARKER_DRIFT/);
  });

  it.each([
    ["source hash", (marker) => { marker.sourceHash = "a".repeat(64); }],
    ["applied hash", (marker) => { marker.appliedHash = "b".repeat(64); }],
    ["prior state", (marker) => { marker.priorState.allergenProfile = { reviewStatus: "reviewed" }; }],
    ["prior state hash", (marker) => { marker.priorStateHash = "c".repeat(64); }],
  ])("fails closed when a managed food marker changes its %s", (_label, mutate) => {
    const initial = emptyTarget();
    const first = buildStagingAiCatalogPlan({
      operation: "sync", source: source(), target: initial, now: NOW,
    });
    const applied = applyInMemory(first, initial);
    mutate(applied.foods[0]._stagingAiCatalogRollout);

    expect(() => buildStagingAiCatalogPlan({
      operation: "sync", source: source(), target: applied, now: NOW,
    })).toThrowError(/STAGING_AI_CATALOG_FOOD_MARKER_DRIFT/);
  });

  it("rejects an extra managed price outside the exact three-row cohort", () => {
    const initial = emptyTarget();
    const first = buildStagingAiCatalogPlan({
      operation: "sync", source: source(), target: initial, now: NOW,
    });
    const applied = applyInMemory(first, initial);
    applied.priceObservations.push({
      _id: objectId(999),
      foodId: applied.foods[0]._id,
      sourceKey: "bach_hoa_xanh",
      observedAt: new Date("2026-09-17T00:00:00.000Z"),
      packGrams: 500,
      regularPriceVnd: 50_000,
      sourceUrl: "https://www.bachhoaxanh.com/foreign",
      _stagingAiCatalogRollout: structuredClone(
        applied.priceObservations[0]._stagingAiCatalogRollout,
      ),
    });

    expect(() => buildStagingAiCatalogPlan({
      operation: "rollback", target: applied, now: NOW,
    })).toThrowError(/STAGING_AI_CATALOG_PRICE_MARKER_DRIFT/);
  });

  it("fails closed on a foreign food or exercise name collision", () => {
    const foreignFood = emptyTarget();
    delete foreignFood.foods[0]._testCatalogFixture;
    expect(() => buildStagingAiCatalogPlan({
      operation: "sync", source: source(), target: foreignFood, now: NOW,
    })).toThrowError(/STAGING_AI_CATALOG_FOOD_OWNERSHIP_CONFLICT/);

    const collision = emptyTarget();
    collision.exercises.push({
      _id: objectId(99),
      name: STAGING_AI_CATALOG_EXERCISES[0].name,
    });
    expect(() => buildStagingAiCatalogPlan({
      operation: "sync", source: source(), target: collision, now: NOW,
    })).toThrowError(/STAGING_AI_CATALOG_EXERCISE_NAME_COLLISION/);
  });

  it("refuses to apply price evidence after the 90-day freshness window", () => {
    expect(() => buildStagingAiCatalogPlan({
      operation: "sync",
      source: source(),
      target: emptyTarget(),
      now: new Date("2026-12-01T00:00:00.000Z"),
    })).toThrowError(/STAGING_AI_CATALOG_PRICE_SOURCE_STALE/);
  });

  it("builds a complete rollback from owned markers and snapshots", () => {
    const sync = buildStagingAiCatalogPlan({
      operation: "sync", source: source(), target: emptyTarget(), now: NOW,
    });
    const applied = applyInMemory(sync, emptyTarget());
    expect(applied.foods.every((food) =>
      food._stagingAiCatalogRollout?.key === STAGING_AI_CATALOG_ROLLOUT_KEY,
    )).toBe(true);

    const rollback = buildStagingAiCatalogPlan({
      operation: "rollback",
      target: applied,
      now: NOW,
    });
    expect(rollback.summary).toMatchObject({
      deleteExercise: 5,
      restoreFood: 3,
      deletePrice: 3,
    });
    expect(rollback.operations.every((operation) =>
      /^[a-f0-9]{64}$/.test(operation.expectedMarkerHash),
    )).toBe(true);
  });
});
