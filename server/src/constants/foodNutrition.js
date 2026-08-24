export const FOOD_CORE_NUTRIENTS = Object.freeze([
  "calories",
  "protein",
  "carb",
  "fat",
]);
export const FOOD_OPTIONAL_NUTRIENTS = Object.freeze([
  "saturates",
  "sugars",
  "fibre",
  "salt",
]);

export const FOOD_NUTRIENTS = Object.freeze([
  ...FOOD_CORE_NUTRIENTS,
  ...FOOD_OPTIONAL_NUTRIENTS,
]);
