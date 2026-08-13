// TDEE estimate — semantics mirror public TDEE helpers.

const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  light: 1.4,
  moderate: 1.55,
  active: 1.7,
  very_active: 1.85,
};

const ACTIVITY_RANGES = {
  sedentary: [1.2, 1.3],
  light: [1.3, 1.45],
  moderate: [1.5, 1.6],
  active: [1.65, 1.75],
  very_active: [1.8, 1.9],
};

const ACTIVITY_SCORES = {
  dailyMovement: { mostly_seated: 0, mixed: 2, mostly_moving: 4, physical_work: 6 },
  steps: { under_5000: 0, between_5000_7999: 1, between_8000_11999: 3, at_least_12000: 5 },
  trainingFrequency: { none: 0, one_two: 1, three_four: 2, five_plus: 3 },
  trainingDuration: { none: 0, under_30: 0, between_30_45: 1, between_45_60: 2, over_60: 3 },
  trainingIntensity: { none: 0, easy: 0, moderate: 1, vigorous: 2 },
};

const invalidTdeeInput = (message, invalidFields) =>
  Object.assign(new Error(message), {
    code: "TDEE_VALIDATION_FAILED",
    invalidFields,
  });

function assertConsistentTrainingEvidence(params) {
  const noTraining = params.trainingFrequency === "none";
  const noDuration = params.trainingDuration === "none";
  const noIntensity = params.trainingIntensity === "none";
  if (
    (noTraining && (!noDuration || !noIntensity)) ||
    (!noTraining && (noDuration || noIntensity))
  ) {
    throw invalidTdeeInput("Bằng chứng tập luyện không nhất quán", [
      "trainingFrequency",
      "trainingDuration",
      "trainingIntensity",
    ]);
  }
}

function recommendActivityLevel(params) {
  assertConsistentTrainingEvidence(params);
  const score = Object.entries(ACTIVITY_SCORES).reduce((total, [key, scores]) => {
    if (!Object.hasOwn(scores, params[key])) {
      throw invalidTdeeInput("Thiếu bằng chứng vận động cả ngày", [key]);
    }
    return total + scores[params[key]];
  }, 0);
  if (score <= 2) return "sedentary";
  if (score <= 5) return "light";
  if (score <= 8) return "moderate";
  if (score <= 12) return "active";
  return "very_active";
}

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
  const { gender, age, heightCm, weightKg, goal, calorieAdjustment } = params;

  const recommendedActivityLevel = recommendActivityLevel(params);
  if (params.activityLevel && params.activityLevel !== recommendedActivityLevel) {
    throw invalidTdeeInput(
      "Mức vận động không khớp với bằng chứng cả ngày",
      ["activityLevel"],
    );
  }
  const activityLevel = recommendedActivityLevel;

  // Mifflin-St Jeor formula
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + (gender === "male" ? 5 : -161);
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel];
  if (!multiplier) throw new Error("Mức vận động không hợp lệ");
  const tdee = Math.round(bmr * multiplier);
  const [rangeMin, rangeMax] = ACTIVITY_RANGES[activityLevel];
  const tdeeRange = {
    min: Math.round(bmr * rangeMin),
    max: Math.round(bmr * rangeMax),
  };
  // calorieAdjustment tùy chỉnh ưu tiên hơn goal default
  const adjustment = calorieAdjustment != null ? calorieAdjustment : (GOAL_ADJUSTMENTS[goal] || 0);
  const targetCalories = Math.round(tdee + adjustment);
  const targetCaloriesRange = {
    min: Math.round(tdeeRange.min + adjustment),
    max: Math.round(tdeeRange.max + adjustment),
  };
  if (targetCalories < 800 || targetCalories > 6000) {
    throw invalidTdeeInput(
      "Mức điều chỉnh calo đưa mục tiêu ra ngoài ngưỡng an toàn",
      ["calorieAdjustment"],
    );
  }

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
    sedentary: "Ít vận động cả ngày",
    light: "Vận động nhẹ cả ngày",
    moderate: "Vận động vừa cả ngày",
    active: "Vận động nhiều cả ngày",
    very_active: "Vận động rất nhiều cả ngày",
  }[activityLevel];

  // Text cho LLM tiếp tục trả lời
  const text =
    `TDEE ước tính: ${tdee} kcal/ngày; khoảng hợp lý ${tdeeRange.min}-${tdeeRange.max} kcal/ngày (BMR: ${Math.round(bmr)} kcal). ` +
    `Mục tiêu "${goalLabel}" → Calo mục tiêu: ${targetCalories} kcal/ngày (${adjustment > 0 ? "+" : ""}${adjustment} kcal).\n` +
    `Hệ số đề xuất ${multiplier} từ vận động cả ngày (khoảng ${rangeMin}-${rangeMax}). Theo dõi xu hướng cân nặng và mức tuân thủ ít nhất 14 ngày trước khi điều chỉnh nhỏ.\n` +
    `Các chế độ ăn phân bổ Macro tương ứng:\n` +
    `- Low-carb: Protein ${macros["Low-carb"].protein}g, Carb ${macros["Low-carb"].carb}g, Fat ${macros["Low-carb"].fat}g.\n` +
    `- Moderate-carb: Protein ${macros["Moderate-carb"].protein}g, Carb ${macros["Moderate-carb"].carb}g, Fat ${macros["Moderate-carb"].fat}g.\n` +
    `- High-carb: Protein ${macros["High-carb"].protein}g, Carb ${macros["High-carb"].carb}g, Fat ${macros["High-carb"].fat}g.`;

  // Structured data cho FE render card
  const uiCard = {
    cardType: "tdee",
    data: {
      bmr: Math.round(bmr),
      tdee,
      tdeeRange,
      targetCalories,
      targetCaloriesRange,
      goal: goalLabel,
      activityLevel: activityLabel,
      activity: {
        key: activityLevel,
        label: activityLabel,
        multiplier,
        range: [rangeMin, rangeMax],
      },
      calibrationDays: 14,
      adjustment,
      macros,
      input: {
        gender,
        age,
        heightCm,
        weightKg,
        dailyMovement: params.dailyMovement,
        steps: params.steps,
        trainingFrequency: params.trainingFrequency,
        trainingDuration: params.trainingDuration,
        trainingIntensity: params.trainingIntensity,
      },
    },
  };

  return { text, uiCard };
}
