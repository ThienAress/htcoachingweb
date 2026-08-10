import { describe, expect, it } from "vitest";

import { parseOtherAllergenText } from "../mealPlanAllergenInput.service.js";

describe("Meal Plan other-allergen parser", () => {
  it("recognizes multiple foods separated only by spaces", () => {
    const result = parseOtherAllergenText("gà bò cá");

    expect(result).toMatchObject({
      canonicalText: "Gà, Bò, Cá",
      hasUnmapped: false,
      items: [
        { key: "chicken", kind: "specific" },
        { key: "beef", kind: "specific" },
        { key: "fish", kind: "major" },
      ],
    });
  });

  it("recognizes Vietnamese food names without diacritics or separators", () => {
    expect(parseOtherAllergenText("ga bo ca")).toMatchObject({
      canonicalText: "Gà, Bò, Cá",
      hasUnmapped: false,
      items: [
        { key: "chicken", kind: "specific" },
        { key: "beef", kind: "specific" },
        { key: "fish", kind: "major" },
      ],
    });
  });

  it("rejects periods used between foods", () => {
    expect(() => parseOtherAllergenText("bò.gà.heo")).toThrow(
      "Không dùng dấu chấm giữa các thực phẩm",
    );
  });

  it("accepts commas as explicit food separators", () => {
    expect(parseOtherAllergenText("bò,gà,heo").canonicalText).toBe(
      "Bò, Gà, Heo",
    );
  });

  it("rejects generic meat terms and asks for a specific type", () => {
    expect(
      ["thịt", "các loại thịt", "tất cả thịt trên cạn"].map((value) => {
        try {
          parseOtherAllergenText(value);
          return null;
        } catch (error) {
          return error.code;
        }
      }),
    ).toEqual([
      "MEAL_PLAN_OTHER_ALLERGEN_TOO_GENERIC",
      "MEAL_PLAN_OTHER_ALLERGEN_TOO_GENERIC",
      "MEAL_PLAN_OTHER_ALLERGEN_TOO_GENERIC",
    ]);
  });
});
