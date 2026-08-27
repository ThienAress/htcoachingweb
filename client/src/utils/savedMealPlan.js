const FOOD_SLOTS = ["proteinFood", "carbFood", "fatFood"];
const SAVED_MEAL_PLAN_TITLE_MAX_LENGTH = 30;
const PROHIBITED_TITLE_TERMS = [
  "địt",
  "dit",
  "dit me",
  "đụ",
  "đụ má",
  "đụ mẹ",
  "du ma",
  "du me",
  "đm",
  "dm",
  "dcm",
  "cặc",
  "lồn",
  "buồi",
  "đéo",
  "deo",
  "loz",
  "vcl",
  "vkl",
  "fuck",
  "shit",
  "bitch",
];

const SAVED_MEAL_PLAN_ERROR_KEYS = Object.freeze({
  SAVED_MEAL_PLAN_WRITES_DISABLED: "saved.writes_disabled",
  SAVED_MEAL_PLAN_VERSION_CONFLICT: "saved.version_conflict",
  SAVED_MEAL_PLAN_CONFLICT: "saved.version_conflict",
  SAVED_MEAL_PLAN_NOT_FOUND: "saved.not_found",
  INVALID_SAVED_MEAL_PLAN: "saved.invalid_generated",
  INVALID_SAVED_MEAL_PLAN_TITLE: "saved.invalid_title",
  MEAL_PLAN_FOOD_NOT_FOUND: "saved.invalid_generated",
});

export const getSavedMealPlanErrorKey = (error) =>
  SAVED_MEAL_PLAN_ERROR_KEYS[error?.response?.data?.code] ||
  "saved.command_error";

const toCanonicalFood = (food) => {
  if (!food) return null;
  if (!food._id) {
    throw new Error("Generated meal is missing a canonical Food ID");
  }
  const amountGrams = Number(food.amount);
  if (!Number.isFinite(amountGrams) || amountGrams <= 0) {
    throw new Error("Generated meal has an invalid food amount");
  }
  return {
    foodId: String(food._id),
    amountGrams: Math.round(amountGrams * 10) / 10,
  };
};

const escapePattern = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const containsProhibitedTitleTerm = (value) =>
  PROHIBITED_TITLE_TERMS.some((term) =>
    new RegExp(
      `(^|[^\\p{L}\\p{N}])${escapePattern(term)}(?=$|[^\\p{L}\\p{N}])`,
      "iu",
    ).test(value),
  );

export const validateSavedMealPlanTitle = (value) => {
  const normalized = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (!normalized) return { valid: false, value: normalized, reason: "required" };
  if (normalized.length > SAVED_MEAL_PLAN_TITLE_MAX_LENGTH) {
    return { valid: false, value: normalized, reason: "too_long" };
  }
  if (containsProhibitedTitleTerm(normalized)) {
    return { valid: false, value: normalized, reason: "prohibited" };
  }
  return { valid: true, value: normalized, reason: null };
};

export const buildSavedMealPlanPayload = ({
  requestId,
  title,
  target = null,
  meals,
}) => {
  if (!Array.isArray(meals) || meals.length === 0) {
    throw new Error("Generated meal plan is empty");
  }
  return {
    requestId,
    title,
    target,
    meals: meals.map((meal, index) => ({
      key: meal.key || `meal-${index + 1}`,
      name: meal.mealName || `Meal ${index + 1}`,
      type: meal.mealType || "other",
      foods: FOOD_SLOTS.map((slot) => toCanonicalFood(meal[slot])).filter(
        Boolean,
      ),
    })),
  };
};

export const buildSavedMealPlanPayloadFromSnapshot = ({
  requestId,
  title,
  plan,
}) => {
  if (!plan || !Array.isArray(plan.meals) || plan.meals.length === 0) {
    throw new Error("Saved meal plan snapshot is empty");
  }
  return {
    requestId,
    title,
    target: plan.target || null,
    meals: plan.meals.map((meal) => ({
      key: meal.key,
      name: meal.name,
      type: meal.type,
      foods: (meal.foods || []).map((food) => ({
        foodId: String(food.foodId),
        amountGrams: Number(food.amountGrams),
      })),
    })),
  };
};

const tableFood = (food) => ({
  _id: food.foodId,
  label: food.label,
  amount: Number(food.amountGrams),
  nutrition: food.nutrition,
});

const dominantSlot = (food) => {
  const values = [
    ["proteinFood", Number(food.nutrition?.protein || 0)],
    ["carbFood", Number(food.nutrition?.carb || 0)],
    ["fatFood", Number(food.nutrition?.fat || 0)],
  ];
  return values.sort((left, right) => right[1] - left[1])[0][0];
};

export const savedMealPlanToTableMeals = (plan) =>
  (plan?.meals || []).map((meal) => {
    const slots = {
      proteinFood: null,
      carbFood: null,
      fatFood: null,
    };
    for (const food of meal.foods || []) {
      const preferred = dominantSlot(food);
      const target = slots[preferred] === null
        ? preferred
        : Object.keys(slots).find((slot) => slots[slot] === null);
      if (target) slots[target] = tableFood(food);
    }
    return {
      key: meal.key,
      mealName: meal.name,
      mealType: meal.type,
      ...slots,
    };
  });
