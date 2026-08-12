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

  it.each(["Ức gà", "uc ga"])(
    "recognizes a chicken cut as the canonical chicken exclusion: %s",
    (value) => {
      expect(analyzeOtherAllergenText(value)).toMatchObject({
        canonicalText: "Gà",
        hasUnmapped: false,
        specificKeys: ["chicken"],
      });
    },
  );

  it("recognizes a specific food only when its normalized label exists in the Food catalog", () => {
    expect(
      analyzeOtherAllergenText("CA THU", [
        { label: "Cá thu" },
        { label: "Cá chẽm" },
      ]),
    ).toMatchObject({
      canonicalText: "Cá thu",
      hasUnmapped: false,
      catalogFoodLabels: ["Cá thu"],
      items: [{ key: null, kind: "catalog_food", label: "Cá thu" }],
    });
  });

  it("does not collide different non-Latin Food labels during exact matching", () => {
    expect(
      analyzeOtherAllergenText("鯖魚", [
        { label: "鯖魚" },
        { label: "鮭魚" },
      ]),
    ).toMatchObject({
      canonicalText: "鯖魚",
      hasUnmapped: false,
      catalogFoodLabels: ["鯖魚"],
    });
  });

  it("keeps a specific food unmapped when it does not exist in the Food catalog", () => {
    expect(
      analyzeOtherAllergenText("cá thu", [{ label: "Cá chẽm" }]),
    ).toMatchObject({
      canonicalText: "Cá thu",
      hasUnmapped: true,
      catalogFoodLabels: [],
      items: [{ key: null, kind: "unmapped", label: "Cá thu" }],
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
