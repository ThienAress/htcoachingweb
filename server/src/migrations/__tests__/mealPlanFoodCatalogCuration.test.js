import mongoose from "mongoose";
import { describe, expect, it, vi } from "vitest";

import {
  MEAL_PLAN_FOOD_CURATION_LABELS,
  PROTECTED_VARIANT_LABELS,
} from "../../constants/mealPlanFoodCatalogCuration.js";
import {
  EXPECTED_FOOD_TOTAL_BEFORE_CURATION,
  applyFoodCatalogCuration,
  buildCurationReport,
  validateCurationManifest,
} from "../20260811-curate-meal-plan-food-catalog.js";

const food = (label, overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  label,
  protein: 1,
  carb: 2,
  fat: 3,
  calories: 39,
  ...overrides,
});

const productionShape = () => {
  const curated = MEAL_PLAN_FOOD_CURATION_LABELS.map((label) => food(label));
  const protectedFoods = [
    food("Quả bơ vỏ tím", { protein: 1.9, carb: 7.4, fat: 12 }),
    food("Quả bơ vỏ xanh", { protein: 1.8, carb: 7.3, fat: 8.4 }),
  ];
  const fillerCount =
    EXPECTED_FOOD_TOTAL_BEFORE_CURATION - curated.length - protectedFoods.length;
  return [
    ...curated,
    ...protectedFoods,
    ...Array.from({ length: fillerCount }, (_, index) => food(`Core ${index}`)),
  ];
};

describe("meal plan Food catalog curation", () => {
  it("keeps an exact unique manifest and protects both avocado variants", () => {
    expect(validateCurationManifest()).toEqual({
      labelCount: MEAL_PLAN_FOOD_CURATION_LABELS.length,
    });
    expect(new Set(MEAL_PLAN_FOOD_CURATION_LABELS).size).toBe(
      MEAL_PLAN_FOOD_CURATION_LABELS.length,
    );
    expect(
      PROTECTED_VARIANT_LABELS.every(
        (label) => !MEAL_PLAN_FOOD_CURATION_LABELS.includes(label),
      ),
    ).toBe(true);
  });

  it("builds a complete report without merging protected macro variants", () => {
    const report = buildCurationReport({
      allFoods: productionShape(),
      priceObservationCount: 7,
      savedMealPlanCount: 3,
    });

    expect(report.totalFoods).toBe(EXPECTED_FOOD_TOTAL_BEFORE_CURATION);
    expect(report.matchedCount).toBe(MEAL_PLAN_FOOD_CURATION_LABELS.length);
    expect(report.missingLabels).toEqual([]);
    expect(report.priceObservationCount).toBe(7);
    expect(report.savedMealPlanCount).toBe(3);
    expect(report.protectedVariants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Quả bơ vỏ tím", fat: 12 }),
        expect.objectContaining({ label: "Quả bơ vỏ xanh", fat: 8.4 }),
      ]),
    );
  });

  it("blocks apply when production total or manifest resolution drifts", async () => {
    const report = buildCurationReport({
      allFoods: productionShape().slice(1),
    });

    await expect(
      applyFoodCatalogCuration({
        report,
        connection: { startSession: vi.fn() },
      }),
    ).rejects.toMatchObject({ code: "FOOD_CURATION_PREFLIGHT_BLOCKED" });
  });

  it("backs up first and deletes prices then Foods in one transaction", async () => {
    const report = buildCurationReport({ allFoods: productionShape() });
    const events = [];
    const session = {
      startTransaction: vi.fn(() => events.push("transaction:start")),
      commitTransaction: vi.fn(async () => events.push("transaction:commit")),
      abortTransaction: vi.fn(async () => events.push("transaction:abort")),
      endSession: vi.fn(async () => events.push("session:end")),
    };
    const FoodModel = {
      countDocuments: vi.fn(() => ({
        session: vi.fn(async () => report.matchedCount),
      })),
      deleteMany: vi.fn(async () => {
        events.push("foods:delete");
        return { deletedCount: report.matchedCount };
      }),
    };
    const PriceModel = {
      deleteMany: vi.fn(async () => {
        events.push("prices:delete");
        return { deletedCount: 4 };
      }),
    };
    const backupWriter = vi.fn(async () => {
      events.push("backup");
      return {
        backupPath: ".private/food.ejson",
        checksumSha256: "a".repeat(64),
        foodCount: report.matchedCount,
        priceCount: 4,
      };
    });

    const result = await applyFoodCatalogCuration({
      report,
      FoodModel,
      PriceModel,
      connection: { startSession: vi.fn(async () => session) },
      backupWriter,
    });

    expect(result.deletedFoods).toBe(report.matchedCount);
    expect(result.deletedPriceObservations).toBe(4);
    expect(events).toEqual([
      "transaction:start",
      "backup",
      "prices:delete",
      "foods:delete",
      "transaction:commit",
      "session:end",
    ]);
  });

  it("aborts the transaction when a deleted count differs from the backup", async () => {
    const report = buildCurationReport({ allFoods: productionShape() });
    const events = [];
    const session = {
      startTransaction: vi.fn(() => events.push("transaction:start")),
      commitTransaction: vi.fn(async () => events.push("transaction:commit")),
      abortTransaction: vi.fn(async () => events.push("transaction:abort")),
      endSession: vi.fn(async () => events.push("session:end")),
    };
    const FoodModel = {
      countDocuments: vi.fn(() => ({
        session: vi.fn(async () => report.matchedCount),
      })),
      deleteMany: vi.fn(async () => ({
        deletedCount: report.matchedCount - 1,
      })),
    };
    const PriceModel = {
      deleteMany: vi.fn(async () => ({ deletedCount: 2 })),
    };

    await expect(
      applyFoodCatalogCuration({
        report,
        FoodModel,
        PriceModel,
        connection: { startSession: vi.fn(async () => session) },
        backupWriter: vi.fn(async () => ({
          backupPath: ".private/food.ejson",
          checksumSha256: "b".repeat(64),
          foodCount: report.matchedCount,
          priceCount: 2,
        })),
      }),
    ).rejects.toThrow("Food curation deleted count mismatch");

    expect(events).toEqual([
      "transaction:start",
      "transaction:abort",
      "session:end",
    ]);
  });
});
