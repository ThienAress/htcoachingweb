import { translateTrainingFocus } from "../constants/f1Phases";

export const SPLIT_OPTIONS = [
  { value: "full_body", label: "Toàn thân" },
  { value: "upper_lower", label: "Trên – dưới" },
  { value: "push_pull_legs", label: "Đẩy – kéo – chân" },
  { value: "custom", label: "Tự đặt" },
];

export const SPLIT_LABELS = Object.fromEntries(SPLIT_OPTIONS.map((item) => [item.value, item.label]));

export const WEEK_DAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

export const OUTCOME_METRICS = [
  ["weightKg", "Cân nặng", "kg"],
  ["bmi", "BMI", ""],
  ["waistCm", "Vòng eo", "cm"],
  ["hipCm", "Vòng hông", "cm"],
  ["bodyFatPercent", "Tỷ lệ mỡ", "%"],
  ["restingHeartRate", "Nhịp tim nghỉ", "bpm"],
];

export const MAX_LIST_ITEMS = 6;
const DEFAULT_DAYS = [true, false, true, false, true, false, false];

const toRows = (items = []) => translateTrainingFocus(items).map((value) => ({ value }));

const toInput = (value) =>
  value === null || value === undefined || value === "" ? "" : String(value);

// Giá trị ban đầu của form: lấy từ kế hoạch đã có (roadmap hoặc giai đoạn kế tiếp) nếu có.
export const buildDesignDefaults = ({ plan = null, overrides = null, fallbackPhaseKey = "phase_1" } = {}) => {
  const schedule = plan?.weeklySchedule || {};
  return {
    phaseKey: plan?.phaseKey || fallbackPhaseKey,
    durationWeeks: toInput(plan?.durationWeeks || 8),
    objective: plan?.objective || "",
    entryReason: plan?.entryReason || "",
    keyFocus: toRows(plan?.keyFocus),
    expectedChanges: toRows(plan?.expectedChanges),
    exitCriteria: toRows(plan?.exitCriteria),
    weeklySchedule: {
      days: Array.isArray(schedule.days) && schedule.days.length === 7 ? schedule.days.map(Boolean) : DEFAULT_DAYS,
      sessionMinutes: toInput(schedule.sessionMinutes || 60),
      split: schedule.split || "full_body",
      note: schedule.note || "",
    },
    overrides: Object.fromEntries(OUTCOME_METRICS.map(([key]) => [key, toInput(overrides?.[key])])),
  };
};

// Gợi ý của hệ thống điền vào các ô nội dung (giữ nguyên lịch tập và số ghi đè).
export const applySuggestion = (values, suggestion) => ({
  ...values,
  durationWeeks: toInput(suggestion.durationWeeks || values.durationWeeks),
  objective: suggestion.objective || values.objective,
  entryReason: suggestion.entryReason || values.entryReason,
  keyFocus: toRows(suggestion.keyFocus).slice(0, MAX_LIST_ITEMS),
  expectedChanges: toRows(suggestion.expectedChanges).slice(0, MAX_LIST_ITEMS),
  exitCriteria: toRows(suggestion.exitCriteria).slice(0, MAX_LIST_ITEMS),
});

const numberOrNull = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};

const rows = (items = []) => items.map((item) => item.value.trim()).filter(Boolean);

export const toCustomStage = (values) => ({
  phaseKey: values.phaseKey,
  durationWeeks: Number(values.durationWeeks),
  objective: values.objective.trim(),
  entryReason: values.entryReason.trim(),
  keyFocus: rows(values.keyFocus),
  expectedChanges: rows(values.expectedChanges),
  exitCriteria: rows(values.exitCriteria),
  weeklySchedule: {
    days: values.weeklySchedule.days.map(Boolean),
    sessionMinutes: Number(values.weeklySchedule.sessionMinutes),
    split: values.weeklySchedule.split,
    note: values.weeklySchedule.note.trim(),
  },
  overrides: Object.fromEntries(
    Object.entries(values.overrides || {})
      .map(([key, value]) => [key, numberOrNull(value)])
      .filter(([, value]) => value !== null),
  ),
});

// Bản rút gọn chỉ để xin bảng dự đoán của hệ thống khi HLV đổi giai đoạn, số tuần hoặc số buổi.
export const toPreviewStage = ({ phaseKey, durationWeeks, days }) => {
  const weeks = Math.min(16, Math.max(4, Math.round(Number(durationWeeks) || 8)));
  const trainingDays = Array.isArray(days) && days.some(Boolean) ? days.map(Boolean) : DEFAULT_DAYS;
  return {
    phaseKey,
    durationWeeks: weeks,
    weeklySchedule: { days: trainingDays, sessionMinutes: 60, split: "full_body", note: "" },
  };
};
