// TDEE Calculator Tool — Duplicate logic từ FE TdeeCalculator.jsx
// Công thức: Mifflin-St Jeor (chuẩn nhất cho người bình thường)

const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const GOAL_ADJUSTMENTS = {
  fat_loss: -300,
  maintenance: 0,
  muscle_gain: 300,
};

const MACRO_PLANS = {
  "Low-carb": { protein: 0.4, fat: 0.4, carb: 0.2 },
  "Moderate-carb": { protein: 0.3, fat: 0.35, carb: 0.35 },
  "High-carb": { protein: 0.3, fat: 0.2, carb: 0.5 },
};

/**
 * Tính TDEE + BMR + Macros
 * @param {{ gender, age, heightCm, weightKg, activityLevel, goal }} params
 * @returns {{ text: string, uiCard: object }}
 */
export async function calculateTdee(params) {
  const { gender, age, heightCm, weightKg, activityLevel, goal, calorieAdjustment } = params;

  // Mifflin-St Jeor formula
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + (gender === "male" ? 5 : -161);
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel] || 1.55;
  const tdee = Math.round(bmr * multiplier);
  // calorieAdjustment tùy chỉnh ưu tiên hơn goal default
  const adjustment = calorieAdjustment != null ? calorieAdjustment : (GOAL_ADJUSTMENTS[goal] || 0);
  const targetCalories = Math.round(tdee + adjustment);

  // Tính macros cho 3 plans
  const macros = {};
  for (const [planName, ratio] of Object.entries(MACRO_PLANS)) {
    macros[planName] = {
      protein: Math.round((targetCalories * ratio.protein) / 4),
      carb: Math.round((targetCalories * ratio.carb) / 4),
      fat: Math.round((targetCalories * ratio.fat) / 9),
    };
  }

  const goalLabel = { fat_loss: "Giảm mỡ", maintenance: "Duy trì", muscle_gain: "Tăng cơ" }[goal];
  const activityLabel = {
    sedentary: "Ít vận động",
    light: "Tập nhẹ 1-3 ngày/tuần",
    moderate: "Tập 3-5 ngày/tuần",
    active: "Tập 6-7 ngày/tuần",
    very_active: "Tập rất nặng",
  }[activityLevel];

  // Text cho LLM tiếp tục trả lời
  const text =
    `TDEE: ${tdee} kcal/ngày (BMR: ${Math.round(bmr)} kcal). ` +
    `Mục tiêu "${goalLabel}" → Calo mục tiêu: ${targetCalories} kcal/ngày (${adjustment > 0 ? "+" : ""}${adjustment} kcal). ` +
    `Macro gợi ý (Moderate-carb): Protein ${macros["Moderate-carb"].protein}g, Carb ${macros["Moderate-carb"].carb}g, Fat ${macros["Moderate-carb"].fat}g.`;

  // Structured data cho FE render card
  const uiCard = {
    cardType: "tdee",
    data: {
      bmr: Math.round(bmr),
      tdee,
      targetCalories,
      goal: goalLabel,
      activityLevel: activityLabel,
      adjustment,
      macros,
      input: { gender, age, heightCm, weightKg },
    },
  };

  return { text, uiCard };
}
