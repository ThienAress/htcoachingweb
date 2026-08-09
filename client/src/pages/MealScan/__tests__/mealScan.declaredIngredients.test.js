import { describe, expect, test } from "vitest";

import {
  MAX_DECLARED_INGREDIENTS,
  prepareDeclaredIngredients,
} from "../mealScan.declaredIngredients.js";

describe("meal scan declared ingredient helpers", () => {
  test("trims valid rows and ignores a fully blank row", () => {
    expect(
      prepareDeclaredIngredients([
        { id: "row-1", name: "  Dầu ô liu  ", grams: "15" },
        { id: "row-2", name: "", grams: "" },
      ]),
    ).toEqual({
      valid: true,
      code: "",
      ingredients: [{ name: "Dầu ô liu", grams: 15 }],
    });
  });

  test("blocks a partially completed row", () => {
    expect(
      prepareDeclaredIngredients([
        { id: "row-1", name: "Bơ", grams: "" },
      ]),
    ).toMatchObject({ valid: false, code: "incomplete" });
  });

  test("blocks rows outside count and gram boundaries", () => {
    const tooMany = Array.from(
      { length: MAX_DECLARED_INGREDIENTS + 1 },
      (_, index) => ({ id: `row-${index}`, name: `Mục ${index}`, grams: 10 }),
    );

    expect(prepareDeclaredIngredients(tooMany)).toMatchObject({
      valid: false,
      code: "limit",
    });
    expect(
      prepareDeclaredIngredients([{ id: "row-1", name: "Sốt", grams: 3001 }]),
    ).toMatchObject({ valid: false, code: "grams" });
  });
});
