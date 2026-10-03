import { describe, expect, it } from "vitest";
import { resolveScopedMealSubstitution } from "../mealScopedSubstitution.js";

const plan = {
  meals: [{
    label: "Bữa trưa",
    foods: [
      { foodId: "tofu", name: "Đậu phụ", amountGrams: 200, macros: { protein: 16, carb: 4, fat: 8 } },
      { foodId: "fish", name: "Cá basa", amountGrams: 100, macros: { protein: 20, carb: 0, fat: 5 } },
    ],
  }],
};

describe("scoped meal substitution request", () => {
  it("resolves one source item and the requested replacement from a general follow-up", () => {
    expect(resolveScopedMealSubstitution(
      "Giữ nguyên thực đơn vừa lập, chỉ thay phần đậu phụ bằng cá. Không đổi các món còn lại.",
      plan,
    )).toEqual({
      status: "ready",
      mealIndex: 0,
      foodIndex: 0,
      sourceFoods: ["dau phu"],
      requestedReplacementFoods: ["ca"],
    });
  });

  it("returns an actionable state when the named source is absent", () => {
    expect(resolveScopedMealSubstitution(
      "Chỉ thay phần thịt bò bằng cá, giữ nguyên các món còn lại.",
      plan,
    )).toMatchObject({ status: "source_absent", sourceFoods: ["thit bo"] });
  });

  it("does not guess when the source occurs more than once", () => {
    expect(resolveScopedMealSubstitution(
      "Thay đậu phụ bằng cá.",
      { meals: [
        plan.meals[0],
        {
          label: "Bữa tối",
          foods: [{
            foodId: "smoked-tofu",
            name: "Đậu phụ hun khói",
            amountGrams: 100,
            macros: { protein: 12, carb: 3, fat: 6 },
          }],
        },
      ] },
    )).toMatchObject({ status: "source_ambiguous" });
  });

  it("selects every occurrence when all matches share one canonical food id", () => {
    expect(resolveScopedMealSubstitution(
      "Giữ nguyên thực đơn vừa lập, chỉ thay phần đậu phụ bằng cá. Tính lại tổng macro, không đổi các món còn lại.",
      { meals: [
        plan.meals[0],
        {
          label: "Bữa tối",
          foods: [{
            foodId: "tofu",
            name: "Đậu phụ",
            amountGrams: 60,
            macros: { protein: 7.2, carb: 1.2, fat: 4.2 },
          }],
        },
      ] },
    )).toEqual({
      status: "ready",
      matches: [
        { mealIndex: 0, foodIndex: 0 },
        { mealIndex: 1, foodIndex: 0 },
      ],
      sourceFoodId: "tofu",
      sourceFoods: ["dau phu"],
      requestedReplacementFoods: ["ca"],
    });
  });

  it("uses an explicitly named meal to select one occurrence", () => {
    expect(resolveScopedMealSubstitution(
      "Ở bữa tối, thay đậu phụ bằng cá.",
      { meals: [
        plan.meals[0],
        {
          label: "Bữa tối",
          foods: [{
            foodId: "tofu",
            name: "Đậu phụ",
            amountGrams: 60,
            macros: { protein: 7.2, carb: 1.2, fat: 4.2 },
          }],
        },
      ] },
    )).toMatchObject({ status: "ready", mealIndex: 1, foodIndex: 0 });
  });

  it("marks an explicit request to preserve macros for the server-only replacement guard", () => {
    expect(resolveScopedMealSubstitution(
      "Thay đậu phụ bằng cá nhưng giữ nguyên protein, carb và fat.",
      plan,
    )).toMatchObject({
      status: "ready",
      requestedReplacementFoods: ["ca"],
      preserveMacros: true,
    });
  });

  it("does not treat preserving the meal plan while recalculating macros as macro preservation", () => {
    expect(resolveScopedMealSubstitution(
      "Giữ nguyên thực đơn vừa lập, chỉ thay phần đậu phụ bằng cá. Giữ tổng năng lượng khoảng 2.200 kcal và ít nhất 140g protein; ghi rõ món và khối lượng trước/sau, tính lại tổng macro, không đổi các món còn lại.",
      plan,
    )).toEqual({
      status: "ready",
      mealIndex: 0,
      foodIndex: 0,
      sourceFoods: ["dau phu"],
      requestedReplacementFoods: ["ca"],
    });
  });
});
