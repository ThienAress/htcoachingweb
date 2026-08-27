import { describe, expect, it } from "vitest";

import { readRecipeNutritionImportFile } from "../recipeNutritionImport.js";

const validDocument = {
  schemaVersion: 1,
  recipes: [
    {
      name: "Cơm gà gạo lứt",
      ingredients: [{ name: "Ức gà", measure: "200 g" }],
      nutrition: {
        calories: 520,
        protein: 42,
        fat: 18,
        carb: 48,
        sugars: 7,
        salt: 1.4,
        additional: [{ label: "Chất xơ", unit: "g", value: 8.5 }],
      },
    },
  ],
};

describe("recipe nutrition import file guard", () => {
  it("accepts a syntactically valid version-one JSON file", async () => {
    const file = new File(
      [JSON.stringify(validDocument)],
      "recipe-nutrition.json",
      { type: "application/json" },
    );

    await expect(readRecipeNutritionImportFile(file)).resolves.toEqual(
      validDocument,
    );
  });

  it("rejects malformed JSON and a different schema version", async () => {
    const malformed = new File(["{not-json"], "recipe-nutrition.json", {
      type: "application/json",
    });
    const wrongVersion = new File(
      [JSON.stringify({ ...validDocument, schemaVersion: 2 })],
      "recipe-nutrition.json",
      { type: "application/json" },
    );

    await expect(readRecipeNutritionImportFile(malformed)).rejects.toThrow(
      "File không phải JSON hợp lệ",
    );
    await expect(readRecipeNutritionImportFile(wrongVersion)).rejects.toThrow(
      "schemaVersion phải bằng 1",
    );
  });
});
