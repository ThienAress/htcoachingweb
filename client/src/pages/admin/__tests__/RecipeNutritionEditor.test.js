import { describe, expect, it } from "vitest";

import {
  recipeNutritionFormValues,
  recipeNutritionPayload,
} from "../recipeNutritionForm";

describe("RecipeNutritionEditor helpers", () => {
  it("chuyển dữ liệu form admin thành số cho API", () => {
    const form = recipeNutritionFormValues({
      calories: 361,
      protein: 32,
      fat: 8,
      carb: 40,
      sugars: 6,
      salt: 1.2,
      additional: [{ label: "Chất xơ", unit: "g", value: 7 }],
    });
    expect(recipeNutritionPayload(form)).toEqual({
      calories: 361,
      protein: 32,
      fat: 8,
      carb: 40,
      sugars: 6,
      salt: 1.2,
      additional: [{ label: "Chất xơ", unit: "g", value: 7 }],
    });
  });
});
