const TDEE_GENDERS = new Set(["male", "female"]);
const ACTIVITY_LEVELS = new Set([
  "sedentary",
  "light",
  "moderate",
  "active",
  "very_active",
]);
const TDEE_GOALS = new Set(["fat_loss", "maintenance", "muscle_gain"]);
const TDEE_EVIDENCE = {
  dailyMovement: new Set(["mostly_seated", "mixed", "mostly_moving", "physical_work"]),
  steps: new Set(["under_5000", "between_5000_7999", "between_8000_11999", "at_least_12000"]),
  trainingFrequency: new Set(["none", "one_two", "three_four", "five_plus"]),
  trainingDuration: new Set(["none", "under_30", "between_30_45", "between_45_60", "over_60"]),
  trainingIntensity: new Set(["none", "easy", "moderate", "vigorous"]),
};
const MACRO_PLANS = ["Low-carb", "Moderate-carb", "High-carb"];
const MEAL_ALLERGENS = new Set([
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

const asPlainObject = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value.toObject?.() || value;
};

const boundedNumber = (value, min, max) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max
    ? number
    : null;
};

const sanitizeTdeeInput = (args, toolResult) => {
  const input = asPlainObject(args);
  const cardData = asPlainObject(asPlainObject(toolResult?.uiCard).data);
  const derivedActivity = asPlainObject(cardData.activity).key;
  const sanitized = {
    gender: TDEE_GENDERS.has(input.gender) ? input.gender : null,
    age: boundedNumber(input.age, 13, 100),
    heightCm: boundedNumber(input.heightCm, 100, 250),
    weightKg: boundedNumber(input.weightKg, 20, 350),
    activityLevel: ACTIVITY_LEVELS.has(input.activityLevel || derivedActivity)
      ? input.activityLevel || derivedActivity
      : null,
    goal: TDEE_GOALS.has(input.goal) ? input.goal : null,
  };
  for (const [key, allowed] of Object.entries(TDEE_EVIDENCE)) {
    sanitized[key] = allowed.has(input[key]) ? input[key] : null;
  }
  const adjustment = boundedNumber(input.calorieAdjustment, -1500, 1500);
  if (adjustment !== null) sanitized.calorieAdjustment = adjustment;
  return Object.values(sanitized).some((value) => value === null)
    ? null
    : sanitized;
};

const sanitizeMacros = (value) => {
  const source = asPlainObject(value);
  const result = {};
  for (const plan of MACRO_PLANS) {
    const macro = asPlainObject(source[plan]);
    const protein = boundedNumber(macro.protein, 0, 500);
    const carb = boundedNumber(macro.carb, 0, 1000);
    const fat = boundedNumber(macro.fat, 0, 300);
    if (protein !== null && carb !== null && fat !== null) {
      result[plan] = { protein, carb, fat };
    }
  }
  return result;
};

const sanitizeTdeeResult = (toolResult) => {
  const card = asPlainObject(toolResult?.uiCard);
  if (card.cardType !== "tdee") return null;
  const data = asPlainObject(card.data);
  const result = {
    bmr: boundedNumber(data.bmr, 500, 5000),
    tdee: boundedNumber(data.tdee, 500, 8000),
    targetCalories: boundedNumber(data.targetCalories, 800, 6000),
    adjustment: boundedNumber(data.adjustment, -1500, 1500),
    macros: sanitizeMacros(data.macros),
  };
  return result.bmr !== null &&
    result.tdee !== null &&
    result.targetCalories !== null
    ? result
    : null;
};

const boundedStringList = (values, maxItems, maxLength) => [
  ...new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => String(value || "").trim())
      .filter((value) => value && value.length <= maxLength),
  ),
].slice(0, maxItems);

const sanitizeMealArgs = (args) => {
  const input = asPlainObject(args);
  const required = {
    targetCalories: boundedNumber(input.targetCalories, 800, 6000),
    proteinGrams: boundedNumber(input.proteinGrams, 0, 500),
    carbGrams: boundedNumber(input.carbGrams, 0, 1000),
    fatGrams: boundedNumber(input.fatGrams, 0, 300),
    mealsPerDay: boundedNumber(input.mealsPerDay ?? 3, 1, 6),
  };
  if (Object.values(required).some((value) => value === null)) return null;

  const targetToleranceCalories = boundedNumber(
    input.targetToleranceCalories,
    0,
    300,
  );
  const minimumProteinGrams = boundedNumber(
    input.minimumProteinGrams,
    0,
    500,
  );
  const excludedFoods = boundedStringList(input.excludedFoods, 12, 100);
  const excludedAllergens = boundedStringList(
    input.excludedAllergens,
    9,
    40,
  ).filter((allergen) => MEAL_ALLERGENS.has(allergen));
  const budgetVndPerDay = boundedNumber(
    input.budgetVndPerDay,
    30_000,
    2_000_000,
  );

  return {
    ...required,
    ...(targetToleranceCalories !== null && { targetToleranceCalories }),
    ...(minimumProteinGrams !== null && { minimumProteinGrams }),
    ...(excludedFoods.length > 0 && { excludedFoods }),
    ...(excludedAllergens.length > 0 && { excludedAllergens }),
    ...(input.lactoseFree === true && { lactoseFree: true }),
    ...(budgetVndPerDay !== null && { budgetVndPerDay }),
  };
};

const boundedText = (value, maxLength) => {
  const text = String(value || "").trim();
  return text && text.length <= maxLength ? text : null;
};

const sanitizeMealMacros = (value) => {
  const source = asPlainObject(value);
  const protein = boundedNumber(source.protein, 0, 500);
  const carb = boundedNumber(source.carb, 0, 1000);
  const fat = boundedNumber(source.fat, 0, 300);
  return protein === null || carb === null || fat === null
    ? null
    : { protein, carb, fat };
};

