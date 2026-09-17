import { describe, expect, it, vi } from "vitest";

import { suggestMeal } from "../suggestMeal.tool.js";

const reviewed = (contains = [], specificContains = []) => ({
  reviewStatus: "reviewed",
  contains,
  mayContain: [],
  reviewedScopes: specificContains.length ? ["specific_foods"] : [],
  specificContains,
  sourceType: "official_database",
  reviewedAt: new Date("2026-09-01"),
});

const catalog = [
  { _id: "chicken", label: "Ức gà", protein: 31, carb: 0, fat: 3.6, allergenProfile: reviewed() },
  { _id: "rice", label: "Cơm trắng", protein: 2.7, carb: 28, fat: 0.3, allergenProfile: reviewed() },
  { _id: "oil", label: "Dầu ô liu", protein: 0, carb: 0, fat: 100, allergenProfile: reviewed() },
  { _id: "whey", label: "Whey protein", protein: 80, carb: 8, fat: 6, allergenProfile: reviewed(["milk"]) },
  { _id: "peanut", label: "Đậu phộng", protein: 26, carb: 16, fat: 49, allergenProfile: reviewed(["peanut"]) },
  { _id: "milk", label: "Sữa chua", protein: 4, carb: 7, fat: 3, allergenProfile: reviewed(["milk"]) },
];

const params = {
  targetCalories: 2500,
  proteinGrams: 170,
  carbGrams: 300,
  fatGrams: 70,
  mealsPerDay: 4,
  targetToleranceCalories: 100,
  minimumProteinGrams: 170,
};

const priceMap = (coverageStatus = "sufficient") => new Map(
  catalog.map((food) => [food._id, {
    coverageStatus,
    typicalVndPer100g: coverageStatus === "sufficient" ? 10_000 : null,
    currency: "VND",
    asOf: coverageStatus === "sufficient" ? new Date("2026-09-01") : null,
  }]),
);

const toolContext = (overrides = {}) => ({
  findFoods: vi.fn().mockResolvedValue(catalog),
  getPriceMap: vi.fn().mockResolvedValue(priceMap()),
  ...overrides,
});

