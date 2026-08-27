import { describe, expect, it } from "vitest";
import {
  appendNutritionEntry,
  createManualMealEntry,
  createRecipeMealEntry,
  updateManualMealEntry,
  upsertPlannedMealEntry,
  dailyNutritionTotals,
  nutritionComparison,
} from "../dailyNutrition";

describe("dailyNutrition adapter", () => {
  it("upsert planned meal giữ entryId và không đổi entry khác", () => {
    const entries = [
      {
        entryId: "e1111111-1111-4111-8111-111111111111",
        mode: "follow_plan",
        plannedMealKey: "meal-1",
        status: "eaten",
        note: "",
      },
      {
        entryId: "e2222222-2222-4222-8222-222222222222",
        mode: "manual",
        mealName: "Bữa phụ",
        description: "Snack",
        status: "eaten",
        note: "",
      },
    ];

    expect(
      upsertPlannedMealEntry(entries, {
        mealKey: "meal-1",
        status: "skipped",
        entryId: "e9999999-9999-4999-8999-999999999999",
      }),
    ).toEqual([
      { ...entries[0], status: "skipped" },
      entries[1],
    ]);
  });

  it("manual và recipe payload không chứa macro/calorie client", () => {
    const manual = createManualMealEntry({
      entryId: "e3333333-3333-4333-8333-333333333333",
      mealName: "Bữa phụ",
      foodDescription: "Sữa chua và một quả chuối",
    });
    const recipe = createRecipeMealEntry({
      entryId: "e4444444-4444-4444-8444-444444444444",
      recipeId: "64b000000000000000000001",
    });

    expect(manual).toEqual({
      entryId: "e3333333-3333-4333-8333-333333333333",
      mode: "manual",
      mealName: "Bữa phụ",
      description: "Sữa chua và một quả chuối",
      status: "eaten",
      note: "",
    });
    expect(recipe).not.toHaveProperty("calories");
    expect(recipe).not.toHaveProperty("macros");
  });

  it("updates a manual entry once and rejects an entry that already used its update", () => {
    const entry = {
      entryId: "e5555555-5555-4555-8555-555555555555",
      mode: "manual",
      mealName: "Bữa phụ",
      description: "Một quả chuối",
      status: "eaten",
      note: "",
      editCount: 0,
    };

    expect(
      updateManualMealEntry([entry], {
        entryId: entry.entryId,
        mealName: "Sau buổi tập",
        foodDescription: "Sữa chua và một quả chuối",
      }),
    ).toEqual([
      {
        entryId: entry.entryId,
        mode: "manual",
        mealName: "Sau buổi tập",
        description: "Sữa chua và một quả chuối",
        status: "eaten",
        note: "",
      },
    ]);
    expect(() =>
      updateManualMealEntry([{ ...entry, editCount: 1 }], {
        entryId: entry.entryId,
        mealName: "Tên khác",
        foodDescription: "Món khác",
      }),
    ).toThrow(/chỉ được cập nhật một lần/i);
  });

  it("không append quá 10 entries", () => {
    const entries = Array.from({ length: 10 }, (_, index) => ({
      entryId: String(index),
    }));
    expect(() => appendNutritionEntry(entries, { entryId: "next" })).toThrow(
      /10 mục bữa ăn/i,
    );
  });

  it("keeps gram adjustments in the command without sending server-owned macro", () => {
    const entries = [
      {
        entryId: "e6666666-6666-4666-8666-666666666666",
        mode: "follow_plan",
        plannedMealKey: "meal-1",
        status: "changed",
        actualFoods: [
          {
            foodId: "64b000000000000000000001",
            actualAmountGrams: 150,
            nutrition: { protein: 30, calories: 187.5 },
          },
        ],
      },
    ];

    expect(
      upsertPlannedMealEntry(entries, {
        mealKey: "meal-1",
        status: "eaten",
        entryId: "e7777777-7777-4777-8777-777777777777",
      }),
    ).toEqual([
      {
        entryId: entries[0].entryId,
        mode: "follow_plan",
        plannedMealKey: "meal-1",
        status: "eaten",
        note: "",
        adjustments: [
          { foodId: "64b000000000000000000001", amountGrams: 150 },
        ],
      },
    ]);
  });

  it("only totals eaten meals and describes remaining or exceeded targets", () => {
    const entries = [
      {
        status: "eaten",
        actualTotals: { calories: 300, protein: 30, carb: 20, fat: 10 },
      },
      {
        status: "changed",
        actualTotals: { calories: 200, protein: 15, carb: 15, fat: 8 },
      },
    ];

    expect(dailyNutritionTotals(entries)).toEqual({
      calories: 300,
      protein: 30,
      carb: 20,
      fat: 10,
    });
    expect(
      nutritionComparison(entries, {
        calories: 250,
        protein: 40,
        carb: 20,
        fat: 8,
      }),
    ).toEqual([
      expect.objectContaining({ key: "calories", state: "over", difference: 50 }),
      expect.objectContaining({ key: "protein", state: "remaining", difference: 10 }),
      expect.objectContaining({ key: "carb", state: "met", difference: 0 }),
      expect.objectContaining({ key: "fat", state: "over", difference: 2 }),
    ]);
  });
});
