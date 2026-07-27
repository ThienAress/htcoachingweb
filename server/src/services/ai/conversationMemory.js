const TDEE_GENDERS = new Set(["male", "female"]);
const ACTIVITY_LEVELS = new Set([
  "sedentary",
  "light",
  "moderate",
  "active",
  "very_active",
]);
const TDEE_GOALS = new Set(["fat_loss", "maintenance", "muscle_gain"]);
const MACRO_PLANS = ["Low-carb", "Moderate-carb", "High-carb"];

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

const sanitizeTdeeInput = (args) => {
  const input = asPlainObject(args);
  const sanitized = {
    gender: TDEE_GENDERS.has(input.gender) ? input.gender : null,
    age: boundedNumber(input.age, 13, 100),
    heightCm: boundedNumber(input.heightCm, 100, 250),
    weightKg: boundedNumber(input.weightKg, 20, 350),
    activityLevel: ACTIVITY_LEVELS.has(input.activityLevel)
      ? input.activityLevel
      : null,
    goal: TDEE_GOALS.has(input.goal) ? input.goal : null,
  };
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

const sanitizeMealArgs = (args) => {
  const input = asPlainObject(args);
  const result = {
    targetCalories: boundedNumber(input.targetCalories, 800, 6000),
    proteinGrams: boundedNumber(input.proteinGrams, 0, 500),
    carbGrams: boundedNumber(input.carbGrams, 0, 1000),
    fatGrams: boundedNumber(input.fatGrams, 0, 300),
    mealsPerDay: boundedNumber(input.mealsPerDay ?? 3, 1, 6),
  };
  return Object.values(result).some((value) => value === null) ? null : result;
};

export function updateConversationMemory(
  currentMemory,
  toolName,
  args,
  toolResult = {},
) {
  const memory = { ...asPlainObject(currentMemory) };
  if (toolName === "calculate_tdee") {
    const input = sanitizeTdeeInput(args);
    const result = sanitizeTdeeResult(toolResult);
    if (input && result) {
      memory.lastTdee = { input, result, updatedAt: new Date() };
      delete memory.lastMeal;
    }
  } else if (toolName === "suggest_meal") {
    const meal = sanitizeMealArgs(args);
    if (meal) memory.lastMeal = { ...meal, updatedAt: new Date() };
  }
  return memory;
}

export function deriveConversationMemory(messages = [], initialMemory = {}) {
  let memory = { ...asPlainObject(initialMemory) };
  const pendingCalls = [];

  for (const rawMessage of messages) {
    const message = asPlainObject(rawMessage);
    if (message.role === "assistant" && Array.isArray(message.toolCalls)) {
      pendingCalls.push(...message.toolCalls.map(asPlainObject));
      continue;
    }
    if (message.role !== "tool" || !message.toolName) continue;

    const callIndex = pendingCalls.findIndex(
      (call) => call.name === message.toolName,
    );
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
