/**
 * Pure functions cho tính toán TDEE, BMR, Macro.
 * Tách khỏi UI components để dễ maintain và test.
 */

const DEFAULT_TDEE_FORM = Object.freeze({
  gender: "",
  height: "",
  weight: "",
  age: "",
  activity: "",
  dailyMovement: "",
  steps: "",
  trainingFrequency: "",
  trainingDuration: "",
  trainingIntensity: "",
  formula: "Mifflin-St Jeor",
  bodyfat: "",
  goal: "",
  customCalorieAdjustment: "",
});

const VALID_TDEE_FORMULAS = new Set(["Mifflin-St Jeor", "Katch-McArdle"]);

export const TDEE_INPUT_LIMITS = Object.freeze({
  age: Object.freeze({ min: 13, max: 100 }),
  heightCm: Object.freeze({ min: 100, max: 250 }),
  weightKg: Object.freeze({ min: 20, max: 350 }),
  bodyFatPercent: Object.freeze({ min: 1, max: 70 }),
  calorieAdjustment: Object.freeze({ min: -1500, max: 1500 }),
  targetCalories: Object.freeze({ min: 800, max: 6000 }),
});

export function isTdeeInputWithinLimits(field, value) {
  const limits = TDEE_INPUT_LIMITS[field];
  if (!limits || value === "" || value == null) return false;

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return false;
  if (field === "age" && !Number.isInteger(numericValue)) return false;

  return numericValue >= limits.min && numericValue <= limits.max;
}

export const ACTIVITY_BANDS = Object.freeze({
  sedentary: Object.freeze({ key: "sedentary", multiplier: 1.2, range: [1.2, 1.3] }),
  light: Object.freeze({ key: "light", multiplier: 1.4, range: [1.3, 1.45] }),
  moderate: Object.freeze({ key: "moderate", multiplier: 1.55, range: [1.5, 1.6] }),
  active: Object.freeze({ key: "active", multiplier: 1.7, range: [1.65, 1.75] }),
  very_active: Object.freeze({ key: "very_active", multiplier: 1.85, range: [1.8, 1.9] }),
});

const ACTIVITY_SCORES = Object.freeze({
  dailyMovement: { mostly_seated: 0, mixed: 2, mostly_moving: 4, physical_work: 6 },
  steps: { under_5000: 0, between_5000_7999: 1, between_8000_11999: 3, at_least_12000: 5 },
  trainingFrequency: { none: 0, one_two: 1, three_four: 2, five_plus: 3 },
  trainingDuration: { none: 0, under_30: 0, between_30_45: 1, between_45_60: 2, over_60: 3 },
  trainingIntensity: { none: 0, easy: 0, moderate: 1, vigorous: 2 },
});

export function normalizeTrainingEvidence(evidence = {}) {
  const normalized = { ...evidence };
  if (normalized.trainingFrequency === "none") {
    normalized.trainingDuration = "none";
    normalized.trainingIntensity = "none";
  } else if (normalized.trainingFrequency) {
    if (normalized.trainingDuration === "none") normalized.trainingDuration = "";
    if (normalized.trainingIntensity === "none") normalized.trainingIntensity = "";
  }
  return normalized;
}

export function updateTrainingEvidence(evidence, key, value) {
  const next = { ...evidence, [key]: value };
  if (key === "trainingFrequency" && evidence?.trainingFrequency === "none") {
    next.trainingDuration = "";
    next.trainingIntensity = "";
  }
  return normalizeTrainingEvidence(next);
}

/** Đề xuất band từ vận động cả ngày; thiếu một evidence thì không suy đoán. */
export function recommendActivityBand(evidence) {
  const keys = Object.keys(ACTIVITY_SCORES);
  if (
    !evidence ||
    keys.some((key) => !Object.hasOwn(ACTIVITY_SCORES[key], evidence[key]))
  ) {
    return null;
  }

  const noTraining = evidence.trainingFrequency === "none";
  const noDuration = evidence.trainingDuration === "none";
  const noIntensity = evidence.trainingIntensity === "none";
  if (
    (noTraining && (!noDuration || !noIntensity)) ||
    (!noTraining && (noDuration || noIntensity))
  ) {
    return null;
  }

  const score = keys.reduce(
    (total, key) => total + ACTIVITY_SCORES[key][evidence[key]],
    0,
  );
  if (score <= 2) return ACTIVITY_BANDS.sedentary;
  if (score <= 5) return ACTIVITY_BANDS.light;
  if (score <= 8) return ACTIVITY_BANDS.moderate;
  if (score <= 12) return ACTIVITY_BANDS.active;
  return ACTIVITY_BANDS.very_active;
}

