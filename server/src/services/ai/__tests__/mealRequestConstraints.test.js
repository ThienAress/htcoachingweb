import { describe, expect, it } from "vitest";

import { buildCanonicalMealToolRequest } from "../mealRequestConstraints.js";

describe("single-meal calorie scope", () => {
  it("explains the unsupported 450 kcal breakfast without replacing the target", () => {
    const request = buildCanonicalMealToolRequest(
      "Gợi ý một bữa sáng khoảng 450 kcal và ít nhất 30g protein, không dùng trứng; ghi món và grams.",
      { targetCalories: 550, proteinGrams: 30, carbGrams: 70, fatGrams: 10 },
    );
    expect(request.validationMessage).toContain("500");
    expect(request.args.targetCalories).toBeNull();
  });
  it("derives flexible macros for the 500 kcal breakfast when only minimum protein is specified", () => {
    const request = buildCanonicalMealToolRequest(
      "Gợi ý cho tôi một bữa sáng món Việt khoảng 500 kcal, tối thiểu 30g protein và dễ chuẩn bị",
    );
    expect(request.args).toMatchObject({
      targetCalories: 500, calorieScope: "per_meal", mealsPerDay: 1,
      proteinGrams: 30, minimumProteinGrams: 30,
    });
    expect(request.args.carbGrams).toBeGreaterThan(0);
    expect(request.args.fatGrams).toBeGreaterThan(0);
    expect(Math.abs(4 * request.args.proteinGrams + 4 * request.args.carbGrams +
      9 * request.args.fatGrams - 500)).toBeLessThanOrEqual(1);
  });
  it("fills only the missing flexible macro for a per-meal request", () => {
    const request = buildCanonicalMealToolRequest(
      "Cho tôi một bữa tối 500 kcal, 30g protein và 50g carb.",
    );

    expect(request.args).toMatchObject({
      targetCalories: 500,
      proteinGrams: 30,
      carbGrams: 50,
    });
    expect(request.args.fatGrams).toBeGreaterThan(0);
    expect(4 * request.args.proteinGrams + 4 * request.args.carbGrams +
      9 * request.args.fatGrams).toBeCloseTo(500, 0);
  });
  it('starts a fresh dinner without inheriting whole-day macros/count', () => {
    const request = buildCanonicalMealToolRequest('Cho tôi một bữa tối 650 kcal, 40g protein, 75g carb và 20g fat', {}, {
      calorieScope: 'per_day', targetCalories: 2200, proteinGrams: 170,
      carbGrams: 250, fatGrams: 70, mealsPerDay: 3, plan: { status: 'complete' },
    });
    expect(request.args).toMatchObject({calorieScope:'per_meal', targetCalories:650, mealsPerDay:1, proteinGrams:40});
  });
  it('never treats an explicit whole-day target as one meal after a meal follow-up', () => {
    const request = buildCanonicalMealToolRequest('Tạo thực đơn cả ngày 650 kcal, giữ 40g protein và chia 1 bữa', {}, {
      calorieScope:'per_meal', targetCalories:650, mealsPerDay:1, plan:{status:'complete'},
    });
    expect(request.args).toMatchObject({calorieScope:'per_day', targetCalories:null});
  });
  it("keeps an explicit 650 kcal request as one meal", () => {
    const request = buildCanonicalMealToolRequest(
      "Cho tôi một bữa tối món Việt khoảng 650 kcal (sai số ±50), ít nhất 40g protein, 75g carb và 20g fat, chỉ 1 bữa, không dùng whey.",
      { targetCalories: 2200, proteinGrams: 40, carbGrams: 75, fatGrams: 20 },
    );
    expect(request.args).toMatchObject({ targetCalories: 650, calorieScope: "per_meal", mealsPerDay: 1, minimumProteinGrams: 40, excludedFoods: ["whey"] });
  });

  it("defaults a fresh explicit meal target to one meal", () => {
    const request = buildCanonicalMealToolRequest("Cho tôi bữa tối khoảng 650 kcal, 40g protein, 75g carb và 20g fat.");
    expect(request.args).toMatchObject({ calorieScope: "per_meal", mealsPerDay: 1 });
  });

  it("takes explicit macros from the user without model arguments", () => {
    const request = buildCanonicalMealToolRequest(
      "Cho tôi một bữa tối khoảng 650 kcal, ít nhất 40g protein, 75g carb và 20g fat, chỉ 1 bữa.",
    );
    expect(request.args).toMatchObject({
      targetCalories: 650,
      calorieScope: "per_meal",
      proteinGrams: 40,
      carbGrams: 75,
      fatGrams: 20,
      mealsPerDay: 1,
    });
  });

  it("does not reinterpret a one-day 650 kcal request as a meal", () => {
    const request = buildCanonicalMealToolRequest(
      "Tôi muốn ăn 1 ngày 650 kcal, chia 1 bữa",
      { targetCalories: 2200, proteinGrams: 100, carbGrams: 200, fatGrams: 60 },
    );
    expect(request.args).toMatchObject({ calorieScope: "per_day", targetCalories: null, mealsPerDay: 1 });
  });

  it("keeps per-meal scope for a genuine no-calorie follow-up", () => {
    const request = buildCanonicalMealToolRequest(
      "Đổi món này giúp tôi",
      {},
      { targetCalories: 650, calorieScope: "per_meal", proteinGrams: 40, carbGrams: 75, fatGrams: 20, mealsPerDay: 1 },
    );
    expect(request.args).toMatchObject({ calorieScope: "per_meal", targetCalories: 650, mealsPerDay: 1 });
  });

  it("retains a prior whole-day scope for dinner follow-up", () => {
    const request = buildCanonicalMealToolRequest(
      "Giữ thực đơn nhưng đổi bữa tối giúp tôi",
      {},
      { targetCalories: 2200, calorieScope: "per_day", mealsPerDay: 3, plan: { meals: [] } },
    );
    expect(request.args).toMatchObject({ calorieScope: "per_day", mealsPerDay: 3 });
  });

  it("parses decimal macros and tolerance without a unit", () => {
    const request = buildCanonicalMealToolRequest(
      "Cho tôi bữa tối 650 kcal sai số ±50, ít nhất 40,5g protein, 75,5g carb và 20,2g fat.",
    );
    expect(request.args).toMatchObject({
      targetToleranceCalories: 50,
      minimumProteinGrams: 40.5,
      proteinGrams: 40.5,
      carbGrams: 75.5,
      fatGrams: 20.2,
    });
  });

  it("does not carry per-meal scope into a fresh whole-day request", () => {
    const request = buildCanonicalMealToolRequest(
      "Tôi muốn ăn 1 ngày 650 kcal, chia 1 bữa",
      {},
      { targetCalories: 650, calorieScope: "per_meal", proteinGrams: 40, carbGrams: 75, fatGrams: 20, mealsPerDay: 1 },
    );
    expect(request.args).toMatchObject({ calorieScope: "per_day", targetCalories: null });
  });
});

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
  it("keeps an explicit required food from the raw request", () => {
    const request = buildCanonicalMealToolRequest(
      "Lập thực đơn 2.500 kcal, ít nhất 170g protein, chia 4 bữa, bắt buộc có cá hồi.",
      { carbGrams: 280, fatGrams: 78 },
    );

    expect(request.args.requiredFoods).toEqual(["ca hoi"]);
  });

  it("keeps the required foods from the staged Vietnamese meal corpus", () => {
    const request = buildCanonicalMealToolRequest(
      "Lập cho tôi thực đơn món Việt trong 1 ngày khoảng 2.200 kcal, ít nhất 140g protein, có cơm, cá, rau và đậu phụ; ghi grams và tổng macro.",
      { carbGrams: 250, fatGrams: 71.1 },
    );

    expect(request.args.requiredFoods).toEqual(["com", "ca", "rau", "dau phu"]);
  });

  it("replaces a remembered required food instead of forcing the removed item", () => {
    const request = buildCanonicalMealToolRequest(
      "Giữ nguyên thực đơn vừa lập, chỉ thay phần đậu phụ bằng cá. Giữ tổng năng lượng khoảng 2.200 kcal và ít nhất 140g protein; ghi rõ món và khối lượng trước/sau, tính lại tổng macro, không đổi các món còn lại.",
      { requiredFoods: ["đậu phụ"] },
      {
        targetCalories: 2200,
        proteinGrams: 140,
        carbGrams: 250,
        fatGrams: 71.1,
        mealsPerDay: 3,
        requiredFoods: ["com", "ca", "rau", "dau phu"],
        plan: {
          ...priorPlan,
          meals: [{
            ...priorPlan.meals[0],
            foods: [
              { foodId: "tofu", name: "Đậu phụ", amountGrams: 200, macros: { protein: 16, carb: 4, fat: 8 } },
              ...priorPlan.meals[0].foods,
            ],
          }],
        },
      },
    );

    expect(request.args.requiredFoods).toEqual(["com", "ca", "rau"]);
    expect(request.scopedSubstitution).toEqual({
      status: "ready",
      mealIndex: 0,
      foodIndex: 0,
      sourceFoods: ["dau phu"],
      requestedReplacementFoods: ["ca"],
    });
  });

  it("keeps an explicit 600 kcal single-meal exclusion in the canonical server request", () => {
    const request = buildCanonicalMealToolRequest(
      "Gợi ý một bữa 600 kcal, không dùng thịt gà; mọi món phải ghi rõ khối lượng gram.",
      {},
    );

    expect(request.args).toMatchObject({
      targetCalories: 600,
      calorieScope: "per_meal",
      mealsPerDay: 1,
      excludedFoods: ["thịt gà"],
    });
  });

  it("does not infer a required food from ordinary possibility wording", () => {
    const request = buildCanonicalMealToolRequest(
      "Thực đơn 2.200 kcal có thể dùng nguyên liệu theo mùa.",
      { proteinGrams: 140, carbGrams: 250, fatGrams: 71.1 },
    );

    expect(request.args.requiredFoods).toBeUndefined();
  });

  it("sanitizes model required foods without overriding exclusions", () => {
    const request = buildCanonicalMealToolRequest(
      "Lập thực đơn 2.500 kcal, không ăn cá.",
      {
        proteinGrams: 170,
        carbGrams: 280,
        fatGrams: 78,
        requiredFoods: ["  Cá hồi  ", "Ức gà", "x".repeat(101)],
        excludedFoods: ["cá"],
      },
    );

    expect(request.args.requiredFoods).toEqual(["ca hoi", "uc ga"]);
    expect(request.args.excludedFoods).toEqual(["cá"]);
  });

  it("keeps remembered required foods only for a meal follow-up", () => {
    const lastMeal = {
      targetCalories: 2500,
      proteinGrams: 170,
      carbGrams: 280,
      fatGrams: 78,
      mealsPerDay: 4,
      requiredFoods: ["ca hoi"],
      plan: priorPlan,
    };

    const followUp = buildCanonicalMealToolRequest(
      "Giữ thực đơn vừa rồi nhưng đổi tổng xuống 2.200 kcal.",
      {},
      lastMeal,
    );
    const fresh = buildCanonicalMealToolRequest(
      "Lập thực đơn mới 2.200 kcal.",
      { proteinGrams: 150, carbGrams: 250, fatGrams: 66.7 },
      lastMeal,
    );

    expect({ followUp: followUp.args.requiredFoods, fresh: fresh.args.requiredFoods })
      .toEqual({ followUp: ["ca hoi"], fresh: undefined });
  });

  it("preserves an allergen conflict so the meal tool can fail closed", () => {
    const request = buildCanonicalMealToolRequest(
      "Lập thực đơn 2.500 kcal, bắt buộc có cá hồi nhưng tôi dị ứng cá.",
      { proteinGrams: 170, carbGrams: 280, fatGrams: 78 },
    );

    expect(request.args.requiredFoods).toEqual(["ca hoi"]);
    expect(request.args.excludedAllergens).toContain("fish");
  });

  it.each([
    ["không ăn thịt gà", "thịt gà"],
    ["không ăn trứng", "trứng"],
    ["không ăn sữa", "sữa"],
  ])("preserves the explicit food exclusion from raw prompt: %s", (exclusion, expected) => {
    const request = buildCanonicalMealToolRequest(
      `Lập thực đơn 2.500 kcal, ít nhất 170g protein, chia 4 bữa, ${exclusion}.`,
      { carbGrams: 280, fatGrams: 78 },
    );

    expect(request.args.excludedFoods).toContain(expected);
  });

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

  it("does not widen a full-name scope through an accent-stripped token collision", () => {
    const request = buildCanonicalMealToolRequest(
      "Giữ nguyên các món, chỉ đổi lượng đậu phụ để đạt 2.000 kcal.",
      {},
      {
        targetCalories: 1800,
        proteinGrams: 120,
        carbGrams: 180,
        fatGrams: 60,
        mealsPerDay: 3,
        plan: {
          meals: [{
            label: "Bữa trưa",
            foods: [
              { foodId: "tofu", name: "Đậu phụ", amountGrams: 200, macros: { protein: 16, carb: 4, fat: 8 } },
              { foodId: "oil", name: "Dầu ô liu", amountGrams: 10, macros: { protein: 0, carb: 0, fat: 10 } },
              { foodId: "rice", name: "Cơm trắng", amountGrams: 200, macros: { protein: 5.4, carb: 56, fat: 0.6 } },
            ],
          }],
        },
      },
    );

    expect(request.args.allowedAdjustmentFoodIds).toEqual(["tofu"]);
    expect(request.args.allowedAdjustmentFoodNames).toEqual(["Đậu phụ"]);
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

  it.each([
    "Create a 2500 kcal meal plan. I have a milk allergy.",
    "Create a 2500 kcal meal plan. I am allergic to milk.",
    "Create a 2500 kcal meal plan. My allergies include milk.",
  ])("không làm rơi dị ứng tiếng Anh khi model args thiếu allergen: %s", (message) => {
    const request = buildCanonicalMealToolRequest(message, {
      proteinGrams: 170,
      carbGrams: 280,
      fatGrams: 78,
    });

    expect(request.args.excludedAllergens).toContain("milk");
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

  it("bật fail-closed cấp nhãn khi user yêu cầu không nhiễm chéo", () => {
    const request = buildCanonicalMealToolRequest(
      "Tạo thực đơn 2.500 kcal không có đậu phộng và phải xác minh không nhiễm chéo trên nhãn sản phẩm.",
      { proteinGrams: 170, carbGrams: 280, fatGrams: 78 },
    );

    expect(request.args).toMatchObject({
      targetCalories: 2500,
      excludedAllergens: ["peanut"],
      requirePackageLabelSafety: true,
    });
  });
});
