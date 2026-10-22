export const SELF_ASSESSMENT_STATUSES = Object.freeze(["draft", "completed"]);
export const SELF_ASSESSMENT_STEPS = Object.freeze({ min: 1, max: 4 });

export const WARNING_SIGNS = Object.freeze([
  "chest_pain",
  "dizziness",
  "shortness_of_breath",
  "radiating_pain",
  "balance_loss",
]);

export const WARNING_SIGN_LABELS = Object.freeze({
  chest_pain: "Đau ngực",
  dizziness: "Chóng mặt",
  shortness_of_breath: "Khó thở bất thường",
  radiating_pain: "Tê lan",
  balance_loss: "Mất thăng bằng",
});

export const GENDERS = Object.freeze(["male", "female"]);
export const STRESS_LEVELS = Object.freeze(["low", "medium", "high"]);
export const WORK_ACTIVITY_LEVELS = Object.freeze(["sedentary", "standing", "active", "heavy_labor"]);
export const EXPERIENCE_LEVELS = Object.freeze(["none", "beginner", "intermediate", "advanced"]);
export const GOALS = Object.freeze(["fat_loss", "weight_gain", "muscle_gain", "maintenance"]);
export const EQUIPMENT = Object.freeze(["none", "home_basic", "gym"]);
export const TEST_PERMISSIONS = Object.freeze(["full_test", "modified_test", "hold_test"]);

// Mỗi nhóm có một bài chính; biến thể nhẹ dành cho modified_test và chưa có bảng chuẩn (chỉ ghi nhận làm mốc).
export const TEST_METRICS = Object.freeze({
  upperBodyPush: {
    label: "Sức mạnh thân trên (Upper Body Push)",
    exercise: "Push-Up",
    variants: ["standard", "knee", "incline", "wall"],
    modifiedVariants: ["knee", "incline", "wall"],
    valueKey: "reps",
  },
  lowerBody: {
    label: "Sức mạnh thân dưới (Lower Body)",
    exercise: "30-Second Chair Stand",
    variants: ["standard"],
    modifiedVariants: ["standard"],
    valueKey: "reps",
  },
  coreEndurance: {
    label: "Sức bền thân giữa (Core Endurance)",
    exercise: "Plank",
    variants: ["full", "incline"],
    modifiedVariants: ["incline"],
    valueKey: "seconds",
  },
  cardio: {
    label: "Sức bền tim phổi (Cardio Capacity)",
    exercise: "Rockport 1-Mile Walk",
    variants: ["standard"],
    modifiedVariants: ["standard"],
    valueKey: "minutes",
  },
});

export const TEST_METRIC_KEYS = Object.freeze(Object.keys(TEST_METRICS));

export const LEVEL_LABELS = Object.freeze({
  needs_improvement: "Cần cải thiện",
  fair: "Trung bình",
  good: "Khá",
  very_good: "Tốt",
  excellent: "Xuất sắc",
});

export const PHASE_LABELS = Object.freeze({
  phase_1: "Cấp độ 1 · Giai đoạn 1 - Ổn định và sức bền nền (Stabilization Endurance)",
  phase_2: "Cấp độ 2 · Giai đoạn 2 - Sức mạnh bền (Strength Endurance)",
  phase_3: "Cấp độ 2 · Giai đoạn 3 - Phát triển cơ bắp (Muscular Development)",
});

// Giai đoạn cao nhất hệ thống tự đề xuất cho người tự tập (khớp AUTO_PHASE_CEILING của F1).
export const SELF_PHASE_CEILING = "phase_3";

// Khoảng hợp lý để từ chối giá trị vô lý ở server.
export const VALUE_LIMITS = Object.freeze({
  age: { min: 14, max: 90 },
  heightCm: { min: 100, max: 230 },
  weightKg: { min: 30, max: 250 },
  waistCm: { min: 40, max: 200 },
  hipCm: { min: 50, max: 200 },
  restingHeartRate: { min: 30, max: 140 },
  sleepHours: { min: 0, max: 14 },
  trainingDaysPerWeek: { min: 0, max: 7 },
  sessionDurationMinutes: { min: 0, max: 240 },
  painLevel: { min: 0, max: 10 },
  reps: { min: 0, max: 300 },
  seconds: { min: 0, max: 1800 },
  minutes: { min: 5, max: 60 },
  endHeartRate: { min: 60, max: 230 },
});
