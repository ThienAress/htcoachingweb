import { describe, expect, it } from "vitest";
import {
  buildSavedMealPlanPayload,
  buildSavedMealPlanPayloadFromSnapshot,
  getSavedMealPlanErrorKey,
  savedMealPlanToTableMeals,
  validateSavedMealPlanTitle,
} from "../savedMealPlan";

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

describe("getSavedMealPlanErrorKey", () => {
  it("maps stable server codes without exposing the raw backend message", () => {
    expect(
      getSavedMealPlanErrorKey({
        response: {
          data: {
            code: "SAVED_MEAL_PLAN_VERSION_CONFLICT",
            message: "raw operational detail",
          },
        },
      }),
    ).toBe("saved.version_conflict");
    expect(getSavedMealPlanErrorKey(new Error("raw"))).toBe(
      "saved.command_error",
    );
  });
});

describe("saved meal plan title policy", () => {
  it("accepts a clean title up to 30 characters", () => {
    expect(validateSavedMealPlanTitle("  Thực đơn ngày tập chân  ")).toEqual({
      valid: true,
      value: "Thực đơn ngày tập chân",
      reason: null,
    });
  });

  it("rejects titles longer than 30 characters and vulgar words", () => {
    expect(validateSavedMealPlanTitle("a".repeat(31))).toMatchObject({
      valid: false,
      reason: "too_long",
    });
    expect(validateSavedMealPlanTitle("Thực đơn địt mẹ")).toMatchObject({
      valid: false,
      reason: "prohibited",
    });
    expect(validateSavedMealPlanTitle("Thực đơn dit me")).toMatchObject({
      valid: false,
      reason: "prohibited",
    });
  });

  it("builds a revision command from the immutable saved snapshot", () => {
    const payload = buildSavedMealPlanPayloadFromSnapshot({
      requestId: "d2222222-2222-4222-8222-222222222222",
      title: "Ngày tập chân",
      plan: {
        target: { label: "High-carb", protein: 120 },
        meals: [
          {
            key: "meal-1",
            name: "Bữa 1",
            type: "breakfast",
            foods: [
              {
                foodId: "64b000000000000000000000001",
                amountGrams: 150,
                nutrition: { protein: 30, carb: 0, fat: 7.5, calories: 187.5 },
              },
            ],
          },
        ],
      },
    });

    expect(payload).toEqual({
      requestId: "d2222222-2222-4222-8222-222222222222",
      title: "Ngày tập chân",
      target: { label: "High-carb", protein: 120 },
      meals: [
        {
          key: "meal-1",
          name: "Bữa 1",
          type: "breakfast",
          foods: [
            { foodId: "64b000000000000000000000001", amountGrams: 150 },
          ],
        },
      ],
    });
    expect(payload.meals[0].foods[0]).not.toHaveProperty("nutrition");
  });

  it("maps a saved snapshot back to the five-column meal table", () => {
    const rows = savedMealPlanToTableMeals({
      meals: [
        {
          key: "meal-1",
          name: "Bữa 1",
          type: "breakfast",
          foods: [
            {
              foodId: "protein",
              label: "Ức gà",
              amountGrams: 150,
              nutrition: { protein: 30, carb: 0, fat: 5, calories: 165 },
            },
            {
              foodId: "carb",
              label: "Cơm",
              amountGrams: 200,
              nutrition: { protein: 4, carb: 56, fat: 1, calories: 249 },
            },
            {
              foodId: "fat",
              label: "Dầu olive",
              amountGrams: 10,
              nutrition: { protein: 0, carb: 0, fat: 10, calories: 90 },
            },
          ],
        },
      ],
    });

    expect(rows[0]).toMatchObject({
      mealName: "Bữa 1",
      proteinFood: { label: "Ức gà", amount: 150 },
      carbFood: { label: "Cơm", amount: 200 },
      fatFood: { label: "Dầu olive", amount: 10 },
    });
  });
});