const macroCalories = ({ protein, carb, fat }) =>
  Number((4 * protein + 4 * carb + 9 * fat).toFixed(1));

const addMealMacros = (values) => values.reduce((total, macro) => ({
  protein: Number((total.protein + macro.protein).toFixed(1)),
  carb: Number((total.carb + macro.carb).toFixed(1)),
  fat: Number((total.fat + macro.fat).toFixed(1)),
}), { protein: 0, carb: 0, fat: 0 });

const sanitizeMealPlan = (value) => {
  const source = asPlainObject(value);
  if (
    source.status !== "complete" ||
    source.nutritionMethod !== "server_calculated_4p_4c_9f" ||
    !Array.isArray(source.meals) ||
    source.meals.length < 1 ||
    source.meals.length > 6
  ) return null;

  const meals = [];
  for (const rawMeal of source.meals) {
    const meal = asPlainObject(rawMeal);
    if (!Array.isArray(meal.foods) || meal.foods.length < 1 || meal.foods.length > 12) {
      return null;
    }
    const foods = [];
    for (const rawFood of meal.foods) {
      const food = asPlainObject(rawFood);
      const foodId = boundedText(food.foodId, 100);
      const name = boundedText(food.name, 120);
      const amountGrams = boundedNumber(food.amountGrams, 0.1, 5000);
      const macros = sanitizeMealMacros(food.macros);
      if (!foodId || !name || amountGrams === null || !macros) return null;
      foods.push({
        foodId,
        name,
        amountGrams,
        macros,
        calories: macroCalories(macros),
      });
    }
    const macros = addMealMacros(foods.map((food) => food.macros));
    meals.push({
      label: boundedText(meal.label, 80) || `Bữa ${meals.length + 1}`,
      foods,
      totals: { ...macros, calories: macroCalories(macros) },
    });
  }

  const totalsMacro = addMealMacros(meals.map((meal) => meal.totals));
  const targetCalories = boundedNumber(source.targetCalories, 800, 6000);
  const targetToleranceCalories = boundedNumber(
    source.targetToleranceCalories ?? 100,
    0,
    300,
  );
  if (targetCalories === null || targetToleranceCalories === null) return null;
  const targets = asPlainObject(source.targets);
  const minimumProteinGrams = boundedNumber(
    targets.minimumProteinGrams,
    0,
    500,
  );
  return {
    status: "complete",
    targetCalories,
    targetToleranceCalories,
    nutritionMethod: "server_calculated_4p_4c_9f",
    meals,
    totals: { ...totalsMacro, calories: macroCalories(totalsMacro) },
    ...(minimumProteinGrams !== null && {
      targets: { minimumProteinGrams },
    }),
  };
};

export function updateConversationMemory(
  currentMemory,
  toolName,
  args,
  toolResult = {},
) {
  const memory = { ...asPlainObject(currentMemory) };
  if (toolName === "calculate_tdee") {
    const input = sanitizeTdeeInput(args, toolResult);
    const result = sanitizeTdeeResult(toolResult);
    if (input && result) {
      memory.lastTdee = { input, result, updatedAt: new Date() };
      delete memory.lastMeal;
    }
  } else if (toolName === "suggest_meal") {
    const meal = sanitizeMealArgs(args);
    const plan = sanitizeMealPlan(asPlainObject(toolResult?.uiCard).data);
    if (meal && plan) {
      const previousRevision = boundedNumber(
        asPlainObject(memory.lastMeal).revision,
        0,
        1_000_000,
      ) || 0;
      memory.lastMeal = {
        ...meal,
        plan,
        revision: previousRevision + 1,
        updatedAt: new Date(),
      };
    }
  }
  return memory;
}

export function deriveConversationMemory(messages = [], initialMemory = {}) {
  let memory = { ...asPlainObject(initialMemory) };
  const storedTdee = asPlainObject(memory.lastTdee);
  if (memory.lastTdee) {
    const input = sanitizeTdeeInput(storedTdee.input);
    const result = sanitizeTdeeResult({
      uiCard: { cardType: "tdee", data: storedTdee.result },
    });
    if (input && result) memory.lastTdee = { ...storedTdee, input, result };
    else delete memory.lastTdee;
  }
  if (memory.lastMeal) {
    const storedMeal = asPlainObject(memory.lastMeal);
    const meal = sanitizeMealArgs(storedMeal);
    if (!meal) {
      delete memory.lastMeal;
    } else {
      const plan = sanitizeMealPlan(storedMeal.plan);
      const revision = boundedNumber(storedMeal.revision, 0, 1_000_000) || 0;
      memory.lastMeal = {
        ...meal,
        ...(plan && { plan }),
        revision,
        ...(storedMeal.updatedAt && { updatedAt: storedMeal.updatedAt }),
      };
    }
  }
  const pendingCalls = [];

  for (const rawMessage of messages) {
    const message = asPlainObject(rawMessage);
    if (message.role === "assistant" && Array.isArray(message.toolCalls)) {
      pendingCalls.push(...message.toolCalls.map(asPlainObject));
      continue;
    }
    if (message.role !== "tool" || !message.toolName) continue;

    const callIndex = message.toolCallId
      ? pendingCalls.findIndex(
          (call) =>
            call.id === message.toolCallId && call.name === message.toolName,
        )
      : pendingCalls.findIndex((call) => call.name === message.toolName);
    if (callIndex < 0) continue;
    const [call] = pendingCalls.splice(callIndex, 1);
    memory = updateConversationMemory(
      memory,
      message.toolName,
      call.args,
      { uiCard: message.uiCard },
    );
  }

  return memory;
}
