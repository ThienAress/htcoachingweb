export const AI_MEMORY_CONSENT_VERSION = "2026-08";
export const AI_MEMORY_TTL_MS = 180 * 24 * 60 * 60 * 1000;

export const AI_MEMORY_VALUES = Object.freeze({
  response_style: ["concise", "balanced", "detailed"],
  training_environment: ["home", "gym", "outdoors"],
  preferred_workout_time: ["morning", "afternoon", "evening"],
  dietary_style: ["balanced", "vegetarian", "vegan", "pescatarian"],
  fitness_goal: ["fat_loss", "maintenance", "muscle_gain"],
});

export const AI_MEMORY_KINDS = Object.freeze(Object.keys(AI_MEMORY_VALUES));

export const AI_MEMORY_PROMPT_LABELS = Object.freeze({
  response_style: {
    concise: "Trả lời ngắn gọn",
    balanced: "Trả lời cân bằng",
    detailed: "Trả lời chi tiết",
  },
  training_environment: {
    home: "Ưu tiên bài tập tại nhà",
    gym: "Tập tại phòng gym",
    outdoors: "Ưu tiên tập ngoài trời",
  },
  preferred_workout_time: {
    morning: "Ưu tiên tập buổi sáng",
    afternoon: "Ưu tiên tập buổi chiều",
    evening: "Ưu tiên tập buổi tối",
  },
  dietary_style: {
    balanced: "Chế độ ăn cân bằng",
    vegetarian: "Ưu tiên món chay",
    vegan: "Ưu tiên món thuần chay",
    pescatarian: "Ưu tiên chế độ pescatarian",
  },
  fitness_goal: {
    fat_loss: "Mục tiêu fitness: giảm mỡ",
    maintenance: "Mục tiêu fitness: duy trì",
    muscle_gain: "Mục tiêu fitness: tăng cơ",
  },
});
