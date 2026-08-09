/**
 * Pure functions cho tính toán TDEE, BMR, Macro.
 * Tách khỏi UI components để dễ maintain và test.
 */

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
  const adjustment = parseFloat(calorieAdjustment);
  if (isNaN(adjustment)) return tdee;
  return tdee + adjustment;
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
