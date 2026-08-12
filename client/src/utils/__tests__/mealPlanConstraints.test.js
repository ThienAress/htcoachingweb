import { describe, expect, it } from "vitest";

import {
  filterFoodsForMealPlan,
  hasMealPlanFoodCoverage,
  isMealPlanAllergyLocked,
  isMealPlanPreferenceConfirmed,
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
  it("locks account save, generation and favorites while allergy status is unsure", () => {
    expect(isMealPlanAllergyLocked({ allergyStatus: "unsure" })).toBe(true);
    expect(isMealPlanAllergyLocked({ allergyStatus: "declared" })).toBe(false);
    expect(isMealPlanAllergyLocked({ allergyStatus: "none_known" })).toBe(false);
  });

  it("treats only resolved allergy snapshots as confirmed", () => {
    expect([
      isMealPlanPreferenceConfirmed({ allergyStatus: "none_known" }),
      isMealPlanPreferenceConfirmed({ allergyStatus: "declared" }),
      isMealPlanPreferenceConfirmed({ allergyStatus: "unsure" }),
      isMealPlanPreferenceConfirmed({ allergyStatus: null }),
    ]).toEqual([true, true, false, false]);
  });

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

  it("allows an absent free-text allergen without broadening its exclusion group", () => {
    expect(
      validateMealPlanPreferences({
        allergyStatus: "declared",
        allergens: ["fish"],
        otherAllergenText: "Ốc biển",
        budgetVndPerDay: null,
      }),
    ).toEqual({ valid: true, code: null });
  });

  it("accepts a specific free-text allergen that exact-matches the loaded Food catalog", () => {
    const foods = [
      food({ label: "Cá thu" }),
      food({ label: "Cá chẽm" }),
      food({ label: "Cá diêu hồng" }),
    ];

    expect(
      validateMealPlanPreferences(
        {
          allergyStatus: "declared",
          allergens: [],
          otherAllergenText: "ca thu",
          budgetVndPerDay: null,
        },
        foods,
      ),
    ).toEqual({ valid: true, code: null });
  });

  it("allows a specific free-text allergen that is absent from the Food catalog", () => {
    expect(
      validateMealPlanPreferences(
        {
          allergyStatus: "declared",
          allergens: [],
          otherAllergenText: "cá thu",
          budgetVndPerDay: null,
        },
        [food({ label: "Cá chẽm" })],
      ),
    ).toEqual({ valid: true, code: null });
  });

  it("only excludes the exact catalog food entered in Khác, not the whole fish group", () => {
    const foods = [
      food({ label: "Cá thu" }),
      food({ label: "Cá chẽm" }),
      food({ label: "Cá diêu hồng" }),
      food({ label: "Cơm trắng", protein: 2, carb: 28 }),
      food({ label: "Dầu olive", protein: 0, fat: 100 }),
    ];

    expect(
      filterFoodsForMealPlan(foods, {
        allergyStatus: "declared",
        allergens: [],
        otherAllergenText: "CÁ THU",
      }).map(({ label }) => label),
    ).toEqual(["Cá chẽm", "Cá diêu hồng", "Cơm trắng", "Dầu olive"]);
  });

  it("keeps catalog foods available when the entered allergen is absent from the catalog", () => {
    expect(
      filterFoodsForMealPlan([food({ label: "Cá chẽm" })], {
        allergyStatus: "declared",
        allergens: [],
        otherAllergenText: "ốc biển",
      }).map(({ label }) => label),
    ).toEqual(["Cá chẽm"]);
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

  it("uses reviewed specific-food metadata before label fallback", () => {
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
    ).toEqual(["safe", "missing-specific-review"]);
  });

  it("loại bò và gà theo label nhưng giữ lại Food legacy không liên quan", () => {
    const foods = [
      food({ label: "Thịt bò nạc", allergenProfile: undefined }),
      food({ label: "Ức gà", allergenProfile: undefined }),
      food({ label: "Cá hồi", allergenProfile: undefined }),
      food({ label: "Cơm trắng", protein: 2, carb: 28, allergenProfile: undefined }),
      food({ label: "Dầu olive", protein: 0, fat: 100, allergenProfile: undefined }),
    ];

    expect(
      filterFoodsForMealPlan(foods, {
        allergyStatus: "declared",
        allergens: [],
        otherAllergenText: "bò, gà",
      }).map(({ label }) => label),
    ).toEqual(["Cá hồi", "Cơm trắng", "Dầu olive"]);
  });

  it("giữ đủ ba nhóm macro sau khi loại bò và gà", () => {
    const foods = [
      food({ label: "Cá hồi", allergenProfile: undefined }),
      food({ label: "Cơm trắng", protein: 2, carb: 28, allergenProfile: undefined }),
      food({ label: "Dầu olive", protein: 0, fat: 100, allergenProfile: undefined }),
    ];

    expect(
      hasMealPlanFoodCoverage(
        filterFoodsForMealPlan(foods, {
          allergyStatus: "declared",
          allergens: [],
          otherAllergenText: "bò, gà",
        }),
      ),
    ).toBe(true);
  });

  it("tick Cá chỉ loại Food cá legacy và vẫn giữ đủ ba nhóm macro", () => {
    const foods = [
      food({ label: "Cá hồi", allergenProfile: undefined }),
      food({ label: "Cà chua", protein: 1, carb: 4, allergenProfile: undefined }),
      food({ label: "Ức gà", allergenProfile: undefined }),
      food({ label: "Cơm trắng", protein: 2, carb: 28, allergenProfile: undefined }),
      food({ label: "Dầu olive", protein: 0, fat: 100, allergenProfile: undefined }),
    ];
    const filtered = filterFoodsForMealPlan(foods, {
      allergyStatus: "declared",
      allergens: ["fish"],
      otherAllergenText: "",
    });

    expect({
      labels: filtered.map(({ label }) => label),
      hasCoverage: hasMealPlanFoodCoverage(filtered),
    }).toEqual({
      labels: ["Cà chua", "Ức gà", "Cơm trắng", "Dầu olive"],
      hasCoverage: true,
    });
  });

  it.each([
    ["milk", "Sữa bò"],
    ["egg", "Trứng gà"],
    ["fish", "Cá hồi"],
    ["crustacean_shellfish", "Tôm sú"],
    ["tree_nut", "Hạt điều"],
    ["peanut", "Đậu phộng"],
    ["wheat", "Bột mì"],
    ["soy", "Đậu phụ"],
    ["sesame", "Hạt mè"],
  ])("tick %s loại đúng tên khớp nhưng không làm rỗng catalog", (allergen, label) => {
    const foods = [
      food({ label, allergenProfile: undefined }),
      food({ label: "Ức gà", allergenProfile: undefined }),
      food({ label: "Cơm trắng", protein: 2, carb: 28, allergenProfile: undefined }),
      food({ label: "Dầu olive", protein: 0, fat: 100, allergenProfile: undefined }),
    ];
    const filtered = filterFoodsForMealPlan(foods, {
      allergyStatus: "declared",
      allergens: [allergen],
      otherAllergenText: "",
    });

    expect({
      hasExcludedMatch: filtered.some((item) => item.label === label),
      hasCoverage: hasMealPlanFoodCoverage(filtered),
    }).toEqual({ hasExcludedMatch: false, hasCoverage: true });
  });

  it("nhập thịt gà giữ Food reviewed chưa có scope khi label không phải gà", () => {
    const foods = [
      food({ label: "Ức gà", allergenProfile: undefined }),
      food({ label: "Cá hồi" }),
      food({ label: "Cơm trắng", protein: 2, carb: 28 }),
      food({ label: "Dầu olive", protein: 0, fat: 100 }),
    ];

    expect(
      filterFoodsForMealPlan(foods, {
        allergyStatus: "declared",
        allergens: [],
        otherAllergenText: "thịt gà",
      }).map(({ label }) => label),
    ).toEqual(["Cá hồi", "Cơm trắng", "Dầu olive"]);
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

  it("uses reviewed metadata first and exact label fallback for unreviewed foods", () => {
    const foods = [
      food({ label: "safe" }),
      food({ label: "contains", allergenProfile: { reviewStatus: "reviewed", contains: ["milk"], mayContain: [] } }),
      food({ label: "cross", allergenProfile: { reviewStatus: "reviewed", contains: [], mayContain: ["milk"] } }),
      food({ label: "Sữa bò", allergenProfile: { reviewStatus: "unreviewed", contains: [], mayContain: [] } }),
      food({ label: "Cơm trắng", allergenProfile: { reviewStatus: "unreviewed", contains: [], mayContain: [] } }),
    ];

    expect(
      filterFoodsForMealPlan(foods, {
        allergyStatus: "declared",
        allergens: ["milk"],
      }).map(({ label }) => label),
    ).toEqual(["safe", "Cơm trắng"]);
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

});
