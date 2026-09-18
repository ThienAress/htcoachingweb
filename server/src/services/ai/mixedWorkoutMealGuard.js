const normalize = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9\s.,;:!?()/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const MEAL_CONTENT_PATTERN =
  /\b(?:thuc don|bua an|so bua|mon an|khau phan|dinh luong|dinh duong|an uong|muc nap|nang luong|energy|kcal|calo|calories?|protein|chat dam|carbs?|carbohydrate|tinh bot|chat beo|macro)\b/;
const RAW_NUTRITION_VERB_PATTERN =
  /(?<!\p{L})(?:ăn|nạp|tiêu thụ)(?!\p{L})/iu;
const DAILY_INTAKE_NUMBER_PATTERN =
  /\b(?:an|nap|tieu thu)(?:\s+moi\s+ngay)?(?:\s+la)?\s+(?:1[2-9]\d{2}|[2-9]\d{3})\b/;
const WORKOUT_CONTENT_PATTERN =
  /\b(?:giao an|lich tap|buoi tap|ngay tap|bai tap|sets?|reps?|hiep|rpe|dumbbells?|ta don|bands?|day khang luc|bodyweight|press|row|squat|lunge|deadlift|plank)\b/;

export const validateMixedWorkoutSupplementOutput = (answer) => {
  const raw = String(answer || "");
  const normalized = normalize(answer);
  const reasonCodes = [];
  if (!normalized || !WORKOUT_CONTENT_PATTERN.test(normalized)) {
    reasonCodes.push("workout_content_missing");
  }
  if (
    MEAL_CONTENT_PATTERN.test(normalized) ||
    RAW_NUTRITION_VERB_PATTERN.test(raw) ||
    DAILY_INTAKE_NUMBER_PATTERN.test(normalized)
  ) {
    reasonCodes.push("meal_content_present");
  }
  return Object.freeze({
    valid: reasonCodes.length === 0,
    reasonCodes: Object.freeze(reasonCodes),
  });
};

export const MIXED_WORKOUT_CORRECTION_INSTRUCTION =
  "Phần vừa bổ sung không đạt contract workout-only. Không nhắc lại hoặc thay đổi thực đơn, món, định lượng, kcal hay macro vì công cụ đã cung cấp dữ liệu chuẩn. Chỉ trả lời phần giáo án tập luyện theo số ngày và thiết bị user yêu cầu; không nêu quy trình nội bộ.";

export const MIXED_WORKOUT_FALLBACK =
  "Mình chưa thể bổ sung giáo án tập luyện mà vẫn bảo đảm không làm sai phần dữ liệu đã được tính. Bạn hãy gửi yêu cầu riêng phần lịch tập (số ngày, thiết bị và kinh nghiệm) để mình tạo lại an toàn nhé.";
