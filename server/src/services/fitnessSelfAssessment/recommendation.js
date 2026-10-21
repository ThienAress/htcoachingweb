import { PHASE_LABELS, SELF_PHASE_CEILING } from "./constants.js";
import {
  PAIN_AREA_LABELS,
  PAIN_AREA_TIPS,
  PULL_BALANCE_EXERCISES,
  RECOMMENDATION_REFERENCES,
} from "./recommendationContent.js";
import { buildBodyInsights } from "./bodyInsights.js";
import { buildExerciseFocus } from "./exerciseFocus.js";
import { levelToRank } from "./norms.js";

const num = (value) => (value === null || value === undefined || value === "" ? null : Number(value));
const range = (min, max) => ({ min, max });
const PHASE_ORDER = ["phase_1", "phase_2", "phase_3"];

const resolveTrainingStatus = (training) => {
  const returning = !training.currentlyTraining || Boolean((training.breakDuration || "").trim());
  if (training.trainingExperience === "none" || training.trainingExperience === "beginner" || returning) {
    return { status: "novice", returning };
  }
  return { status: training.trainingExperience === "advanced" ? "advanced" : "intermediate", returning };
};

// Giai đoạn bắt đầu: chỉ lên tới phase_3; người có cờ thận trọng hoặc mức thể lực thấp luôn bắt đầu từ phase_1.
const pickPhase = ({ status, overallRank, testPermission }) => {
  const reasons = [];
  let phase = "phase_1";
  if (status === "novice") reasons.push("Bạn mới tập hoặc quay lại tập sau thời gian nghỉ nên cần xây nền ổn định trước.");
  else if (testPermission === "modified_test") reasons.push("Sàng lọc sức khỏe có điểm cần thận trọng nên bắt đầu ở mức nền.");
  else if (overallRank !== null && overallRank < 2.5) reasons.push("Kết quả tự kiểm tra còn thấp nên cần củng cố nền trước khi tăng tải.");
  else if (status === "advanced" && overallRank !== null && overallRank >= 3) {
    phase = "phase_3";
    reasons.push("Bạn tập lâu năm và kết quả tự kiểm tra đạt mức khá trở lên nên có thể vào giai đoạn phát triển cơ bắp.");
  } else {
    phase = "phase_2";
    reasons.push(
      overallRank === null
        ? "Bạn có kinh nghiệm tập nhưng chưa đủ dữ liệu xếp mức, nên bắt đầu ở mức vừa để làm quen lại."
        : "Bạn có kinh nghiệm và kết quả tự kiểm tra ổn định nên bắt đầu ở giai đoạn sức mạnh bền.",
    );
  }
  const index = Math.min(PHASE_ORDER.indexOf(phase), PHASE_ORDER.indexOf(SELF_PHASE_CEILING));
  return { code: PHASE_ORDER[index], reasons };
};

const RESISTANCE_BY_PHASE = {
  phase_1: { sets: range(1, 3), reps: range(12, 20), rir: range(3, 4), rest: range(30, 90), weeklySets: range(6, 10) },
  phase_2: { sets: range(2, 4), reps: range(8, 12), rir: range(2, 3), rest: range(60, 90), weeklySets: range(8, 14) },
  phase_3: { sets: range(3, 5), reps: range(6, 12), rir: range(1, 3), rest: range(60, 120), weeklySets: range(10, 20) },
};

const buildWeeklyPlan = ({ status, training }) => {
  const recommended = { novice: range(2, 3), intermediate: range(3, 4), advanced: range(4, 5) }[status];
  const stated = num(training.trainingDaysPerWeek);
  const days =
    stated && stated >= recommended.min && stated <= recommended.max + 1
      ? stated
      : Math.round((recommended.min + recommended.max) / 2);
  const split =
    days <= 3 ? "Toàn thân (Full Body)" : days === 4 ? "Thân trên / Thân dưới (Upper/Lower)" : "Đẩy / Kéo / Chân (Push/Pull/Legs)";
  return { daysPerWeek: days, recommendedRange: recommended, split };
};

const buildCardio = ({ status, goal, level, profile, caution }) => {
  const minutes =
    status === "novice" ? range(90, 150) : goal === "fat_loss" ? range(200, 300) : goal === "muscle_gain" ? range(90, 150) : range(150, 250);
  const age = num(profile.age);
  const resting = num(profile.restingHeartRate);
  let zones = null;
  if (age && resting) {
    const hrMax = 208 - 0.7 * age;
    const reserve = hrMax - resting;
    const zone = (low, high) => range(Math.round(resting + low * reserve), Math.round(resting + high * reserve));
    zones = { hrMax: Math.round(hrMax), moderate: zone(0.4, 0.59), vigorous: zone(0.6, 0.89) };
  }
  const moderateOnly = caution || status === "novice" || level === "needs_improvement";
  return {
    weeklyMinutes: minutes,
    intensity: moderateOnly ? "moderate" : "moderate_with_intervals",
    intensityNote: moderateOnly
      ? "Giữ cường độ vừa (nói chuyện được thành câu); tăng thời lượng tối đa khoảng 10% mỗi tuần."
      : "Phần lớn ở cường độ vừa; có thể thêm 1 buổi ngắt quãng nhẹ mỗi tuần.",
    heartRateZones: zones,
  };
};

