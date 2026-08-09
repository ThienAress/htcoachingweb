import { describe, expect, test } from "vitest";

import {
  parseNutrition5kMetadata,
  selectEvenlySpaced,
} from "../mealScanBenchmarkDataset.js";

describe("mealScanBenchmarkDataset", () => {
  test("parses Nutrition5k dish totals and repeated ingredient fields", () => {
    const rows = parseNutrition5kMetadata(
      "dish_1,300,200,10,30,20,ingr_1,white rice,120,150,1,28,3,ingr_2,chicken,80,150,9,2,17",
    );

    expect(rows.get("dish_1")).toEqual({
      totalMass: 200,
      nutrients: { calories: 300, protein: 20, carb: 30, fat: 10 },
      ingredients: ["white rice", "chicken"],
    });
  });

  test("selects a deterministic spread across ordered test ids", () => {
    expect(selectEvenlySpaced(["a", "b", "c", "d", "e"], 3)).toEqual([
      "a",
      "c",
      "e",
    ]);
  });
});
