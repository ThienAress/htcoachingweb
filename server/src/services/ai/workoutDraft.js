import {
  hasBandOnlyConstraint,
  hasLimitedDumbbellBandConstraint,
  validateWorkoutEquipmentOutput,
} from "./equipmentConstraint.js";

const normalize = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/đ/gi, "d")
  .toLowerCase()
  .replace(/[^a-z0-9\s/%.-]/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const WORKOUT_INTENT_PATTERN =
  /\b(?:lich tap|giao an|chuong trinh tap|workout plan|training plan|lap lich|tao lich)\b/;
const BEGINNER_PATTERN =
  /\b(?:nguoi moi|moi bat dau|beginner|beginners|newbie|newbies)\b/;
const NO_EQUIPMENT_PATTERN =
  /\b(?:khong can dung cu|khong co dung cu|khong dung cu|no equipment|without equipment|bodyweight|body weight)\b/;
const DUMBBELL_PATTERN = /\b(?:ta don|ta tay|dumbbells?)\b/;
const BAND_PATTERN =
  /\b(?:day khang luc|day dan hoi|resistance bands?|elastic bands?|mini bands?|loop bands?)\b/;
const ONLY_PATTERN = /\b(?:chi co|chi dung|only have|only use|have only)\b/;
const DELOAD_PATTERN = /\b(?:deload|giam tai|tuan hoi phuc)\b/;
const SUPPORTED_LEG_SPACING_PATTERN =
  /\b(?:khong muon tap chan hai ngay lien tiep|khong tap chan hai ngay lien nhau|no consecutive leg days?)\b/g;
const BODY_PART_CONSTRAINT_PATTERN =
  /\b(?:(?:chi(?:\s+muon)?|only)\s+tap\s+(?:than tren|than duoi|upper body|lower body)|(?:tranh|avoid|bo qua|skip|khong thich|khong muon tap|khong tap)\s+(?:bai\s+)?(?:chan|vai|nguc|lung|tay|bung|squat|lunge|press|overhead|legs?|shoulders?|chest|back|arms?|core)|(?:uu tien|tap trung|focus|nhieu hon)\s+(?:vao\s+)?(?:chan|vai|nguc|lung|tay|bung|legs?|shoulders?|chest|back|arms?|core)|upper body only|only upper body)\b/;
const EXACT_LOAD_PATTERN =
  /\b\d+(?:[.,]\d+)?\s*(?:kg|kilograms?|lbs?|pounds?)\b/;
const EXACT_PROGRESSION_PATTERN =
  /\b(?:tang|increase|them|add)\s+\d+(?:[.,]\d+)?\s*(?:%|phan tram|kg|kilograms?|lbs?|pounds?|lan|reps?)(?=\s|$)/;
const NEGATED_HEALTH_PATTERN =
  /\b(?:khong|ko|no|without)\s+(?:(?:co|bi)\s+)?(?:dau|chan thuong|injur(?:y|ies)|pain)\b/g;
const HEALTH_CONSTRAINT_PATTERN =
  /\b(?:dau|chan thuong|injur(?:y|ies)|pain|benh|disease|diabetes|tieu duong|huyet ap|tim mach|thoat vi|hiv|mang thai|pregnan(?:t|cy))\b/;
const DIETARY_REQUEST_PATTERN =
  /\b(?:thuc don|an gi|an uong|dinh duong|kcal|calo(?:rie)?s?|protein|carbs?|chat beo|meal plans?|diet plans?)\b/;
const REQUIRED_EXERCISE_PATTERN =
  /\b(?:bat buoc co|phai co|dung chinh xac|must include|have to include|exact exercises?)\b/;
const CUSTOM_CONSTRAINT_PATTERN =
  /\b(?:tranh|avoid|khong muon|khong thich|uu tien|tap trung|focus|bat buoc|gioi han|exclude|skip)\b/;
const EXACT_PRESCRIPTION_PATTERN =
  /\b(?:rpe|rir)\s*\d|\b\d+\s*(?:hiep|sets?)\s*x\s*\d+|\b\d+\s+bai\s+(?:moi|mot)\s+buoi\b/;
const FIXED_SCHEDULE_PATTERN =
  /\b(?:thu\s*(?:2|3|4|5|6|7)|chu nhat|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/;
const DURATION_MENTION_PATTERN = /\b\d{2,3}(?:\s*[-–]\s*\d{2,3})?\s*(?:phut|minutes?|mins?)\b/;
const AGE_PATTERN = /\b(\d{1,2})\s*(?:tuoi|years? old|year-old)\b/;
const MINOR_PATTERN = /\b(?:tre em|vi thanh nien|minor|child|children|teenager)\b/;

const SESSION_TEMPLATES = Object.freeze({
  dumbbellBand: Object.freeze({
    upperA: ["Dumbbell Floor Press", "One-arm Dumbbell Row", "Standing Dumbbell Shoulder Press", "Resistance Band Pull-Apart"],
    lowerA: ["Dumbbell Goblet Squat", "Dumbbell Romanian Deadlift", "Dumbbell Reverse Lunge", "Resistance Band Lateral Walk"],
    upperB: ["Dumbbell Squeeze Floor Press", "Bent-over Dumbbell Row", "Dumbbell Lateral Raise", "Resistance Band Pull-Apart"],
    lowerB: ["Dumbbell Sumo Squat", "Dumbbell Romanian Deadlift", "Dumbbell Split Squat", "Dumbbell Calf Raise"],
    fullA: ["Dumbbell Floor Press", "One-arm Dumbbell Row", "Dumbbell Goblet Squat", "Dumbbell Romanian Deadlift"],
    fullB: ["Standing Dumbbell Shoulder Press", "Bent-over Dumbbell Row", "Dumbbell Reverse Lunge", "Resistance Band Lateral Walk"],
    fullC: ["Dumbbell Squeeze Floor Press", "Resistance Band Pull-Apart", "Dumbbell Sumo Squat", "Dumbbell Romanian Deadlift"],
  }),
  dumbbell: Object.freeze({
    upperA: ["Dumbbell Floor Press", "One-arm Dumbbell Row", "Standing Dumbbell Shoulder Press", "Dumbbell Lateral Raise"],
    lowerA: ["Dumbbell Goblet Squat", "Dumbbell Romanian Deadlift", "Dumbbell Reverse Lunge", "Dumbbell Calf Raise"],
    upperB: ["Dumbbell Squeeze Floor Press", "Bent-over Dumbbell Row", "Standing Dumbbell Curl", "Standing Dumbbell Triceps Extension"],
    lowerB: ["Dumbbell Sumo Squat", "Dumbbell Romanian Deadlift", "Dumbbell Split Squat", "Dumbbell Calf Raise"],
    fullA: ["Dumbbell Floor Press", "One-arm Dumbbell Row", "Dumbbell Goblet Squat", "Dumbbell Romanian Deadlift"],
    fullB: ["Standing Dumbbell Shoulder Press", "Bent-over Dumbbell Row", "Dumbbell Reverse Lunge", "Dumbbell Sumo Squat"],
    fullC: ["Dumbbell Squeeze Floor Press", "One-arm Dumbbell Row", "Dumbbell Split Squat", "Dumbbell Romanian Deadlift"],
  }),
  band: Object.freeze({
    upperA: ["Resistance Band Floor Press", "Seated Resistance Band Row quanh bàn chân", "Standing Band Shoulder Press", "Band Pull-Apart"],
    lowerA: ["Resistance Band Squat", "Resistance Band Romanian Deadlift", "Resistance Band Reverse Lunge", "Band Lateral Walk"],
    upperB: ["Resistance Band Floor Press", "Seated Resistance Band Row quanh bàn chân", "Band Biceps Curl", "Band Overhead Triceps Extension"],
    lowerB: ["Resistance Band Squat", "Resistance Band Romanian Deadlift", "Band Lateral Walk", "Standing Band Calf Raise"],
    fullA: ["Resistance Band Floor Press", "Seated Resistance Band Row quanh bàn chân", "Resistance Band Squat", "Resistance Band Romanian Deadlift"],
    fullB: ["Standing Band Shoulder Press", "Band Pull-Apart", "Resistance Band Reverse Lunge", "Band Lateral Walk"],
    fullC: ["Resistance Band Floor Press", "Seated Resistance Band Row quanh bàn chân", "Resistance Band Squat", "Standing Band Calf Raise"],
  }),
  bodyweight: Object.freeze({
    upperA: ["Wall Push-up", "Reverse Snow Angel", "Kneeling Push-up", "Prone Y-T Raise"],
    lowerA: ["Bodyweight Squat", "Glute Bridge", "Reverse Lunge", "Dead Bug"],
    upperB: ["Modified Push-up", "Reverse Snow Angel", "Kneeling Push-up", "Bird Dog"],
    lowerB: ["Bodyweight Squat", "Glute Bridge", "Reverse Lunge", "Dead Bug"],
    fullA: ["Wall Push-up", "Reverse Snow Angel", "Bodyweight Squat", "Glute Bridge"],
    fullB: ["Kneeling Push-up", "Prone Y-T Raise", "Reverse Lunge", "Bird Dog"],
    fullC: ["Modified Push-up", "Reverse Snow Angel", "Bodyweight Squat", "Dead Bug"],
  }),
});

const SESSION_KEYS = Object.freeze({
  2: [["fullA", "toàn thân A"], ["fullB", "toàn thân B"]],
  3: [["fullA", "toàn thân A"], ["fullB", "toàn thân B"], ["fullC", "toàn thân C"]],
  4: [["upperA", "thân trên"], ["lowerA", "thân dưới"], ["upperB", "thân trên"], ["lowerB", "thân dưới"]],
});

const WEEKLY_SCHEDULES = Object.freeze({
  2: "Lịch tuần gợi ý: Thứ 2: Buổi 1; Thứ 5: Buổi 2; nghỉ ít nhất hai ngày giữa hai buổi toàn thân.",
  3: "Lịch tuần gợi ý: Thứ 2: Buổi 1; Thứ 4: Buổi 2; Thứ 7: Buổi 3; luôn có ngày nghỉ giữa các buổi toàn thân.",
  4: "Lịch tuần gợi ý: Thứ 2: Buổi 1 (thân trên); Thứ 3: Buổi 2 (thân dưới); Thứ 4: nghỉ; Thứ 5: Buổi 3 (thân trên); Thứ 6: nghỉ; Thứ 7: Buổi 4 (thân dưới); hai buổi thân dưới không liền nhau.",
});

const parseDayCount = (normalized) => {
  const match = normalized.match(
    /\b([2-6])\s*(?:ngay|buoi)(?:\s*\/\s*tuan|\s+(?:moi|mot)\s+tuan)?\b|\b([2-6])\s*days?\s+per\s+week\b/,
  );
  return Number(match?.[1] || match?.[2]) || null;
};

const parseMaxMinutes = (normalized) => {
  const match = normalized.match(
    /\b(?:toi da|khong qua|max(?:imum)?|under|duoi|within)\s*(\d{2,3})\s*(?:phut|minutes?|mins?)\b/,
  );
  if (!match) return DURATION_MENTION_PATTERN.test(normalized) ? null : 55;
  const minutes = Number(match[1]);
  return minutes >= 30 && minutes <= 90 ? minutes : null;
};

const parseProgramWeeks = (normalized) => {
  const match = normalized.match(/\b(\d{1,2})\s*(?:tuan|weeks?)\b/);
  const weeks = Number(match?.[1]);
  return weeks >= 2 && weeks <= 16 ? weeks : null;
};

const parseEquipmentProfile = (message, normalized) => {
  if (hasLimitedDumbbellBandConstraint(message)) return "dumbbellBand";
  if (hasBandOnlyConstraint(message)) return "band";
  if (NO_EQUIPMENT_PATTERN.test(normalized)) return "bodyweight";
  if (ONLY_PATTERN.test(normalized) && DUMBBELL_PATTERN.test(normalized) &&
      !BAND_PATTERN.test(normalized)) return "dumbbell";
  return null;
};

const getDurationPrescription = (maxMinutes) => {
  if (maxMinutes <= 35) {
    return { lower: Math.max(25, maxMinutes - 5), upper: maxMinutes,
      warmup: 5, exerciseCount: 3, sets: 2, primaryRest: 60 };
  }
  if (maxMinutes <= 49) {
    return { lower: Math.max(30, maxMinutes - 10), upper: maxMinutes,
      warmup: 5, exerciseCount: 4, sets: 2, primaryRest: 60 };
  }
  const upper = Math.min(55, maxMinutes);
  return { lower: Math.max(40, upper - 10), upper,
    warmup: 6, exerciseCount: 4, sets: 3, primaryRest: 90 };
};

const formatExercise = (name, index, prescription) => {
  const reps = index === prescription.exerciseCount - 1 ? "12–15" : "8–12";
  const rest = index < 2 ? prescription.primaryRest : 60;
  return `${name} — ${prescription.sets} hiệp x ${reps} lần, RPE 6–7, nghỉ ${rest} giây`;
};

const hasUnsupportedConstraint = (normalized) => {
  const healthRelevantText = normalized.replace(NEGATED_HEALTH_PATTERN, " ");
  const bodyPartConstraintText = normalized.replace(
    SUPPORTED_LEG_SPACING_PATTERN,
    " ",
  );
  const statedAge = Number(normalized.match(AGE_PATTERN)?.[1]);
  return BODY_PART_CONSTRAINT_PATTERN.test(bodyPartConstraintText) ||
    EXACT_LOAD_PATTERN.test(normalized) ||
    EXACT_PROGRESSION_PATTERN.test(normalized) ||
    HEALTH_CONSTRAINT_PATTERN.test(healthRelevantText) ||
    DIETARY_REQUEST_PATTERN.test(normalized) ||
    REQUIRED_EXERCISE_PATTERN.test(normalized) ||
    CUSTOM_CONSTRAINT_PATTERN.test(bodyPartConstraintText) ||
    EXACT_PRESCRIPTION_PATTERN.test(normalized) ||
    FIXED_SCHEDULE_PATTERN.test(normalized) ||
    MINOR_PATTERN.test(normalized) ||
    (Number.isInteger(statedAge) && statedAge < 18);
};

const progressionByEquipment = Object.freeze({
  dumbbellBand:
    "khi hoàn thành mức lần cao nhất với kỹ thuật ổn định ở RPE 6–7, tăng nhẹ tạ hoặc độ căng dây ở buổi kế tiếp",
  dumbbell:
    "khi hoàn thành mức lần cao nhất với kỹ thuật ổn định ở RPE 6–7, tăng nhẹ mức tạ ở buổi kế tiếp",
  band:
    "khi hoàn thành mức lần cao nhất với kỹ thuật ổn định ở RPE 6–7, tăng nhẹ độ căng dây ở buổi kế tiếp",
  bodyweight:
    "khi hoàn thành mức lần cao nhất với kỹ thuật ổn định ở RPE 6–7, tăng 1–2 lần mỗi hiệp hoặc làm nhịp hạ chậm hơn",
});

/**
 * Tạo draft read-only khi prompt có đủ intent, level, số buổi và thiết bị hỗ trợ.
 * Trả về null nếu constraints chưa rõ để caller tiếp tục intake/model path.
 */
export const buildBoundedWorkoutDraft = (message) => {
  const normalized = normalize(message);
  if (!WORKOUT_INTENT_PATTERN.test(normalized) ||
      !BEGINNER_PATTERN.test(normalized) ||
      hasUnsupportedConstraint(normalized)) return null;

  const days = parseDayCount(normalized);
  const maxMinutes = parseMaxMinutes(normalized);
  const programWeeks = parseProgramWeeks(normalized);
  const equipmentProfile = parseEquipmentProfile(message, normalized);
  const sessionKeys = SESSION_KEYS[days];
  if (!days || !maxMinutes || !equipmentProfile || !sessionKeys) return null;

  const prescription = getDurationPrescription(maxMinutes);
  const templates = SESSION_TEMPLATES[equipmentProfile];
  const sessions = sessionKeys.map(([key, label]) => ({
    label,
    exercises: templates[key].slice(0, prescription.exerciseCount),
  }));
  const lines = [
    `Đây là khung tham khảo cho người mới, không phải đơn tập cá nhân; mỗi buổi ${prescription.lower}–${prescription.upper} phút, gồm ${prescription.warmup} phút khởi động nhẹ.`,
    ...sessions.map(({ label, exercises }, index) => [
      `### Buổi ${index + 1} (${label})`,
      exercises.map((name, exerciseIndex) =>
        `- ${formatExercise(name, exerciseIndex, prescription)}.`).join("\n"),
    ].join("\n\n")),
    `### Lịch trong tuần\n\n${WEEKLY_SCHEDULES[days]}`,
    `### Tiến độ\n\nTiến độ: ${progressionByEquipment[equipmentProfile]}.`,
    "### Lưu ý an toàn",
    "Dừng bài nếu đau nhói, chóng mặt hoặc triệu chứng tăng; khung này không dùng để tự xử lý chấn thương hay bệnh lý.",
  ];
  if (DELOAD_PATTERN.test(normalized)) {
    const deloadLabel = programWeeks ? `Tuần ${programWeeks} deload` : "Tuần deload";
    lines.push("### Giảm tải",
      `${deloadLabel}, giảm khoảng 30% volume bằng cách bớt 1 hiệp ở phần lớn bài và giữ RPE 5–6.`);
  }

  const draft = lines.join("\n\n");
  if (equipmentProfile === "dumbbellBand" || equipmentProfile === "band") {
    const validation = validateWorkoutEquipmentOutput(message, draft);
    if (!validation.valid) return null;
  }
  return draft;
};
