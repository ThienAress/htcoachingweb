import { describe, expect, test } from "vitest";

import { evaluateMealScanQuality } from "../mealScanBenchmarkMetrics.js";

describe("meal scan benchmark quality gate", () => {
  test("rejects misleading narrow ranges and weak confidence calibration", () => {
    const decision = evaluateMealScanQuality({
      successful: 30,
      providerSuccessRate: 1,
      portion: { medianAbsolutePercentError: 20 },
      nutrients: {
        calories: {
          meanAbsolutePercentError: 53,
          medianAbsolutePercentError: 33,
          p90AbsolutePercentError: 70,
          rangeCoverage: 0.37,
        },
        protein: { medianAbsolutePercentError: 42, rangeCoverage: 0.33 },
        carb: { medianAbsolutePercentError: 27, rangeCoverage: 0.43 },
        fat: { medianAbsolutePercentError: 58, rangeCoverage: 0.3 },
      },
      meanIngredientRecall: 0.47,
      confidenceCalibration: {
        high: { count: 18, calorieRangeCoverage: 0.39 },
      },
    });

    expect(decision).toMatchObject({
      status: "FAIL",
      passed: false,
      failures: expect.arrayContaining([
        "maximumMeanCaloriePercentError",
        "minimumCalorieRangeCoverage",
        "minimumIngredientRecall",
        "minimumHighConfidenceCalorieRangeCoverage",
      ]),
    });
  });
});