export function calculateTdeeEstimate(bmr, activityBand) {
  const basal = Number(bmr);
  if (!Number.isFinite(basal) || basal <= 0 || !activityBand?.range) return null;
  return {
    estimate: Math.round(basal * activityBand.multiplier),
    range: {
      min: Math.round(basal * activityBand.range[0]),
      max: Math.round(basal * activityBand.range[1]),
    },
  };
}

export function createDefaultTdeeForm() {
  return { ...DEFAULT_TDEE_FORM };
}

export function normalizeStoredTdeeForm(storedForm) {
  const form = normalizeTrainingEvidence({
    ...createDefaultTdeeForm(),
    ...(storedForm && typeof storedForm === "object" ? storedForm : {}),
  });

  if (!VALID_TDEE_FORMULAS.has(form.formula)) {
    form.formula = DEFAULT_TDEE_FORM.formula;
  }

  return form;
}

/**
 * Tính BMR theo công thức Mifflin-St Jeor
 */
export function calculateBmrMifflin(weight, height, age, gender) {
  return 10 * weight + 6.25 * height - 5 * age + (gender === "Nam" ? 5 : -161);
}

/**
 * Tính BMR theo công thức Katch-McArdle
 */
export function calculateBmrKatchMcArdle(weight, bodyfatPercent) {
  const leanMass = weight * (1 - bodyfatPercent / 100);
  return 370 + 21.6 * leanMass;
}

/**
 * Tính BMR dựa trên formula được chọn
 */
export function calculateBmr({ formula, weight, height, age, gender, bodyfat }) {
  const w = parseFloat(weight);
  const h = parseFloat(height);
  const a = parseInt(age);

  if (formula === "Mifflin-St Jeor") {
    return calculateBmrMifflin(w, h, a, gender);
  }
  return calculateBmrKatchMcArdle(w, parseFloat(bodyfat));
}

/**
 * Tính TDEE = BMR × hệ số vận động
 */
export function calculateTdee(bmr, activityMultiplier) {
  return bmr * parseFloat(activityMultiplier);
}

/**
 * Tính adjusted calories = TDEE + calorie adjustment
 */
export function calculateAdjustedCalories(tdee, calorieAdjustment) {
  const baseCalories = Number(tdee);
  const adjustment = calorieAdjustment === "" || calorieAdjustment == null
    ? 0
    : Number(calorieAdjustment);
  if (
    !Number.isFinite(baseCalories) ||
    !isTdeeInputWithinLimits("calorieAdjustment", adjustment)
  ) {
    return null;
  }

  const targetCalories = baseCalories + adjustment;
  return isTdeeInputWithinLimits("targetCalories", targetCalories)
    ? targetCalories
    : null;
}

/** Macro ratio presets */
const MACRO_PLANS = {
  "Low-carb": { protein: 0.4, fat: 0.4, carb: 0.2 },
  "Moderate-carb": { protein: 0.3, fat: 0.35, carb: 0.35 },
  "High-carb": { protein: 0.3, fat: 0.2, carb: 0.5 },
};

/**
 * Tính macro cho 3 chế độ (Low/Moderate/High carb)
 */
export function calculateMacroSet(calories) {
  if (!isTdeeInputWithinLimits("targetCalories", calories)) return null;

  const results = {};
  for (const [planName, ratio] of Object.entries(MACRO_PLANS)) {
    results[planName] = {
      protein: Math.round((calories * ratio.protein) / 4),
      carb: Math.round((calories * ratio.carb) / 4),
      fat: Math.round((calories * ratio.fat) / 9),
    };
  }
  return results;
}

/**
 * Tính tổng calories từ macro grams (dùng cho ManualMacroForm)
 * Protein: 4 kcal/g, Carb: 4 kcal/g, Fat: 9 kcal/g
 */
export function calculateCaloriesFromMacros(protein, carb, fat) {
  return Math.round(protein * 4 + carb * 4 + fat * 9);
}

/**
 * Lấy calorie adjustment mặc định theo goal
 */
export function getDefaultCalorieAdjustment(goal) {
  const defaults = {
    gain_muscle: "300",
    gain_weight: "500",
    lose_fat: "-300",
    lose_weight: "-500",
    maintain: "0",
  };
  return defaults[goal] || "";
}
