const REQUIRED_TDEE_FIELDS = Object.freeze([
  "gender",
  "age",
  "heightCm",
  "weightKg",
  "dailyMovement",
  "steps",
  "trainingFrequency",
  "trainingDuration",
  "trainingIntensity",
  "goal",
]);

const FIELD_LABELS = Object.freeze({
  gender: "giới tính",
  age: "tuổi",
  heightCm: "chiều cao",
  weightKg: "cân nặng",
  dailyMovement: "vận động ngoài buổi tập",
  steps: "số bước trung bình",
  trainingFrequency: "số buổi tập",
  trainingDuration: "thời lượng mỗi buổi",
  trainingIntensity: "cường độ tập",
  goal: "mục tiêu",
});

const toAscii = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/g, "d");

const decimalNumber = (value) => {
  const parsed = Number(String(value || "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};

const boundedNumber = (value, min, max, { integer = false } = {}) => {
  const parsed = decimalNumber(value);
  if (
    parsed == null ||
    parsed < min ||
    parsed > max ||
    (integer && !Number.isInteger(parsed))
  ) {
    return null;
  }
  return parsed;
};

const mapTrainingFrequency = (minimum, maximum = minimum) => {
  const upper = Math.max(Number(minimum), Number(maximum));
  if (!Number.isFinite(upper)) return null;
  if (upper === 0) return "none";
  if (upper <= 2) return "one_two";
  if (upper <= 4) return "three_four";
  return "five_plus";
};

const mapTrainingDuration = (minutes) => {
  const value = Number(minutes);
  if (!Number.isFinite(value) || value < 0) return null;
  if (value === 0) return "none";
  if (value < 30) return "under_30";
  if (value <= 45) return "between_30_45";
  if (value <= 60) return "between_45_60";
  return "over_60";
};

const mapSteps = (rawValue) => {
  const digits = String(rawValue || "").replace(/\D/g, "");
  if (!digits) return null;
  const value = Number(digits);
  if (!Number.isFinite(value) || value < 0 || value > 100000) return null;
  if (value < 5000) return "under_5000";
  if (value < 8000) return "between_5000_7999";
  if (value < 12000) return "between_8000_11999";
  return "at_least_12000";
};

/**
 * Chỉ trích xuất dữ kiện user đã nói rõ. Activity level luôn được tool tính từ
 * toàn bộ evidence, không bao giờ suy ra từ số buổi tập đơn lẻ.
 */
export function extractTdeePrefill(message) {
  const source = String(message || "").trim();
  const ascii = toAscii(source);
  const prefill = {};

  if (
    /(?:^|(?:tôi|toi|mình|minh|cho)\s+(?:là|la)?\s*)(?:nữ|nu|female)(?=$|[^\p{L}])/iu.test(
      source,
    )
  ) {
    prefill.gender = "female";
  } else if (
    /(?:^|(?:tôi|toi|mình|minh|cho)\s+(?:là|la)?\s*)(?:nam|male)(?=$|[^\p{L}])/iu.test(
      source,
    )
  ) {
    prefill.gender = "male";
  }

  const age = ascii.match(/(\d{1,3})\s*(?:tuoi|years?\s*old)/i)?.[1];
  const ageValue = boundedNumber(age, 13, 100, { integer: true });
  if (ageValue != null) prefill.age = ageValue;

  const height = ascii.match(
    /(?:chieu cao|cao)\s*(?:la\s*)?[:=]?\s*(\d{2,3}(?:[.,]\d+)?)\s*(?:cm|centimet)?/i,
  )?.[1] || ascii.match(/(\d{2,3}(?:[.,]\d+)?)\s*cm\b/i)?.[1];
  const heightValue = boundedNumber(height, 100, 250);
  if (heightValue != null) prefill.heightCm = heightValue;

  const weight = ascii.match(
    /(?:can nang|nang)\s*(?:la\s*)?[:=]?\s*(\d{2,3}(?:[.,]\d+)?)\s*(?:kg|kilo)?/i,
  )?.[1] || ascii.match(/(\d{2,3}(?:[.,]\d+)?)\s*kg\b/i)?.[1];
  const weightValue = boundedNumber(weight, 20, 350);
  if (weightValue != null) prefill.weightKg = weightValue;

  if (/lao dong the chat|cong viec the luc|khuan vac/i.test(ascii)) {
    prefill.dailyMovement = "physical_work";
  } else if (/xen ke|ngoi\s*(?:\/|va)\s*di lai/i.test(ascii)) {
    prefill.dailyMovement = "mixed";
  } else if (/di lai (?:nhieu|phan lon)|di chuyen nhieu/i.test(ascii)) {
    prefill.dailyMovement = "mostly_moving";
  } else if (
    /van phong|chu yeu ngoi|ngoi (?:nhieu|phan lon)|cong viec ngoi/i.test(ascii)
  ) {
    prefill.dailyMovement = "mostly_seated";
  }

  const rawSteps = ascii.match(/(\d[\d.,\s]{0,8})\s*buoc\b/i)?.[1];
  const stepBand = mapSteps(rawSteps);
  if (stepBand) prefill.steps = stepBand;

  const frequency = ascii.match(
    /(?:tap|luyen tap)\s*(\d+)(?:\s*(?:-|–|—|den|toi)\s*(\d+))?\s*buoi\b/i,
  );
  const trainingFrequency = frequency
    ? mapTrainingFrequency(frequency[1], frequency[2])
    : /(?:khong tap|0\s*buoi)/i.test(ascii)
      ? "none"
      : null;
  if (trainingFrequency) prefill.trainingFrequency = trainingFrequency;

  // Chỉ nhận thời lượng khi gắn rõ với buổi tập; tránh bắt nhầm "nấu 60 phút".
  const durationMatch = ascii.match(
    /\b(?:moi|trung binh moi)\s+buoi\b[^\d\n]{0,24}(\d{1,3})\s*(?:phut|p)\b|\b(\d{1,3})\s*(?:phut|p)\s*(?:\/\s*buoi|moi\s+buoi)\b/i,
  );
  const duration = durationMatch?.[1] || durationMatch?.[2];
  const trainingDuration = mapTrainingDuration(duration);
  if (trainingDuration) prefill.trainingDuration = trainingDuration;

  const intensity = ascii.match(/cuong do\s*(nhe|vua|cao|manh)/i)?.[1];
  if (intensity === "nhe") prefill.trainingIntensity = "easy";
  if (intensity === "vua") prefill.trainingIntensity = "moderate";
  if (["cao", "manh"].includes(intensity)) {
    prefill.trainingIntensity = "vigorous";
  }

  if (/muc tieu\s*(?:la\s*)?(?:giam mo|giam can)|\bgiam mo\b/i.test(ascii)) {
    prefill.goal = "fat_loss";
  } else if (/muc tieu\s*(?:la\s*)?tang co|\btang co\b/i.test(ascii)) {
    prefill.goal = "muscle_gain";
  } else if (/muc tieu\s*(?:la\s*)?duy tri|duy tri can/i.test(ascii)) {
    prefill.goal = "maintenance";
  }

  if (prefill.trainingFrequency === "none") {
    prefill.trainingDuration = "none";
    prefill.trainingIntensity = "none";
  }

  return prefill;
}

export const getMissingTdeeInputFields = (input = {}) =>
  REQUIRED_TDEE_FIELDS.filter((field) => input[field] == null || input[field] === "");

export function buildTdeeIntakeResponse(message) {
  const prefill = extractTdeePrefill(message);
  const missingFields = getMissingTdeeInputFields(prefill);
  const missingLabels = missingFields.map((field) => FIELD_LABELS[field]);
  const text = missingLabels.length > 0
    ? `Mình đã điền sẵn những dữ kiện bạn cung cấp. Bạn bổ sung ${missingLabels.join(
        ", ",
      )} trong thẻ rồi nhấn “Xác nhận & tính TDEE”. Mình sẽ chưa tính khi còn thiếu để tránh đưa ra kết quả dễ sai.`
    : "Mình đã điền sẵn các dữ kiện bạn cung cấp. Bạn kiểm tra lại rồi nhấn “Xác nhận & tính TDEE”.";

  return {
    text,
    uiCard: {
      cardType: "tdeeForm",
      data: { prefill, missingFields },
    },
  };
}
