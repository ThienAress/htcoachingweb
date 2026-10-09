import { describe, expect, it, vi } from "vitest";

import { buildCanonicalMealToolRequest } from "../mealRequestConstraints.js";
import { suggestMeal } from "../tools/suggestMeal.tool.js";
import { toolRegistry } from "../tools/toolRegistry.js";

const reviewed = (contains = []) => ({
  reviewStatus: "reviewed",
  contains,
  mayContain: [],
  reviewedScopes: [],
  specificContains: [],
  sourceType: "official_database",
  sourceUrl: "https://fdc.nal.usda.gov/food-search/?query=whole%20food",
  reviewedAt: new Date("2026-09-01T00:00:00.000Z"),
});

const catalog = [
  { _id: "chicken", label: "Ức gà", protein: 31, carb: 0, fat: 3.6, allergenProfile: reviewed() },
  { _id: "egg", label: "Trứng gà", protein: 13, carb: 1, fat: 10, allergenProfile: reviewed(["egg"]) },
  { _id: "milk", label: "Sữa chua", protein: 4, carb: 7, fat: 3, allergenProfile: reviewed(["milk"]) },
  { _id: "beef", label: "Thịt bò nạc", protein: 26, carb: 0, fat: 5, allergenProfile: reviewed() },
  { _id: "rice", label: "Cơm trắng", protein: 2.7, carb: 28, fat: 0.3, allergenProfile: reviewed() },
  { _id: "oil", label: "Dầu ô liu", protein: 0, carb: 0, fat: 100, allergenProfile: reviewed() },
];

describe("canonical meal request → suggest_meal flow", () => {
  it("giữ toàn bộ loại trừ trong prompt nối bằng 'và', hoàn thiện macro bắt buộc và không đưa món bị cấm vào card", async () => {
    const canonical = buildCanonicalMealToolRequest(
      "Lập thực đơn 2.500 kcal, ít nhất 170g protein, chia 4 bữa. Tôi không ăn thịt gà, trứng và sữa.",
    );

    const { args } = canonical;
    const requiredFields = toolRegistry.suggest_meal.parameters.required;

    expect(requiredFields).toEqual([
      "targetCalories",
      "proteinGrams",
      "carbGrams",
      "fatGrams",
    ]);
    for (const field of requiredFields) {
      expect(args[field]).toSatisfy(Number.isFinite);
    }
    expect(args).toMatchObject({
      targetCalories: 2500,
      proteinGrams: 170,
      mealsPerDay: 4,
      minimumProteinGrams: 170,
      excludedFoods: ["thịt gà", "trứng", "sữa"],
    });
    expect(args.carbGrams).toBeGreaterThan(0);
    expect(args.fatGrams).toBeGreaterThan(0);
    expect(args).not.toHaveProperty("targetToleranceCalories");
    expect(args).not.toHaveProperty("excludedAllergens");
    expect(args).not.toHaveProperty("lactoseFree");

    const result = await suggestMeal(args, {
      findFoods: vi.fn().mockResolvedValue(catalog),
      getPriceMap: vi.fn().mockResolvedValue(new Map()),
    });

    expect(result.uiCard).toMatchObject({
      cardType: "meal",
      data: {
        status: "complete",
        safety: {
          excludedFoodConstraintsApplied: true,
          allergenConstraintsApplied: true,
        },
      },
    });
    const labels = result.uiCard.data.meals.flatMap((meal) =>
      meal.foods.map((food) => food.name));
    expect(labels).not.toContain("Ức gà");
    expect(labels).not.toContain("Trứng gà");
    expect(labels).not.toContain("Sữa chua");
  });

  it("routes an explicit 600 kcal single meal through server grams and excludes chicken", async () => {
    const canonical = buildCanonicalMealToolRequest(
      "Gợi ý một bữa 600 kcal, không dùng thịt gà; mọi món phải ghi rõ khối lượng gram.",
    );
    const result = await suggestMeal(canonical.args, {
      findFoods: vi.fn().mockResolvedValue(catalog),
      getPriceMap: vi.fn().mockResolvedValue(new Map()),
    });

    expect(result.uiCard.data).toMatchObject({
      status: "complete",
      targetCalories: 600,
      calorieScope: "per_meal",
    });
    const foods = result.uiCard.data.meals.flatMap((meal) => meal.foods);
    expect(foods).not.toHaveLength(0);
    expect(foods.every((food) =>
      Number.isFinite(food.amountGrams) && food.amountGrams > 0)).toBe(true);
    expect(foods.map((food) => food.foodId)).not.toContain("chicken");
    expect(result.text).not.toMatch(/\b\d+\s*quả\b/iu);
  });
});
