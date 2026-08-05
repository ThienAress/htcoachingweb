import { describe, expect, test } from "vitest";

import { normalizeMealScanResult } from "../mealScanResult.js";

const item = {
  label: "Cơm trắng",
  portionGrams: { min: 95, estimate: 100, max: 105 },
  calories: { min: 125, estimate: 130, max: 135 },
  protein: { min: 2.8, estimate: 3, max: 3.2 },
  carb: { min: 27, estimate: 28, max: 29 },
  fat: { min: 9, estimate: 10, max: 11 },
  note: "Khẩu phần ước tính.",
  needsConfirmation: false,
};

const rawResult = (overrides = {}) => ({
  mealName: "Cơm",
  confidence: "high",
  confidenceReasons: ["Món ăn nhìn rõ."],
  scaleReferenceVisible: false,
  items: [item],
  questions: [],
  ...overrides,
});

describe("meal scan confidence calibration", () => {
  test("downgrades no-scale estimates and applies honest uncertainty floors", () => {
    const result = normalizeMealScanResult(rawResult(), "vi");

    expect(result).toMatchObject({
      confidence: "low",
      confidenceReasons: [
        expect.stringContaining("vật chuẩn"),
        "Món ăn nhìn rõ.",
      ],
      items: [{
        portionGrams: { min: 50, estimate: 100, max: 175 },
        calories: { min: 52, estimate: 130, max: 260 },
        protein: { min: 1, estimate: 3, max: 6.6 },
        carb: { min: 9.8, estimate: 28, max: 61.6 },
        fat: { min: 2.5, estimate: 10, max: 28 },
      }],
    });
  });

  test("caps model-claimed scale at medium without user verification", () => {
    const result = normalizeMealScanResult(
      rawResult({ scaleReferenceVisible: true }),
      "en",
    );

    expect(result).toMatchObject({
      confidence: "medium",
      confidenceReasons: expect.arrayContaining([
        expect.stringContaining("externally verified"),
      ]),
      items: [{
        portionGrams: { min: 65, estimate: 100, max: 145 },
        calories: { min: 78, estimate: 130, max: 208 },
      }],
    });
  });

  test("never inflates a provider medium result", () => {
    const result = normalizeMealScanResult(
      rawResult({
        scaleReferenceVisible: true,
        confidence: "medium",
        items: [{ ...item, needsConfirmation: true }],
      }),
      "en",
    );

    expect(result.confidence).toBe("medium");
  });
});
