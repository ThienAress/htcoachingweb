import { describe, expect, it } from "vitest";

import { analyzeOtherAllergenText } from "../mealPlanAllergenInput";

describe("Meal Plan other-allergen input", () => {
  it("recognizes gà bò cá without commas", () => {
    expect(analyzeOtherAllergenText("gà bò cá")).toMatchObject({
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
    expect(analyzeOtherAllergenText("ga bo ca")).toMatchObject({
      canonicalText: "Gà, Bò, Cá",
      hasUnmapped: false,
      items: [
        { key: "chicken", kind: "specific" },
        { key: "beef", kind: "specific" },
        { key: "fish", kind: "major" },
      ],
    });
  });

  it("reports a period separator instead of guessing", () => {
    expect(analyzeOtherAllergenText("bò.gà.heo").errorCode).toBe(
      "period_separator",
    );
  });

  it("accepts commas as explicit food separators", () => {
    expect(analyzeOtherAllergenText("bò,gà,heo").canonicalText).toBe(
      "Bò, Gà, Heo",
    );
  });

  it("rejects generic meat terms and asks for a specific type", () => {
    expect(
      ["thịt", "các loại thịt", "tất cả thịt trên cạn"].map(
        (value) => analyzeOtherAllergenText(value).errorCode,
      ),
    ).toEqual(["generic_meat", "generic_meat", "generic_meat"]);
  });
});
