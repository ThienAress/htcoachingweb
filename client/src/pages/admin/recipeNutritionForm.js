export const CORE_NUTRITION_FIELDS = [
  { key: "calories", label: "Năng lượng", unit: "kcal", step: "1" },
  { key: "protein", label: "Đạm", unit: "g", step: "0.1" },
  { key: "fat", label: "Chất béo", unit: "g", step: "0.1" },
  { key: "carb", label: "Tinh bột", unit: "g", step: "0.1" },
  { key: "sugars", label: "Đường", unit: "g", step: "0.1" },
  { key: "salt", label: "Muối", unit: "g", step: "0.1" },
];

export const MAX_ADDITIONAL_RECIPE_NUTRIENTS = 60;

const normalizeAdditionalNutritionUnit = (item = {}) => {
  if (item.unit !== "mg") return item;
  const numericValue = Number(item.value);
  return {
    ...item,
    unit: "g",
    value:
      item.value === "" || !Number.isFinite(numericValue)
        ? item.value
        : numericValue / 1000,
  };
};

export const createAdditionalNutritionRow = (item = {}) => {
  const normalized = normalizeAdditionalNutritionUnit(item);
  return {
    rowId:
      globalThis.crypto?.randomUUID?.() || String(Date.now() + Math.random()),
    label: normalized.label || "",
    unit: normalized.unit || "g",
    value: normalized.value ?? "",
  };
};

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
  additional: nutrition.additional.map(({ label, unit, value }) => {
    const normalized = normalizeAdditionalNutritionUnit({ unit, value });
    return {
      label: label.trim(),
      unit: normalized.unit,
      value: Number(normalized.value),
    };
  }),
});
