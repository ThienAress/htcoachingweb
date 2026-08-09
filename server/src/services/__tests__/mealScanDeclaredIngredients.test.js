import { describe, expect, test, vi } from "vitest";

import {
  excludeDeclaredIngredientDuplicates,
  mergeDeclaredIngredientsIntoResult,
  resolveDeclaredIngredients,
} from "../mealScanDeclaredIngredients.js";

const range = (value) => ({ min: value, estimate: value, max: value });

const baseResult = {
  total: {
    calories: { min: 250, estimate: 625, max: 1250 },
    protein: { min: 16.2, estimate: 46.4, max: 102.1 },
    carb: { min: 24.5, estimate: 72, max: 159 },
    fat: { min: 3.2, estimate: 14.6, max: 40.9 },
  },
  items: [],
};

describe("Meal Scan declared ingredient nutrition", () => {
  test("converts 30 g cooking oil into exact fat-derived nutrition", async () => {
    const ingredients = await resolveDeclaredIngredients([
      { name: "dầu", grams: 30 },
    ]);

    expect(ingredients).toEqual([expect.objectContaining({
      name: "dầu",
      grams: 30,
      status: "included",
      includedInTotal: true,
      sourceType: "macro_formula",
      calories: range(270),
      protein: range(0),
      carb: range(0),
      fat: range(30),
    })]);
  });

  test("scales a verified per-100-g Food DB match", async () => {
    const findFoodsByLabels = vi.fn().mockResolvedValue([{
      label: "Bơ đậu phộng",
      calories: 588,
      protein: 25,
      carb: 20,
      fat: 50,
      nutritionBasis: "per_100g",
      source: { type: "manual_verified" },
    }]);

    const ingredients = await resolveDeclaredIngredients(
      [{ name: "Bơ đậu phộng", grams: 25 }],
      { findFoodsByLabels },
    );

    expect(ingredients[0]).toMatchObject({
      status: "included",
      sourceType: "food_database",
      calories: range(147),
      protein: range(6.3),
      carb: range(5),
      fat: range(12.5),
    });
  });

  test("marks unknown or legacy ingredients as not included", async () => {
    const findFoodsByLabels = vi.fn().mockResolvedValue([{
      label: "Sốt bí mật",
      calories: 100,
      protein: 1,
      carb: 10,
      fat: 6,
      nutritionBasis: "per_100g",
      source: { type: "legacy_unknown" },
    }]);

    const ingredients = await resolveDeclaredIngredients(
      [{ name: "Sốt bí mật", grams: 20 }],
      { findFoodsByLabels },
    );

    expect(ingredients[0]).toMatchObject({
      status: "unresolved",
      includedInTotal: false,
      sourceType: "unresolved",
    });
  });

  test("adds resolved nutrition to every total bound", async () => {
    const declared = await resolveDeclaredIngredients([
      { name: "Dầu ô liu", grams: 30 },
    ]);

    const result = mergeDeclaredIngredientsIntoResult(baseResult, declared);

    expect(result.total).toMatchObject({
      calories: { min: 520, estimate: 895, max: 1520 },
      fat: { min: 33.2, estimate: 44.6, max: 70.9 },
    });
  });

  test("removes an explicit provider item that duplicates a declaration", async () => {
    const declared = await resolveDeclaredIngredients([
      { name: "Dầu ô liu", grams: 15 },
    ]);
    const raw = {
      items: [{ label: "Olive oil" }, { label: "Cơm trắng" }],
    };

    expect(excludeDeclaredIngredientDuplicates(raw, declared).items).toEqual([
      { label: "Cơm trắng" },
    ]);
  });
});
