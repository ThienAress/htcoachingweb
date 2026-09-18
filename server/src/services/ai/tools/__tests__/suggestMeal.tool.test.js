import { describe, expect, it, vi } from "vitest";

import { suggestMeal } from "../suggestMeal.tool.js";

const reviewed = (
  contains = [],
  specificContains = [],
  sourceType = "official_database",
) => ({
  reviewStatus: "reviewed",
  contains,
  mayContain: [],
  reviewedScopes: specificContains.length ? ["specific_foods"] : [],
  specificContains,
  sourceType,
  sourceUrl: sourceType === "official_database"
    ? "https://fdc.nal.usda.gov/food-search/?query=whole%20food"
    : "https://manufacturer.example.test/product-label",
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
      safety: {
        status: "not_requested",
        reviewedCatalogRequired: false,
        allergenConstraintsApplied: false,
        excludedFoodConstraintsApplied: false,
      },
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
    expect(result.uiCard.data.safety).toEqual({
      status: "ingredient_verified",
      reviewedCatalogRequired: true,
      allergenConstraintsApplied: true,
      excludedFoodConstraintsApplied: true,
      crossContactStatus: "product_label_required",
      warning: expect.stringMatching(/nhãn sản phẩm/i),
    });
    expect(result.text).toMatch(/nhãn sản phẩm/i);
    const labels = result.uiCard.data.meals.flatMap((meal) => meal.foods.map((food) => food.name.toLowerCase()));
    expect(new Set(labels)).toEqual(new Set(["ức gà", "cơm trắng", "dầu ô liu"]));
  });

  it.each(["whey", "bột whey"])(
    "canonicalize loại trừ %s sang metadata milk thay vì chỉ so substring nhãn",
    async (excludedFood) => {
      const result = await suggestMeal({
        ...params,
        excludedFoods: [excludedFood],
      }, toolContext({
        findFoods: vi.fn().mockResolvedValue([
          catalog[0],
          catalog[1],
          catalog[2],
          {
            _id: "protein-powder",
            label: "Bột protein",
            protein: 90,
            carb: 1,
            fat: 1,
            allergenProfile: reviewed(["milk"]),
          },
        ]),
      }));

      expect(result.uiCard.data.status).toBe("complete");
      expect(result.uiCard.data.safety).toMatchObject({
        allergenConstraintsApplied: true,
        excludedFoodConstraintsApplied: true,
      });
      expect(result.uiCard.data.meals.flatMap((meal) => meal.foods)
        .some((food) => food.name === "Bột protein")).toBe(false);
    },
  );

  it("fail closed khi không thể đối chiếu thực phẩm loại trừ với taxonomy hoặc catalog", async () => {
    const result = await suggestMeal({
      ...params,
      excludedFoods: ["món bí ẩn"],
    }, toolContext());

    expect(result.uiCard.data).toMatchObject({
      status: "missing_data",
      reason: "excluded_food_unverifiable",
      meals: [],
    });
  });

  it("dùng exact catalog phrase cho mục loại trừ ngoài taxonomy, không fuzzy match", async () => {
    const result = await suggestMeal({
      ...params,
      excludedFoods: ["khoai lang"],
    }, toolContext({
      findFoods: vi.fn().mockResolvedValue([
        ...catalog,
        {
          _id: "sweet-potato",
          label: "Khoai lang luộc",
          protein: 1.6,
          carb: 20,
          fat: 0.1,
          allergenProfile: reviewed(),
        },
      ]),
    }));

    expect(result.uiCard.data.status).toBe("complete");
    expect(result.uiCard.data.safety.excludedFoodConstraintsApplied).toBe(true);
    expect(result.uiCard.data.meals.flatMap((meal) => meal.foods)
      .some((food) => food.name === "Khoai lang luộc")).toBe(false);
  });

  it("ưu tiên specific_foods metadata rồi fallback exact phrase khi scope chưa review", async () => {
    const result = await suggestMeal({
      ...params,
      excludedFoods: ["gà"],
    }, toolContext({
      findFoods: vi.fn().mockResolvedValue([
        catalog[0],
        catalog[1],
        catalog[2],
        catalog[3],
        {
          _id: "hidden-chicken",
          label: "Protein nạc",
          protein: 90,
          carb: 1,
          fat: 1,
          allergenProfile: reviewed([], ["chicken"]),
        },
      ]),
    }));

    expect(result.uiCard.data.status).toBe("complete");
    const labels = result.uiCard.data.meals.flatMap((meal) =>
      meal.foods.map((food) => food.name));
    expect(labels).not.toContain("Protein nạc");
    expect(labels).not.toContain("Ức gà");
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

  it.each([
    ["source type ngoài allowlist", { sourceType: "blog" }],
    ["URL không dùng HTTPS", { sourceUrl: "http://fdc.nal.usda.gov/food/1" }],
    ["host official database không tin cậy", { sourceUrl: "https://example.test/food/1" }],
    ["ngày review ở tương lai", { reviewedAt: new Date("2999-01-01T00:00:00.000Z") }],
  ])("fail closed với %s ngay tại meal tool", async (_label, override) => {
    const invalidFat = {
      ...catalog[2],
      allergenProfile: { ...catalog[2].allergenProfile, ...override },
    };
    const result = await suggestMeal({
      ...params,
      excludedAllergens: ["peanut"],
    }, toolContext({
      findFoods: vi.fn().mockResolvedValue([catalog[0], catalog[1], invalidFat]),
    }));

    expect(result.uiCard.data).toMatchObject({
      status: "missing_data",
      reason: "safety_metadata_missing",
    });
  });

  it("fail closed khi user yêu cầu xác minh cấp nhãn nhưng catalog chỉ có dữ liệu thành phần", async () => {
    const result = await suggestMeal({
      ...params,
      excludedAllergens: ["peanut"],
      requirePackageLabelSafety: true,
    }, toolContext());

    expect(result.uiCard.data).toMatchObject({
      status: "missing_data",
      reason: "package_label_safety_missing",
    });
  });

  it("chỉ claim verified khi mọi món có nguồn cấp nhãn hoặc nhà sản xuất", async () => {
    const packageCatalog = catalog.map((food) => ({
      ...food,
      allergenProfile: {
        ...food.allergenProfile,
        sourceType: "package_label",
        sourceUrl: `https://manufacturer.example.test/${food._id}`,
      },
    }));
    const result = await suggestMeal({
      ...params,
      excludedAllergens: ["peanut"],
      requirePackageLabelSafety: true,
    }, toolContext({
      findFoods: vi.fn().mockResolvedValue(packageCatalog),
    }));

    expect(result.uiCard.data.safety).toMatchObject({
      status: "verified",
      allergenConstraintsApplied: true,
    });
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
    expect(result.uiCard.data.safety).toEqual({
      status: "not_requested",
      reviewedCatalogRequired: false,
      allergenConstraintsApplied: false,
      excludedFoodConstraintsApplied: false,
    });
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