const buildNutrition = ({ goal, profile, bmiClass }) => {
  const weight = num(profile.weightKg);
  const protein = goal === "maintenance" ? range(1.2, 1.6) : range(1.6, 2.2);
  const energy = {
    fat_loss: "Thâm hụt khoảng 10-20% so với TDEE, giảm cân chậm (khoảng 0,5-1% cân nặng mỗi tuần) để giữ cơ.",
    weight_gain: "Dư khoảng 5-10% so với TDEE, tăng cân chậm để hạn chế tăng mỡ.",
    muscle_gain: "Dư khoảng 5-10% so với TDEE, tăng cân chậm để hạn chế tăng mỡ.",
    maintenance: "Ăn quanh mức TDEE để giữ cân nặng.",
  }[goal];
  const cautions = [];
  if (bmiClass === "underweight" && goal === "fat_loss") {
    cautions.push("Chỉ số BMI của bạn đang thấp nên không khuyến khích giảm cân; hãy ưu tiên duy trì hoặc tăng cơ.");
  }
  if (["obese_1", "obese_2"].includes(bmiClass) && ["weight_gain", "muscle_gain"].includes(goal)) {
    cautions.push("BMI đang cao: nên cân nhắc giảm mỡ trước hoặc tái cấu trúc cơ thể (giữ cân, tăng cơ).");
  }
  return {
    proteinGPerKg: protein,
    proteinGramsPerDay: weight ? range(Math.round(protein.min * weight), Math.round(protein.max * weight)) : null,
    energyAdjustment: energy,
    cautions,
    tools: { tdee: "/tdee-calculator", mealPlan: "/mealplan" },
  };
};

const buildRecovery = ({ profile }) => {
  const notes = [];
  const sleep = num(profile.sleepHours);
  if (sleep !== null && sleep < 7) notes.push("Bạn đang ngủ dưới 7 giờ; hãy ưu tiên ngủ 7-9 giờ vì thiếu ngủ làm giảm hồi phục và hiệu quả tập.");
  if (profile.stressLevel === "high") notes.push("Mức căng thẳng cao: giảm khối lượng tập một chút và thêm ngày nghỉ chủ động.");
  return { sleepTargetHours: range(7, 9), notes };
};

export const buildRecommendation = ({ profile = {}, training = {}, screening = {}, flags = {}, scoring = {} } = {}) => {
  const goal = training.primaryGoal || "maintenance";
  const { status, returning } = resolveTrainingStatus(training);
  const overallRank = scoring.overallRank ?? null;
  const insights = buildBodyInsights(profile);
  const bmiClass = insights.find((item) => item.key === "bmi")?.status || null;
  const caution = flags.testPermission === "modified_test";

  if (flags.testPermission === "hold_test") {
    return {
      mode: "hold",
      startPhase: { code: "pending_review", label: "Cần được bác sĩ hoặc chuyên gia đánh giá trước khi tập", reasons: [] },
      cautions: [
        "Sàng lọc cho thấy bạn nên được bác sĩ hoặc chuyên gia y tế đánh giá trước khi tập luyện cường độ cao.",
        "Trong lúc chờ, bạn chỉ nên đi bộ nhẹ nhàng và dừng ngay khi có triệu chứng bất thường.",
      ],
      insights,
      references: RECOMMENDATION_REFERENCES,
    };
  }

  const phase = pickPhase({ status, overallRank, testPermission: flags.testPermission });
  const resistance = { ...RESISTANCE_BY_PHASE[phase.code] };
  const reduce = (num(profile.sleepHours) !== null && num(profile.sleepHours) < 6) || profile.stressLevel === "high";
  if (reduce) resistance.weeklySets = range(resistance.weeklySets.min, Math.max(resistance.weeklySets.min, resistance.weeklySets.max - 2));

  const weeklyPlan = buildWeeklyPlan({ status, training });
  const metricRanks = Object.fromEntries(
    Object.entries(scoring.metrics || {}).map(([key, metric]) => [key, levelToRank(metric.level)]),
  );
  const cardioLevel = scoring.metrics?.cardio?.level || null;

  const cautions = (flags.cautionReasons || []).map((item) => item.label);
  (Array.isArray(screening.painLocation) ? screening.painLocation : []).forEach((area) => {
    if (PAIN_AREA_TIPS[area]) cautions.push(`${PAIN_AREA_LABELS[area]}: ${PAIN_AREA_TIPS[area]}`);
  });

  const steps = (num(profile.age) || 30) >= 60 ? range(6000, 8000) : range(8000, 10000);

  return {
    mode: "plan",
    startPhase: { code: phase.code, label: PHASE_LABELS[phase.code], reasons: phase.reasons },
    trainingStatus: status,
    returningAfterBreak: returning,
    weeklyPlan: {
      ...weeklyPlan,
      sessionTips: [
        `Mỗi bài đẩy nên đi cùng một bài kéo (ví dụ ${PULL_BALANCE_EXERCISES.slice(0, 2).join(", ")}).`,
        "Khởi động 5-10 phút và dừng khi đau nhói hoặc mất kiểm soát động tác.",
      ],
    },
    resistance: {
      setsPerExercise: resistance.sets,
      repRange: resistance.reps,
      rir: resistance.rir,
      restSeconds: resistance.rest,
      weeklySetsPerMuscle: resistance.weeklySets,
    },
    cardio: buildCardio({ status, goal, level: cardioLevel, profile, caution }),
    nutrition: buildNutrition({ goal, profile, bmiClass }),
    recovery: buildRecovery({ profile }),
    dailyActivity: { stepsTarget: steps },
    focusAreas: buildExerciseFocus({ metricRanks, metrics: scoring.metrics || {}, phase: phase.code, caution }),
    cautions,
    insights,
    libraryPath: "/exercises",
    references: RECOMMENDATION_REFERENCES,
  };
};
