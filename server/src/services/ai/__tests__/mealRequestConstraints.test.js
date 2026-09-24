import { describe, expect, it } from "vitest";

import { buildCanonicalMealToolRequest } from "../mealRequestConstraints.js";

describe("canonical meal request constraints", () => {
  it("takes numeric hard constraints from the user prompt instead of model args", () => {
    const request = buildCanonicalMealToolRequest(
      "Lập cho tôi thực đơn 1 ngày khoảng 2.500 kcal (sai số tối đa 100 kcal), ít nhất 170g protein, chia 4 bữa.",
      {
        targetCalories: 1800,
        proteinGrams: 100,
        carbGrams: 200,
        fatGrams: 50,
        mealsPerDay: 3,
      },
    );

    expect(request.args).toMatchObject({
      targetCalories: 2500,
      targetToleranceCalories: 100,
      proteinGrams: 170,
      minimumProteinGrams: 170,
      mealsPerDay: 4,
    });
  });
});
