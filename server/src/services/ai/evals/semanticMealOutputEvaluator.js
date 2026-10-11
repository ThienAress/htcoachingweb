const MACRO_KEYS = Object.freeze(["protein", "carb", "fat"]);

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const asFiniteNumber = (value) => {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const numericMacros = (macros) => {
  const values = Object.fromEntries(
    MACRO_KEYS.map((key) => [key, asFiniteNumber(macros?.[key])]),
  );
  if (Object.values(values).some((value) => value == null || value < 0)) {
    return null;
  }
  return values;
};

const macroCalories = (macros) => {
  const values = numericMacros(macros);
  if (!values) return null;
  return values.protein * 4 + values.carb * 4 + values.fat * 9;
};

const emptyNutrition = () => ({ protein: 0, carb: 0, fat: 0, calories: 0 });

const addNutrition = (total, macros, calories) => {
  for (const key of MACRO_KEYS) total[key] += macros[key];
  total.calories += calories;
};

const nutritionMismatch = (actual, expected, tolerance) =>
  MACRO_KEYS.some((key) => Math.abs(actual[key] - expected[key]) > tolerance) ||
  Math.abs(actual.calories - expected.calories) > tolerance;

const mealCardData = (output) => (Array.isArray(output.cards) ? output.cards : [])
  .find((card) => (card?.cardType || card?.type) === "meal")?.data;

export const evaluateMealNumeric = (output, rule, failures) => {
  const meal = mealCardData(output);
  if (!isPlainObject(meal) || meal.status !== "complete") {
    failures.push("complete meal card is missing");
    return;
  }
  const totalCalories = asFiniteNumber(meal.totals?.calories);
  const calculatedCalories = macroCalories(meal.totals);
  const target = asFiniteNumber(rule.targetCalories);
  const tolerance = asFiniteNumber(rule.toleranceCalories);
  const minimumProtein = asFiniteNumber(rule.minimumProteinGrams);
  if ([totalCalories, calculatedCalories, target, tolerance, minimumProtein].includes(null)) {
    failures.push("meal numeric contract is incomplete");
    return;
  }
  if (Math.abs(totalCalories - calculatedCalories) > 2) {
    failures.push(`meal calories ${totalCalories} do not match 4P + 4C + 9F (${calculatedCalories})`);
  }
  if (Math.abs(totalCalories - target) > tolerance) {
    failures.push(`meal calories ${totalCalories} are outside tolerance for ${target}`);
  }
  if (Number(meal.totals.protein) < minimumProtein) {
    failures.push(`meal protein ${meal.totals.protein} is below minimum ${minimumProtein}`);
  }
  if (!Array.isArray(meal.meals) || meal.meals.length === 0) {
    failures.push("meal items are missing");
    return;
  }

  const summedMeals = emptyNutrition();
  for (const [mealIndex, mealItem] of meal.meals.entries()) {
    const itemMacros = numericMacros(mealItem?.totals);
    const itemCalories = asFiniteNumber(mealItem?.totals?.calories);
    if (!itemMacros || itemCalories == null || itemCalories < 0) {
      failures.push(`meal ${mealIndex + 1} totals are incomplete`);
      continue;
    }
    addNutrition(summedMeals, itemMacros, itemCalories);

    if (!Array.isArray(mealItem?.foods) || mealItem.foods.length === 0) {
      failures.push(`meal ${mealIndex + 1} food items are missing`);
      continue;
    }

    const summedFoods = emptyNutrition();
    let foodContractValid = true;
    for (const [foodIndex, food] of mealItem.foods.entries()) {
      const foodMacros = numericMacros(food?.macros);
      const foodCalories = asFiniteNumber(food?.calories);
      if (!foodMacros || foodCalories == null || foodCalories < 0) {
        failures.push(`meal ${mealIndex + 1} food item ${foodIndex + 1} numeric contract is incomplete`);
        foodContractValid = false;
        continue;
      }
      if (Math.abs(foodCalories - macroCalories(foodMacros)) > 0.2) {
        failures.push(`meal ${mealIndex + 1} food item ${foodIndex + 1} calories do not match its macros`);
      }
      addNutrition(summedFoods, foodMacros, foodCalories);
    }

    const itemNutrition = { ...itemMacros, calories: itemCalories };
    const itemTolerance = Math.max(0.2, mealItem.foods.length * 0.2);
    if (
      foodContractValid &&
      nutritionMismatch(itemNutrition, summedFoods, itemTolerance)
    ) {
      failures.push(`meal ${mealIndex + 1} totals do not equal the sum of food items`);
    }
    if (Math.abs(itemCalories - macroCalories(itemMacros)) > 0.2) {
      failures.push(`meal ${mealIndex + 1} calories do not match its macros`);
    }
  }

  const planNutrition = {
    ...numericMacros(meal.totals),
    calories: totalCalories,
  };
  if (
    nutritionMismatch(
      planNutrition,
      summedMeals,
      Math.max(2, meal.meals.length * 0.2),
    )
  ) {
    failures.push("meal totals do not equal the sum of meal items");
  }
};
