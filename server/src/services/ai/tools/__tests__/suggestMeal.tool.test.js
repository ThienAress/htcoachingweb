import { describe, expect, it } from "vitest";

import { suggestMeal } from "../suggestMeal.tool.js";

const catalog = [
  { _id: "chicken", label: "Ức gà", protein: 31, carb: 0, fat: 3.6 },
  { _id: "rice", label: "Cơm trắng", protein: 2.7, carb: 28, fat: 0.3 },
  { _id: "oil", label: "Dầu ô liu", protein: 0, carb: 0, fat: 100 },
];
const reviewed = (contains = []) => ({
  reviewStatus: "reviewed",
  contains,
  mayContain: [],
  sourceType: "official_database",
  sourceUrl: "https://fdc.nal.usda.gov/food-search/",
  reviewedAt: new Date("2026-09-01"),
});
const safeCatalog = [
  { ...catalog[0], allergenProfile: reviewed() },
  { ...catalog[1], allergenProfile: reviewed() },
  { ...catalog[2], allergenProfile: reviewed() },
  { _id: "whey", label: "Whey protein", protein: 80, carb: 8, fat: 6, allergenProfile: reviewed(["milk"]) },
  { _id: "peanut", label: "Đậu phộng", protein: 26, carb: 16, fat: 49, allergenProfile: reviewed(["peanut"]) },
];

describe("suggest_meal deterministic nutrition contract", () => {
  it("returns a structured card whose totals satisfy the server nutrition invariants", async () => {
    const result = await suggestMeal(
      {
        targetCalories: 2500,
        proteinGrams: 170,
        carbGrams: 300,
        fatGrams: 70,
        mealsPerDay: 4,
        targetToleranceCalories: 100,
        minimumProteinGrams: 170,
      },
      { findFoods: async () => catalog },
    );

    expect(result.uiCard).toMatchObject({ cardType: "meal" });
    expect(result.uiCard.data.status).toBe("complete");
    expect(result.uiCard.data.meals).toHaveLength(4);
    expect(
      Math.abs(result.uiCard.data.totals.calories - 2500),
    ).toBeLessThanOrEqual(100);
    expect(result.uiCard.data.totals.protein).toBeGreaterThanOrEqual(170);
    expect(result.uiCard.data.totals.calories).toBe(
      Number(
        (
          4 * result.uiCard.data.totals.protein +
          4 * result.uiCard.data.totals.carb +
          9 * result.uiCard.data.totals.fat
        ).toFixed(1),
      ),
    );
  });

  it("fails closed for unresolved exclusions and does not invent a safe catalog", async () => {
    const result = await suggestMeal(
      {
        targetCalories: 2500,
        proteinGrams: 170,
        carbGrams: 300,
        fatGrams: 70,
        mealsPerDay: 4,
        excludedFoods: ["món bí ẩn"],
      },
      { findFoods: async () => safeCatalog },
    );

    expect(result.uiCard.data).toMatchObject({
      status: "missing_data",
      reason: "excluded_food_unverifiable",
    });
  });

  it("reports budget as unverified without current price provenance", async () => {
    const result = await suggestMeal(
      {
        targetCalories: 2500,
        proteinGrams: 170,
        carbGrams: 300,
        fatGrams: 70,
        mealsPerDay: 4,
        budgetVndPerDay: 150000,
      },
      {
        findFoods: async () => safeCatalog,
        getPriceMap: async () => new Map(),
      },
    );

    expect(result.uiCard.data.price).toMatchObject({ status: "unverified" });
    expect(result.text).toMatch(/ngân sách chưa thể xác minh/i);
  });

  it("keeps fixed foods unchanged during a scoped follow-up", async () => {
    const previousMealPlan = {
      status: "complete",
      nutritionMethod: "server_calculated_4p_4c_9f",
      meals: Array.from({ length: 4 }, () => ({
        label: "Bữa",
        foods: [
          { foodId: "chicken", name: "Ức gà", amountGrams: 120 },
          { foodId: "rice", name: "Cơm trắng", amountGrams: 220 },
          { foodId: "oil", name: "Dầu ô liu", amountGrams: 15 },
        ],
      })),
    };
    const result = await suggestMeal(
      {
        targetCalories: 2200,
        proteinGrams: 170,
        carbGrams: 250,
        fatGrams: 70,
        mealsPerDay: 4,
        minimumProteinGrams: 170,
        allowedAdjustmentFoodIds: ["rice", "oil"],
      },
      { findFoods: async () => safeCatalog, previousMealPlan },
    );

    expect(result.uiCard.data.status).toBe("complete");
    expect(result.uiCard.data.meals.flatMap((meal) => meal.foods)
      .filter((food) => food.foodId === "chicken")
      .every((food) => food.amountGrams === 120)).toBe(true);
  });
});
