import {
  EQUIPMENT,
  EXPERIENCE_LEVELS,
  GENDERS,
  GOALS,
  STRESS_LEVELS,
  TEST_METRICS,
  VALUE_LIMITS,
  WARNING_SIGNS,
  WORK_ACTIVITY_LEVELS,
} from "./constants.js";
import { PAIN_AREAS } from "./recommendationContent.js";

export const inputError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = "SELF_ASSESSMENT_INVALID_INPUT";
  error.expose = true;
  return error;
};

const isEmpty = (value) => value === null || value === undefined || value === "";

const number = (label, limits, { integer = false } = {}) => (value) => {
  if (isEmpty(value)) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < limits.min || parsed > limits.max || (integer && !Number.isInteger(parsed))) {
    throw inputError(`${label} cần nằm trong khoảng từ ${limits.min} đến ${limits.max}.`);
  }
  return parsed;
};

const oneOf = (label, list) => (value) => {
  if (isEmpty(value)) return "";
  if (!list.includes(value)) throw inputError(`${label} không hợp lệ.`);
  return value;
};

const text = (label, max) => (value) => {
  if (isEmpty(value)) return "";
  if (typeof value !== "string") throw inputError(`${label} không hợp lệ.`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw inputError(`${label} tối đa ${max} ký tự.`);
  return trimmed;
};

const flag = (label) => (value) => {
  if (isEmpty(value)) return false;
  if (typeof value !== "boolean") throw inputError(`${label} không hợp lệ.`);
  return value;
};

const listOf = (label, allowed) => (value) => {
  if (isEmpty(value)) return [];
  if (!Array.isArray(value) || value.length > allowed.length) throw inputError(`${label} không hợp lệ.`);
  const unique = [...new Set(value)];
  if (unique.some((item) => !allowed.includes(item))) throw inputError(`${label} không hợp lệ.`);
  return unique;
};

const SECTIONS = {
  screening: {
    hasPainNow: flag("Tình trạng đau hiện tại"),
    painLocation: listOf("Vị trí đau", PAIN_AREAS),
    painLevel: number("Mức độ đau", VALUE_LIMITS.painLevel, { integer: true }),
    injuries: text("Chấn thương", 500),
    currentConditions: text("Bệnh lý hiện tại", 500),
    surgeries: text("Phẫu thuật từng có", 500),
    medications: text("Thuốc đang dùng", 500),
    doctorRestrictions: text("Hạn chế vận động do bác sĩ", 500),
    warningSigns: listOf("Dấu hiệu cảnh báo", WARNING_SIGNS),
  },
  profile: {
    age: number("Tuổi", VALUE_LIMITS.age, { integer: true }),
    gender: oneOf("Giới tính", GENDERS),
    heightCm: number("Chiều cao", VALUE_LIMITS.heightCm),
    weightKg: number("Cân nặng", VALUE_LIMITS.weightKg),
    waistCm: number("Vòng eo", VALUE_LIMITS.waistCm),
    hipCm: number("Vòng hông", VALUE_LIMITS.hipCm),
    restingHeartRate: number("Nhịp tim nghỉ", VALUE_LIMITS.restingHeartRate, { integer: true }),
    sleepHours: number("Số giờ ngủ", VALUE_LIMITS.sleepHours),
    stressLevel: oneOf("Mức căng thẳng", STRESS_LEVELS),
    workActivityLevel: oneOf("Mức vận động công việc", WORK_ACTIVITY_LEVELS),
  },
  training: {
    currentlyTraining: flag("Tình trạng tập hiện tại"),
    trainingExperience: oneOf("Kinh nghiệm tập", EXPERIENCE_LEVELS),
    trainingDaysPerWeek: number("Số buổi tập mỗi tuần", VALUE_LIMITS.trainingDaysPerWeek, { integer: true }),
    sessionDurationMinutes: number("Thời lượng mỗi buổi", VALUE_LIMITS.sessionDurationMinutes, { integer: true }),
    breakDuration: text("Thời gian nghỉ tập", 60),
    primaryGoal: oneOf("Mục tiêu", GOALS),
    targetWeightKg: number("Cân nặng mục tiêu", VALUE_LIMITS.weightKg),
    equipment: oneOf("Dụng cụ tập", EQUIPMENT),
  },
  consent: {
    allowDataStorage: flag("Đồng ý lưu dữ liệu"),
  },
};

const TEST_FIELDS = {
  reps: number("Số lần", VALUE_LIMITS.reps, { integer: true }),
  seconds: number("Số giây", VALUE_LIMITS.seconds, { integer: true }),
  minutes: number("Số phút", VALUE_LIMITS.minutes),
  endHeartRate: number("Nhịp tim cuối bài", VALUE_LIMITS.endHeartRate, { integer: true }),
};

const asObject = (value, label) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw inputError(`${label} không hợp lệ.`);
  return value;
};

const normalizeSection = (name, input) => {
  const source = asObject(input, "Dữ liệu");
  const readers = SECTIONS[name];
  const out = {};
  Object.keys(source).forEach((key) => {
    if (!Object.hasOwn(readers, key)) throw inputError("Dữ liệu gửi lên có trường không được phép.");
    out[key] = readers[key](source[key]);
  });
  return out;
};

const normalizeTests = (input) => {
  const source = asObject(input, "Bài kiểm tra");
  const out = {};
  Object.keys(source).forEach((metricKey) => {
    if (!Object.hasOwn(TEST_METRICS, metricKey)) {
      throw inputError("Dữ liệu gửi lên có trường không được phép.");
    }
    const metric = TEST_METRICS[metricKey];
    const entry = asObject(source[metricKey], metric.label);
    const clean = {};
    Object.keys(entry).forEach((field) => {
      if (field === "variant") {
        clean.variant = oneOf("Biến thể bài tập", metric.variants)(entry.variant);
      } else if (field === metric.valueKey || (metricKey === "cardio" && field === "endHeartRate")) {
        clean[field] = TEST_FIELDS[field](entry[field]);
      } else {
        throw inputError("Dữ liệu gửi lên có trường không được phép.");
      }
    });
    if (metricKey === "cardio") {
      const hasMinutes = clean.minutes !== undefined && clean.minutes !== null;
      const hasHeartRate = clean.endHeartRate !== undefined && clean.endHeartRate !== null;
      if (hasMinutes !== hasHeartRate) throw inputError("Bài đi bộ cần có cả số phút và nhịp tim cuối bài.");
    }
    out[metricKey] = clean;
  });
  return out;
};

const TOP_LEVEL = ["step", "screening", "profile", "training", "tests", "consent"];

// Chỉ nhận field nằm trong allowlist; cờ an toàn, kết quả, trạng thái và userId không bao giờ được nhận từ client.
export const normalizeDraftPayload = (body) => {
  const source = asObject(body, "Dữ liệu");
  if (Object.keys(source).some((key) => !TOP_LEVEL.includes(key))) {
    throw inputError("Dữ liệu gửi lên có trường không được phép.");
  }
  const out = {};
  if ("step" in source) {
    const step = Number(source.step);
    if (!Number.isInteger(step) || step < 1 || step > 3) throw inputError("Bước đánh giá không hợp lệ.");
    out.step = step;
  }
  ["screening", "profile", "training", "consent"].forEach((name) => {
    if (name in source) out[name] = normalizeSection(name, source[name]);
  });
  if ("tests" in source) out.tests = normalizeTests(source.tests);
  return out;
};
