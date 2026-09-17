import { describe, expect, it } from "vitest";

import { buildCanonicalMealToolRequest } from "../mealRequestConstraints.js";

const priorPlan = {
  status: "complete",
  meals: [{
    label: "Bữa sáng",
    foods: [
      { foodId: "chicken", name: "Ức gà", amountGrams: 137.5, macros: { protein: 42.6, carb: 0, fat: 5 } },
      { foodId: "rice", name: "Cơm trắng", amountGrams: 250, macros: { protein: 6.8, carb: 70, fat: 0.8 } },
      { foodId: "oil", name: "Dầu ô liu", amountGrams: 12.5, macros: { protein: 0, carb: 0, fat: 12.5 } },
    ],
  }],
};

describe("canonical meal request constraints", () => {
  it("lấy hard constraints từ prompt 2.500 kcal thay vì tin args model", () => {
    const request = buildCanonicalMealToolRequest(
      "Lập cho tôi thực đơn món Việt trong 1 ngày khoảng 2.500 kcal (sai số tối đa 100 kcal), ít nhất 170g protein, chia 4 bữa. Tôi không dùng whey, không dung nạp lactose, dị ứng đậu phộng và ngân sách tối đa 150.000đ/ngày.",
      {
        targetCalories: 1800,
        proteinGrams: 100,
        carbGrams: 200,
        fatGrams: 50,
        mealsPerDay: 3,
        minimumProteinGrams: 100,
      },
    );

    expect(request.args).toMatchObject({
      targetCalories: 2500,
      targetToleranceCalories: 100,
      proteinGrams: 170,
      minimumProteinGrams: 170,
      mealsPerDay: 4,
      excludedFoods: ["whey"],
      excludedAllergens: ["milk", "peanut"],
      lactoseFree: true,
      budgetVndPerDay: 150000,
    });
    expect(4 * request.args.proteinGrams + 4 * request.args.carbGrams + 9 * request.args.fatGrams)
      .toBeCloseTo(2500, 0);
  });

  it("follow-up chỉ allowlist cơm và dầu từ structured plan", () => {
    const request = buildCanonicalMealToolRequest(
      "Giữ nguyên các món và ít nhất 170g protein của thực đơn vừa rồi, nhưng hạ tổng xuống khoảng 2.200 kcal chỉ bằng cách đổi lượng cơm và dầu.",
      {
        targetCalories: 999,
        proteinGrams: 10,
        carbGrams: 10,
        fatGrams: 10,
        allowedAdjustmentFoodIds: ["chicken"],
      },
      {
        targetCalories: 2500,
        proteinGrams: 170,
        carbGrams: 280,
        fatGrams: 78,
        mealsPerDay: 4,
        plan: priorPlan,
      },
    );

    expect(request).toMatchObject({
      scopedAdjustment: true,
      previousMealPlan: priorPlan,
      args: {
        targetCalories: 2200,
        minimumProteinGrams: 170,
        mealsPerDay: 4,
        allowedAdjustmentFoodIds: ["rice", "oil"],
        allowedAdjustmentFoodNames: ["Cơm trắng", "Dầu ô liu"],
      },
    });
    expect(request.args.allowedAdjustmentFoodIds).not.toContain("chicken");
  });

  it("giữ constraint dị ứng dạng allowlist từ prompt, model args và memory", () => {
    const request = buildCanonicalMealToolRequest(
      "Giữ thực đơn nhưng tôi dị ứng sữa và chỉ đổi lượng cơm.",
      {
        targetCalories: 2200,
        proteinGrams: 170,
        carbGrams: 250,
        fatGrams: 60,
        excludedAllergens: ["soy", "not-an-allergen"],
      },
      {
        targetCalories: 2500,
        proteinGrams: 170,
        carbGrams: 280,
        fatGrams: 78,
        mealsPerDay: 4,
        excludedAllergens: ["peanut"],
        excludedFoods: ["whey"],
        lactoseFree: true,
        plan: priorPlan,
      },
    );

    expect(request.args).toMatchObject({
      excludedAllergens: ["peanut", "soy", "milk"],
      excludedFoods: ["whey"],
      lactoseFree: true,
    });
    expect(request.args.excludedAllergens).not.toContain("not-an-allergen");
  });

  it("dừng adjustment scope trước mệnh đề giữ nguyên", () => {
    const request = buildCanonicalMealToolRequest(
      "Hạ còn 2.200 kcal, chỉ đổi cơm và dầu, giữ nguyên lượng gà.",
      {},
      {
        targetCalories: 2500,
        proteinGrams: 170,
        carbGrams: 280,
        fatGrams: 78,
        mealsPerDay: 4,
        plan: priorPlan,
      },
    );

    expect(request.args.allowedAdjustmentFoodIds).toEqual(["rice", "oil"]);
  });
});
