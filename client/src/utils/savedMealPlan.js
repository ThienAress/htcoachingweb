const FOOD_SLOTS = ["proteinFood", "carbFood", "fatFood"];

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
