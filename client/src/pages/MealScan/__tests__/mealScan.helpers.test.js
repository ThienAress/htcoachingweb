import { describe, expect, test } from "vitest";

import {
  applyPortionAdjustments,
  calculateMacroBalanceScore,
  deriveMealTotals,
} from "../mealScan.helpers.js";

const item = {
  id: "item-1",
  label: "Cơm",
  portionGrams: { min: 80, estimate: 100, max: 120 },
  calories: { min: 100, estimate: 130, max: 160 },
  protein: { min: 2, estimate: 3, max: 4 },
  carb: { min: 22, estimate: 28, max: 34 },
  fat: { min: 0, estimate: 1, max: 2 },
};

describe("mealScan helpers", () => {
  test("scales macro ranges from the original estimated portion", () => {
    const result = applyPortionAdjustments(
      { items: [item], total: {} },
      { "item-1": 200 },
    );

    expect(result.items[0].calories).toEqual({
      min: 200,
      estimate: 260,
      max: 320,
    });
    expect(result.items[0].portionGrams.estimate).toBe(200);
    expect(item.calories.estimate).toBe(130);
  });

  test("derives consistent totals from all adjusted items", () => {
    const totals = deriveMealTotals([
      item,
      { ...item, id: "item-2", label: "Gà" },
    ]);

    expect(totals.calories.estimate).toBe(260);
    expect(totals.protein.estimate).toBe(6);
  });
  test("keeps declared nutrition when an AI portion is adjusted", () => {
    const result = applyPortionAdjustments(
      {
        items: [item],
        declaredIngredients: [{
          name: "Dầu",
          includedInTotal: true,
          calories: { min: 270, estimate: 270, max: 270 },
          protein: { min: 0, estimate: 0, max: 0 },
          carb: { min: 0, estimate: 0, max: 0 },
          fat: { min: 30, estimate: 30, max: 30 },
        }],
        total: {},
      },
      { "item-1": 200 },
    );

    expect(result.total.calories.estimate).toBe(530);
    expect(result.total.fat.estimate).toBe(32);
  });
  test("scores a generally balanced macro distribution at ten", () => {
    expect(
      calculateMacroBalanceScore({
        protein: { estimate: 25 },
        carb: { estimate: 70 },
        fat: { estimate: 20 },
      }).score,
    ).toBe(10);
  });

  test("reduces the score when fat dominates macro energy", () => {
    expect(
      calculateMacroBalanceScore({
        protein: { estimate: 20 },
        carb: { estimate: 20 },
        fat: { estimate: 40 },
      }).score,
    ).toBeLessThanOrEqual(5);
  });

  test("fails closed to one when macro energy is unavailable", () => {
    expect(calculateMacroBalanceScore({}).score).toBe(1);
  });
});
