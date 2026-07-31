import { describe, expect, it } from "vitest";
import {
  appendNutritionEntry,
  createManualMealEntry,
  createRecipeMealEntry,
  upsertPlannedMealEntry,
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
      description: "Ăn nhẹ ngoài kế hoạch",
    });
    const recipe = createRecipeMealEntry({
      entryId: "e4444444-4444-4444-8444-444444444444",
      recipeId: "64b000000000000000000001",
    });

    expect(manual).toEqual({
      entryId: "e3333333-3333-4333-8333-333333333333",
      mode: "manual",
      description: "Ăn nhẹ ngoài kế hoạch",
      status: "eaten",
      note: "",
    });
    expect(recipe).not.toHaveProperty("calories");
    expect(recipe).not.toHaveProperty("macros");
  });

  it("không append quá 10 entries", () => {
    const entries = Array.from({ length: 10 }, (_, index) => ({
      entryId: String(index),
    }));
    expect(() => appendNutritionEntry(entries, { entryId: "next" })).toThrow(
      /10 mục bữa ăn/i,
    );
  });
});
