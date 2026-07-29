import { describe, expect, it } from "vitest";
import { buildSavedMealPlanPayload } from "../savedMealPlan";

const meals = [
  {
    key: "meal-1",
    mealName: "Bữa 1",
    mealType: "breakfast",
    proteinFood: { _id: "64b000000000000000000001", amount: 150 },
    carbFood: { _id: "64b000000000000000000002", amount: 200 },
    fatFood: null,
    totalCalories: 9999,
  },
];

describe("buildSavedMealPlanPayload", () => {
  it("chỉ gửi Food canonical ID và định lượng, không tin totals client", () => {
    const payload = buildSavedMealPlanPayload({
      requestId: "d1111111-1111-4111-8111-111111111111",
      title: "Meal plan giảm mỡ",
      target: {
        label: "fat_loss",
        protein: 120,
        carb: 180,
        fat: 50,
        calories: 1650,
      },
      meals,
    });

    expect(payload.meals).toEqual([
      {
        key: "meal-1",
        name: "Bữa 1",
        type: "breakfast",
        foods: [
          { foodId: "64b000000000000000000001", amountGrams: 150 },
          { foodId: "64b000000000000000000002", amountGrams: 200 },
        ],
      },
    ]);
    expect(payload).not.toHaveProperty("totals");
    expect(payload.meals[0]).not.toHaveProperty("totalCalories");
  });

  it("không persist output thiếu Food ID canonical", () => {
    expect(() =>
      buildSavedMealPlanPayload({
        requestId: "d1111111-1111-4111-8111-111111111111",
        title: "Invalid",
        meals: [
          {
            ...meals[0],
            proteinFood: { label: "Manual food", amount: 100 },
          },
        ],
      }),
    ).toThrowError(/canonical Food ID/i);
  });
});
