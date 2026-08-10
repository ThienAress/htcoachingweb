export const MEAL_PLAN_ALLERGY_STATUSES = Object.freeze([
  "none_known",
  "declared",
  "unsure",
]);

export const MEAL_PLAN_ALLERGEN_KEYS = Object.freeze([
  "milk",
  "egg",
  "fish",
  "crustacean_shellfish",
  "tree_nut",
  "peanut",
  "wheat",
  "soy",
  "sesame",
]);

export const MEAL_PLAN_BUDGET_VND = Object.freeze({
  min: 30_000,
  max: 2_000_000,
});

export const MEAL_PLAN_OTHER_ALLERGEN_TEXT = Object.freeze({
  maxLength: 120,
  maxItems: 8,
});

export const MEAL_PLAN_SPECIFIC_FOOD_KEYS = Object.freeze([
  "beef",
  "chicken",
  "pork",
  "duck",
  "goat",
  "lamb",
]);

export const MEAL_PLAN_ALLERGEN_REVIEW_SCOPES = Object.freeze([
  "specific_foods",
]);
