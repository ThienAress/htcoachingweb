const INGREDIENT_FIELD_COUNT = 7;

const asFiniteNumber = (value, field, dishId) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${field} for Nutrition5k dish ${dishId}`);
  }
  return parsed;
};

export const parseNutrition5kMetadata = (csvText) => {
  const dishes = new Map();
  const lines = String(csvText || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const fields = line.split(",");
    const dishId = fields[0];
    if (!dishId || fields.length < 6) continue;
    if ((fields.length - 6) % INGREDIENT_FIELD_COUNT !== 0) {
      throw new Error(`Unexpected Nutrition5k metadata shape for ${dishId}`);
    }

    const ingredients = [];
    for (let index = 6; index < fields.length; index += INGREDIENT_FIELD_COUNT) {
      const ingredientName = fields[index + 1]?.trim();
      if (ingredientName) ingredients.push(ingredientName);
    }

    dishes.set(dishId, {
      totalMass: asFiniteNumber(fields[2], "total mass", dishId),
      nutrients: {
        calories: asFiniteNumber(fields[1], "calories", dishId),
        protein: asFiniteNumber(fields[5], "protein", dishId),
        carb: asFiniteNumber(fields[4], "carb", dishId),
        fat: asFiniteNumber(fields[3], "fat", dishId),
      },
      ingredients,
    });
  }

  return dishes;
};

export const selectEvenlySpaced = (values, requestedCount) => {
  const count = Math.min(Math.max(requestedCount, 0), values.length);
  if (count === 0) return [];
  if (count === 1) return [values[0]];
  if (count === values.length) return [...values];

  return Array.from({ length: count }, (_, index) => {
    const sourceIndex = Math.round(
      (index * (values.length - 1)) / (count - 1),
    );
    return values[sourceIndex];
  });
};

export const selectBenchmarkIds = (values, requestedCount, excludedIds) => {
  const excluded = excludedIds || new Set();
  const available = values.filter((value) => !excluded.has(value));
  return selectEvenlySpaced(available, requestedCount);
};
