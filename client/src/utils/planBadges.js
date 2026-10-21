// Biểu tượng gói dùng chung: gói thấp nhất 🔥, gói giữa 💎, gói cao nhất 👑 (cả HT Fitness+ lẫn gói HLV).
// Khóa theo planCode, không theo tên hiển thị, để đổi tên gói hoặc đổi ngôn ngữ không làm mất biểu tượng.
const PLAN_ICONS = Object.freeze({
  free: "🎁",
  standard: "🔥",
  professional: "💎",
  premium: "👑",
  fitness_plus_essential: "🔥",
  fitness_plus_smart: "💎",
  fitness_plus_max: "👑",
});

export const FITNESS_PLUS_LABEL = "HT Fitness+";

export const getPlanIcon = (planCode) => PLAN_ICONS[planCode] || "";

// Tên gói hiển thị cạnh tên người dùng: gói HLV ưu tiên, nếu không có thì HT Fitness+.
export const buildPlanDisplay = ({ trainerSubscription, fitnessSubscription }) => {
  if (trainerSubscription?.planTitle) {
    return {
      kind: "trainer",
      planCode: trainerSubscription.planCode || null,
      label: trainerSubscription.planTitle,
      icon: getPlanIcon(trainerSubscription.planCode) || getPlanIcon(titleToTrainerCode(trainerSubscription.planTitle)),
    };
  }
  if (fitnessSubscription?.planCode) {
    const title = fitnessSubscription.planTitle ? ` ${fitnessSubscription.planTitle}` : "";
    return {
      kind: "fitness",
      planCode: fitnessSubscription.planCode,
      label: `${FITNESS_PLUS_LABEL}${title}`,
      icon: getPlanIcon(fitnessSubscription.planCode),
    };
  }
  return null;
};

// Dữ liệu cũ có thể chỉ có tên gói tiếng Việt.
const TITLE_TO_TRAINER_CODE = Object.freeze({
  "Tiêu chuẩn": "standard",
  "Chuyên nghiệp": "professional",
  "Cao cấp": "premium",
});
function titleToTrainerCode(title) {
  return TITLE_TO_TRAINER_CODE[title] || null;
}
