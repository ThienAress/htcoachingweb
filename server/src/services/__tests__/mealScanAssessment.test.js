import { describe, expect, test } from "vitest";

import {
  getMealScanAssessmentError,
  normalizeMealScanAssessment,
  normalizeMealScanDataSource,
  shouldForceLowMealScanConfidence,
} from "../mealScanAssessment.js";

describe("meal scan assessment contract", () => {
  test("normalizes an open-world packaged-food assessment", () => {
    expect(
      normalizeMealScanAssessment({
        analysisStatus: "ok",
        imageAssessment: {
          foodVisible: true,
          quality: "good",
          scenario: "packaged_food",
          servingsVisible: 1,
          nutritionLabelVisible: true,
          barcodeVisible: true,
          issues: ["Front label only"],
        },
      }),
    ).toEqual({
      status: "ok",
      foodVisible: true,
      quality: "good",
      scenario: "packaged_food",
      servingsVisible: 1,
      nutritionLabelVisible: true,
      barcodeVisible: true,
      issues: ["Front label only"],
    });
  });

  test("maps non-food and unusable images to actionable error contracts", () => {
    expect(
      getMealScanAssessmentError(
        normalizeMealScanAssessment({ analysisStatus: "non_food" }),
      ),
    ).toMatchObject({ code: "MEAL_SCAN_NO_FOOD", status: 422 });
    expect(
      getMealScanAssessmentError(
        normalizeMealScanAssessment({
          analysisStatus: "retake",
          imageAssessment: { quality: "poor" },
        }),
      ),
    ).toMatchObject({ code: "MEAL_SCAN_RETAKE_REQUIRED", status: 422 });
  });

  test("forces shared or multi-serving meals to low confidence", () => {
    expect(
      shouldForceLowMealScanConfidence(
        normalizeMealScanAssessment({
          imageAssessment: {
            scenario: "shared_meal",
            servingsVisible: 4,
          },
        }),
      ),
    ).toBe(true);
  });

  test("fails unknown item sources back to visual estimate", () => {
    expect(normalizeMealScanDataSource("untrusted_source")).toBe(
      "visual_estimate",
    );
  });
});
