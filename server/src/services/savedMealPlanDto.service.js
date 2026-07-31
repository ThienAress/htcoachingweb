const id = (value) => (value ? String(value) : null);
const iso = (value) => (value ? new Date(value).toISOString() : null);

export const toSavedMealPlanDto = (document) => {
  if (!document) return null;
  const value =
    typeof document.toObject === "function"
      ? document.toObject()
      : document;
  return {
    _id: id(value._id),
    trainerIdAtCreation: id(value.trainerIdAtCreation),
    lineageKey: value.lineageKey,
    version: value.version,
    isLatest: Boolean(value.isLatest),
    status: value.status,
    title: value.title,
    source: value.source,
    target: value.target || null,
    meals: (value.meals || []).map((meal) => ({
      key: meal.key,
      name: meal.name,
      type: meal.type,
      foods: (meal.foods || []).map((food) => ({
        foodId: id(food.foodId),
        label: food.label,
        amountGrams: food.amountGrams,
        nutrition: food.nutrition,
      })),
      totals: meal.totals,
    })),
    totals: value.totals,
    archivedAt: iso(value.archivedAt),
    createdAt: iso(value.createdAt),
    updatedAt: iso(value.updatedAt),
  };
};
