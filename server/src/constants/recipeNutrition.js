export const CORE_RECIPE_NUTRITION_FIELDS = Object.freeze([
  "calories",
  "protein",
  "fat",
  "carb",
  "sugars",
  "salt",
]);

export const RECIPE_NUTRITION_UNITS = Object.freeze([
  "kcal",
  "g",
  "mg",
  "mcg",
]);

export const MAX_ADDITIONAL_RECIPE_NUTRIENTS = 60;

export const RESERVED_RECIPE_NUTRITION_LABELS = new Set([
  "calories",
  "năng lượng",
  "protein",
  "đạm",
  "chất đạm",
  "fat",
  "chất béo",
  "carb",
  "tinh bột",
  "sugars",
  "đường",
  "salt",
  "muối",
]);
