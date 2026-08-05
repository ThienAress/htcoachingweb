import { describe, expect, test } from "vitest";

import {
  evaluateMealScanQuality,
  scoreMealScanCase,
  summarizeMealScanBenchmark,
} from "../mealScanBenchmarkMetrics.js";

const reference = {
  totalMass: 100,
  nutrients: {
    calories: 200,
    protein: 20,
    carb: 30,
    fat: 10,
  },
  ingredients: ["white rice", "chicken breast"],
};

const result = {
  confidence: "medium",
  questions: ["Was cooking oil or sauce added?"],
  total: {
    calories: { min: 180, estimate: 220, max: 240 },
    protein: { min: 12, estimate: 15, max: 22 },
    carb: { min: 24, estimate: 28, max: 34 },
    fat: { min: 7, estimate: 10, max: 13 },
  },
  items: [
    {
      label: "Rice",
      portionGrams: { min: 35, estimate: 40, max: 50 },
    },
    {
      label: "Grilled chicken",
      portionGrams: { min: 35, estimate: 40, max: 50 },
    },
  ],
};

describe("mealScanBenchmarkMetrics", () => {
  test("scores nutrition, portion, range and ingredient metrics", () => {
    const score = scoreMealScanCase(result, reference);

    expect(score).toMatchObject({
      confidence: "medium",
      portion: {
        estimate: 80,
        absoluteError: 20,
        absolutePercentError: 20,
        rangeContainsReference: true,
      },
      nutrients: {
        calories: {
          estimate: 220,
          absoluteError: 20,
          absolutePercentError: 10,
          rangeContainsReference: true,
        },
      },
      ingredientRecall: 1,
      hiddenIngredientQuestion: true,
    });
  });

  test("summarizes successful cases without treating provider errors as predictions", () => {
    const score = scoreMealScanCase(result, reference);
    const summary = summarizeMealScanBenchmark([
      { dishId: "dish_1", success: true, score },
      { dishId: "dish_2", success: true, score },
      { dishId: "dish_3", success: false, errorCode: "MEAL_SCAN_TIMEOUT" },
    ]);

    expect(summary).toMatchObject({
      attempted: 3,
      successful: 2,
      providerSuccessRate: 0.6667,
      portion: {
        meanAbsoluteError: 20,
        medianAbsolutePercentError: 20,
        rangeCoverage: 1,
      },
      nutrients: {
        calories: {
          meanAbsoluteError: 20,
          medianAbsolutePercentError: 10,
          p90AbsolutePercentError: 10,
          rangeCoverage: 1,
        },
      },
      failuresByCode: { MEAL_SCAN_TIMEOUT: 1 },
    });
  });

  test("does not approve a beta gate with fewer than 30 successful samples", () => {
    const decision = evaluateMealScanQuality({
      successful: 29,
      providerSuccessRate: 1,
    });

    expect(decision).toMatchObject({
      status: "INSUFFICIENT_DATA",
      passed: false,
    });
  });
});
