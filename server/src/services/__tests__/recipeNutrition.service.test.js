import { describe, expect, it } from "vitest";

import {
  normalizeManualRecipeNutrition,
  normalizeStoredRecipeNutritionUnits,
  toPublicRecipeNutrition,
} from "../recipeNutrition.service.js";

const nutrition = (additional) => ({
  calories: 520,
  protein: 42,
  fat: 18,
  carb: 48,
  sugars: 7,
  salt: 1.4,
  additional,
});

describe("recipe nutrition units", () => {
  it("canonicalizes milligrams to grams at ingestion without rounding", () => {
    const input = nutrition([
      { label: "Kali", unit: "mg", value: 920 },
      { label: "Vitamin B12", unit: "mcg", value: 1.2 },
    ]);

    expect(normalizeManualRecipeNutrition(input).additional).toEqual([
      { label: "Kali", unit: "g", value: 0.92 },
      { label: "Vitamin B12", unit: "mcg", value: 1.2 },
    ]);
    expect(input.additional[0]).toEqual({
      label: "Kali",
      unit: "mg",
      value: 920,
    });
  });

  it("normalizes legacy stored milligrams without mutating or double converting grams", () => {
    const legacy = nutrition([
      { label: "Natri", unit: "mg", value: 5 },
      { label: "Kali", unit: "g", value: 0.92 },
    ]);

    const normalized = normalizeStoredRecipeNutritionUnits(legacy);

    expect(normalized.additional).toEqual([
      { label: "Natri", unit: "g", value: 0.005 },
      { label: "Kali", unit: "g", value: 0.92 },
    ]);
    expect(legacy.additional[0]).toEqual({
      label: "Natri",
      unit: "mg",
      value: 5,
    });
  });

  it("serializes legacy nutrition into the public read contract", () => {
    expect(
      toPublicRecipeNutrition(
        nutrition([{ label: "Kali", unit: "mg", value: 920 }]),
      ),
    ).toEqual({
      status: "available",
      source: "admin_manual",
      scope: "whole_recipe",
      values: {
        calories: 520,
        protein: 42,
        fat: 18,
        carb: 48,
        sugars: 7,
        salt: 1.4,
      },
      additional: [{ label: "Kali", unit: "g", value: 0.92 }],
    });
  });
});
