import { describe, expect, it } from "vitest";

import {
  estimateMealPlanCost,
  filterFoodsForMealPlan,
  hasMealPlanFoodCoverage,
  validateMealPlanPreferences,
} from "../mealPlanConstraints";

const food = (overrides = {}) => ({
  protein: 20,
  carb: 0,
  fat: 1,
  allergenProfile: {
    reviewStatus: "reviewed",
    contains: [],
    mayContain: [],
  },
  ...overrides,
});

describe("Meal Plan safety constraints", () => {
  it("requires a resolved allergy declaration before generation", () => {
    expect(validateMealPlanPreferences({ allergyStatus: null })).toEqual({
      valid: false,
      code: "missing",
    });
    expect(
      validateMealPlanPreferences({
        allergyStatus: "unsure",
        allergens: [],
        budgetVndPerDay: null,
      }),
    ).toEqual({ valid: false, code: "unsure" });
  });

  it("blocks automatic generation when a free-text allergen cannot be mapped safely", () => {
    expect(
      validateMealPlanPreferences({
        allergyStatus: "declared",
        allergens: ["fish"],
        otherAllergenText: "Ốc biển",
        budgetVndPerDay: null,
      }),
    ).toEqual({ valid: false, code: "other" });
  });

  it("hides all food suggestions while another allergen is unresolved", () => {
    expect(
      filterFoodsForMealPlan([food({ label: "reviewed-food" })], {
        allergyStatus: "declared",
        allergens: [],
        otherAllergenText: "ốc biển",
      }),
    ).toEqual([]);
  });

  it("accepts recognized specific foods separated only by spaces", () => {
    expect(
      validateMealPlanPreferences({
        allergyStatus: "declared",
        allergens: [],
        otherAllergenText: "gà bò cá",
        budgetVndPerDay: null,
      }),
    ).toEqual({ valid: true, code: null });
  });

  it("rejects periods used between foods", () => {
    expect(
      validateMealPlanPreferences({
        allergyStatus: "declared",
        allergens: [],
        otherAllergenText: "bò.gà.heo",
        budgetVndPerDay: null,
      }),
    ).toEqual({ valid: false, code: "period_separator" });
  });

  it("rejects generic meat before generation", () => {
    expect(
      validateMealPlanPreferences({
        allergyStatus: "declared",
        allergens: [],
        otherAllergenText: "thịt",
        budgetVndPerDay: null,
      }),
    ).toEqual({ valid: false, code: "generic_meat" });
  });

  it("filters recognized specific foods only with reviewed metadata", () => {
    const reviewed = (specificContains = [], contains = []) =>
      food({
        allergenProfile: {
          reviewStatus: "reviewed",
          reviewedScopes: ["specific_foods"],
          contains,
          mayContain: [],
          specificContains,
        },
      });
    const foods = [
      { ...reviewed(), label: "safe" },
      { ...reviewed(["chicken"]), label: "chicken" },
      { ...reviewed([], ["fish"]), label: "fish" },
      food({ label: "missing-specific-review" }),
    ];

    expect(
      filterFoodsForMealPlan(foods, {
        allergyStatus: "declared",
        allergens: [],
        otherAllergenText: "gà bò cá",
      }).map(({ label }) => label),
    ).toEqual(["safe"]);
  });

  it("hides every food suggestion while the meat type is still generic", () => {
    expect(
      filterFoodsForMealPlan(
        [food({ label: "reviewed-food" })],
        {
          allergyStatus: "declared",
          allergens: [],
          otherAllergenText: "Tất cả thịt trên cạn",
        },
      ),
    ).toEqual([]);
  });

  it("keeps the optional budget valid when left blank", () => {
    expect(
      validateMealPlanPreferences({
        allergyStatus: "none_known",
        allergens: [],
        otherAllergenText: "",
        budgetVndPerDay: null,
      }),
    ).toEqual({ valid: true, code: null });
  });

  it("fails closed for unreviewed, contains and mayContain foods", () => {
    const foods = [
      food({ label: "safe" }),
      food({ label: "contains", allergenProfile: { reviewStatus: "reviewed", contains: ["milk"], mayContain: [] } }),
      food({ label: "cross", allergenProfile: { reviewStatus: "reviewed", contains: [], mayContain: ["milk"] } }),
      food({ label: "unknown", allergenProfile: { reviewStatus: "unreviewed", contains: [], mayContain: [] } }),
    ];

    expect(
      filterFoodsForMealPlan(foods, {
        allergyStatus: "declared",
        allergens: ["milk"],
      }).map(({ label }) => label),
    ).toEqual(["safe"]);
  });

  it("requires protein, carb and fat coverage after allergy exclusion", () => {
    expect(
      hasMealPlanFoodCoverage([
        food(),
        food({ protein: 0, carb: 20, fat: 1 }),
        food({ protein: 0, carb: 0, fat: 20 }),
      ]),
    ).toBe(true);
    expect(hasMealPlanFoodCoverage([food()])).toBe(false);
  });

  it("estimates a TP.HCM range and never treats partial coverage as exact", () => {
    const priced = (amount, low, typical, high) => ({
      amount,
      marketPrice: {
        coverageStatus: "sufficient",
        lowVndPer100g: low,
        typicalVndPer100g: typical,
        highVndPer100g: high,
        asOf: "2026-08-10T00:00:00.000Z",
      },
    });
    const meals = [
      {
        proteinFood: priced(100, 10_000, 12_000, 14_000),
        carbFood: priced(200, 2_000, 3_000, 4_000),
        fatFood: priced(20, 20_000, 25_000, 30_000),
      },
    ];

    expect(estimateMealPlanCost(meals, 30_000)).toMatchObject({
      coverageStatus: "sufficient",
      lowVndPerDay: 18_000,
      typicalVndPerDay: 23_000,
      highVndPerDay: 28_000,
      budgetStatus: "within",
      region: "ho_chi_minh",
    });
    meals[0].fatFood.marketPrice.coverageStatus = "insufficient";
    expect(estimateMealPlanCost(meals, 30_000).coverageStatus).toBe(
      "insufficient",
    );
  });
});
