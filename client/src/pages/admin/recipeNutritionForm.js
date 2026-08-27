export const CORE_NUTRITION_FIELDS = [
  { key: "calories", label: "Năng lượng", unit: "kcal", step: "1" },
  { key: "protein", label: "Đạm", unit: "g", step: "0.1" },
  { key: "fat", label: "Chất béo", unit: "g", step: "0.1" },
  { key: "carb", label: "Tinh bột", unit: "g", step: "0.1" },
  { key: "sugars", label: "Đường", unit: "g", step: "0.1" },
  { key: "salt", label: "Muối", unit: "g", step: "0.1" },
];

export const MAX_ADDITIONAL_RECIPE_NUTRIENTS = 60;

export const createAdditionalNutritionRow = (item = {}) => ({
  rowId: globalThis.crypto?.randomUUID?.() || String(Date.now() + Math.random()),
  label: item.label || "",
  unit: item.unit || "g",
  value: item.value ?? "",
});

export const recipeNutritionFormValues = (nutrition) => ({
  ...Object.fromEntries(
    CORE_NUTRITION_FIELDS.map(({ key }) => [key, nutrition?.[key] ?? ""]),
  ),
  additional: (nutrition?.additional || []).map(createAdditionalNutritionRow),
});

export const recipeNutritionPayload = (nutrition) => ({
  ...Object.fromEntries(
    CORE_NUTRITION_FIELDS.map(({ key }) => [key, Number(nutrition[key])]),
  ),
  additional: nutrition.additional.map(({ label, unit, value }) => ({
    label: label.trim(),
    unit,
    value: Number(value),
  })),
});
