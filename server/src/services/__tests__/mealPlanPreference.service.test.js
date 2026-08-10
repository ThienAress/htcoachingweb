import { describe, expect, it } from "vitest";

import { normalizeMealPlanPreferences } from "../mealPlanPreference.service.js";

const preferenceWithOther = (otherAllergenText) => ({
  allergyStatus: "declared",
  allergens: [],
  otherAllergenText,
  budgetVndPerDay: null,
});

describe("Meal Plan preference normalization", () => {
  it("canonicalizes recognized foods separated only by spaces", () => {
    expect(
      normalizeMealPlanPreferences(preferenceWithOther("gà bò cá")),
    ).toMatchObject({ otherAllergenText: "Gà, Bò, Cá" });
  });

  it("rejects periods used as food separators", () => {
    expect(() =>
      normalizeMealPlanPreferences(preferenceWithOther("bò.gà.heo")),
    ).toThrow("Không dùng dấu chấm giữa các thực phẩm");
  });

  it("rejects generic meat and asks for a specific type", () => {
    expect(() =>
      normalizeMealPlanPreferences(preferenceWithOther("thịt")),
    ).toThrow("Hãy nhập rõ loại thịt như gà, bò hoặc heo");
  });

  it("rejects a non-string other allergen instead of coercing it", () => {
    expect(() =>
      normalizeMealPlanPreferences(preferenceWithOther(123)),
    ).toThrow("Dị ứng khác không hợp lệ");
  });

  it("rejects control characters before whitespace normalization", () => {
    expect(() =>
      normalizeMealPlanPreferences(preferenceWithOther("Ốc biển\nThông tin khác")),
    ).toThrow("Dị ứng khác không hợp lệ");
  });
});