describe("suggest_meal deterministic nutrition contract", () => {
  it("trả 4 bữa 2.500 ±100 kcal, ít nhất 170g protein và kcal khớp 4P + 4C + 9F", async () => {
    const result = await suggestMeal(params, toolContext());

    expect(result.uiCard.data).toMatchObject({
      targetCalories: 2500,
      meals: expect.arrayContaining([expect.objectContaining({ foods: expect.any(Array), totals: expect.any(Object) })]),
    });
    expect(result.uiCard.data.meals).toHaveLength(4);
    expect(Math.abs(result.uiCard.data.totals.calories - 2500)).toBeLessThanOrEqual(100);
    expect(result.uiCard.data.totals.protein).toBeGreaterThanOrEqual(170);
    expect(result.uiCard.data.totals.calories).toBe(
      Number((4 * result.uiCard.data.totals.protein + 4 * result.uiCard.data.totals.carb + 9 * result.uiCard.data.totals.fat).toFixed(1)),
    );
    const foods = result.uiCard.data.meals.flatMap((meal) => meal.foods);
    const itemMacros = foods.reduce((total, food) => ({
      protein: total.protein + food.macros.protein,
      carb: total.carb + food.macros.carb,
      fat: total.fat + food.macros.fat,
    }), { protein: 0, carb: 0, fat: 0 });
    expect(Object.fromEntries(Object.entries(itemMacros)
      .map(([key, value]) => [key, Number(value.toFixed(1))])))
      .toEqual(result.uiCard.data.macros);
    expect(Math.abs(
      foods.reduce((total, food) => total + food.calories, 0) -
      result.uiCard.data.totals.calories,
    )).toBeLessThanOrEqual(1);
    expect(Math.abs(
      result.uiCard.data.meals.reduce((total, meal) => total + meal.totals.calories, 0) -
      result.uiCard.data.totals.calories,
    )).toBeLessThanOrEqual(1);
  });

  it("có output deterministic cùng input và catalog", async () => {
    const first = await suggestMeal(params, toolContext());
    const second = await suggestMeal(params, toolContext());

    expect(first.uiCard.data.meals).toEqual(second.uiCard.data.meals);
  });

  it("bù sai số làm tròn để giữ protein tối thiểu từ kết quả TDEE", async () => {
    const result = await suggestMeal({
      targetCalories: 2333,
      proteinGrams: 175,
      carbGrams: 204,
      fatGrams: 91,
      mealsPerDay: 4,
      targetToleranceCalories: 100,
      minimumProteinGrams: 175,
    }, toolContext());

    expect(result.uiCard.data.status).toBe("complete");
    expect(result.uiCard.data.totals.protein).toBeGreaterThanOrEqual(175);
    expect(Math.abs(result.uiCard.data.totals.calories - 2333)).toBeLessThanOrEqual(100);
  });

  it("fail closed với food chưa đủ metadata khi có peanut, lactose và whey exclusion", async () => {
    const result = await suggestMeal({
      ...params,
      excludedAllergens: ["peanut"],
      excludedFoods: ["whey"],
      lactoseFree: true,
    }, toolContext());

    expect(result.uiCard.data.status).toBe("complete");
    const labels = result.uiCard.data.meals.flatMap((meal) => meal.foods.map((food) => food.name.toLowerCase()));
    expect(new Set(labels)).toEqual(new Set(["ức gà", "cơm trắng", "dầu ô liu"]));
  });

  it("không claim ngân sách đã xác minh khi thiếu price provenance", async () => {
    const result = await suggestMeal({ ...params, budgetVndPerDay: 150_000 }, toolContext({
      getPriceMap: vi.fn().mockResolvedValue(priceMap("insufficient")),
    }));

    expect(result.uiCard.data.price).toMatchObject({ status: "unverified" });
    expect(result.text).toMatch(/ngân sách chưa thể xác minh/i);
  });

  it("fail closed thay vì dùng Food chưa kiểm duyệt khi ràng buộc dị ứng cần metadata", async () => {
    const result = await suggestMeal({
      ...params,
      excludedAllergens: ["peanut"],
    }, toolContext({
      findFoods: vi.fn().mockResolvedValue([
        catalog[0],
        catalog[1],
        { _id: "unknown-fat", label: "Dầu bí mật", protein: 0, carb: 0, fat: 100 },
      ]),
    }));

    expect(result.uiCard.data).toMatchObject({ status: "missing_data", reason: "safety_metadata_missing" });
  });

  it("trả missing-data an toàn khi minimum protein khiến mục tiêu kcal bất khả thi", async () => {
    const result = await suggestMeal({
      ...params,
      targetCalories: 1000,
      minimumProteinGrams: 400,
    }, toolContext());

    expect(result.uiCard.data).toMatchObject({ status: "missing_data", reason: "impossible_constraints", meals: [] });
  });

  it("follow-up 2.500 xuống 2.200 chỉ đổi cơm và dầu, giữ nguyên ức gà cùng protein tối thiểu", async () => {
    const previousMealPlan = {
      status: "complete",
      meals: Array.from({ length: 4 }, () => ({
        label: "Bữa",
        foods: [
          { foodId: "chicken", name: "Ức gà", amountGrams: 137.5, macros: { protein: 42.6, carb: 0, fat: 5 } },
          { foodId: "rice", name: "Cơm trắng", amountGrams: 250, macros: { protein: 6.8, carb: 70, fat: 0.8 } },
          { foodId: "oil", name: "Dầu ô liu", amountGrams: 12.5, macros: { protein: 0, carb: 0, fat: 12.5 } },
        ],
      })),
    };
    const result = await suggestMeal({
      ...params,
      targetCalories: 2200,
      allowedAdjustmentFoodIds: ["rice", "oil"],
    }, toolContext({ previousMealPlan }));

    expect(result.uiCard.data.status).toBe("complete");
    expect(Math.abs(result.uiCard.data.totals.calories - 2200)).toBeLessThanOrEqual(100);
    expect(result.uiCard.data.totals.protein).toBeGreaterThanOrEqual(170);
    expect(result.uiCard.data.meals.flatMap((meal) => meal.foods)
      .filter((food) => food.foodId === "chicken")
      .every((food) => food.amountGrams === 137.5)).toBe(true);
    expect(result.uiCard.data.adjustments).toEqual(expect.arrayContaining([
      expect.objectContaining({ foodId: "rice", beforeAmountGrams: 250, afterAmountGrams: expect.any(Number) }),
      expect.objectContaining({ foodId: "oil", beforeAmountGrams: 12.5, afterAmountGrams: expect.any(Number) }),
    ]));
    expect(result.text).toMatch(/Cơm trắng: 250g → \d+(?:\.\d+)?g/);
    expect(result.text).toMatch(/Dầu ô liu: 12\.5g → \d+(?:\.\d+)?g/);
    expect(result.text).not.toMatch(/Ức gà: 137\.5g →/);
  });

  it("không tự dựng lại thực đơn khi follow-up scoped thiếu structured plan cũ", async () => {
    const result = await suggestMeal({
      ...params,
      targetCalories: 2200,
      allowedAdjustmentFoodNames: ["Cơm trắng", "Dầu ô liu"],
    }, toolContext());

    expect(result.uiCard.data).toMatchObject({
      status: "missing_data",
      reason: "scoped_adjustment_missing_plan",
      meals: [],
    });
  });

  it("fail closed khi follow-up thêm dị ứng nhưng plan cũ còn món vi phạm", async () => {
    const previousMealPlan = {
      status: "complete",
      meals: [{
        label: "Bữa sáng",
        foods: [
          { foodId: "chicken", name: "Ức gà", amountGrams: 137.5, macros: { protein: 42.6, carb: 0, fat: 5 } },
          { foodId: "rice", name: "Cơm trắng", amountGrams: 250, macros: { protein: 6.8, carb: 70, fat: 0.8 } },
          { foodId: "peanut", name: "Đậu phộng", amountGrams: 12.5, macros: { protein: 3.3, carb: 2, fat: 6.1 } },
        ],
      }],
    };
    const result = await suggestMeal({
      ...params,
      targetCalories: 2200,
      excludedAllergens: ["peanut"],
      allowedAdjustmentFoodIds: ["rice", "peanut"],
    }, toolContext({ previousMealPlan }));

    expect(result.uiCard.data).toMatchObject({
      status: "missing_data",
      reason: "scoped_adjustment_safety_conflict",
      meals: [],
    });
  });
});
