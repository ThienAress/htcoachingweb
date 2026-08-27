export const buildRecipeNutrition = (overrides = {}) => ({
  calories: 520,
  protein: 42,
  fat: 18,
  carb: 48,
  sugars: 7,
  salt: 1.4,
  additional: [
    { label: "Chất xơ", unit: "g", value: 8.5 },
    { label: "Kali", unit: "mg", value: 920 },
  ],
  ...overrides,
});

export const buildRecipeNutritionImportItem = (
  name,
  ingredients,
  overrides = {},
) => ({
  name,
  ingredients,
  nutrition: buildRecipeNutrition(),
  ...overrides,
});

export const buildRecipeNutritionImportDocument = (recipes) => ({
  schemaVersion: 1,
  recipes,
});

export const attachRecipeNutritionJson = (
  testRequest,
  document,
  dryRun,
  previewToken,
) => {
  const requestWithFields = testRequest.field("dryRun", String(dryRun));
  if (previewToken) requestWithFields.field("previewToken", previewToken);
  return requestWithFields.attach(
    "file",
    Buffer.from(JSON.stringify(document), "utf8"),
    {
      filename: "recipe-nutrition.json",
      contentType: "application/json",
    },
  );
};
