// Giai đoạn do HLV tự thiết kế: chuẩn hoá dữ liệu nhập, dựng thẻ giai đoạn và bảng dự đoán.
// Bảng dự đoán vẫn do hệ thống tính theo giai đoạn/số tuần/số buổi HLV chọn; HLV ghi đè được từng chỉ số.
import {
  buildFramework,
  buildGoalProgress,
  buildOutcomeTable,
  buildPhaseRoadmap,
  buildProjectedRange,
  buildVisualStages,
} from "./resultPrediction.helpers.js";

const PHASES = ["phase_1", "phase_2", "phase_3", "phase_4", "phase_5"];
export const SPLITS = ["full_body", "upper_lower", "push_pull", "push_pull_legs", "custom"];
export const MIN_WEEKS = 4;
export const MAX_WEEKS = 24;
const MAX_LIST = 6;
export const OVERRIDE_RANGES = {
  weightKg: [10, 300],
  bmi: [5, 90],
  waistCm: [30, 250],
  hipCm: [30, 250],
  bodyFatPercent: [2, 70],
  restingHeartRate: [30, 220],
};

const round1 = (num) => Math.round(Number(num) * 10) / 10;

const fail = (message) => {
  const error = new Error(message);
  error.status = 400;
  error.expose = true;
  throw error;
};

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

const text = (value, max, label) => {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") fail(`${label} không hợp lệ`);
  const trimmed = value.trim();
  if (trimmed.length > max) fail(`${label} tối đa ${max} ký tự`);
  return trimmed;
};

const list = (value, label) => {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > MAX_LIST) fail(`${label} tối đa ${MAX_LIST} dòng`);
  return value.map((item) => text(item, 200, label)).filter(Boolean);
};

const integer = (value, min, max, label) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) fail(`${label} không hợp lệ`);
  return parsed;
};

// Phương pháp "Tự đặt" bắt buộc có tên để báo cáo và lịch tập hiển thị đúng ý HLV.
const customSplitName = (value) => {
  const name = text(value, 60, "Tên phương pháp tập luyện");
  if (!name) fail("Nhập tên phương pháp tập luyện");
  return name;
};

export const normalizeCustomStage = (input) => {
  if (!isObject(input)) fail("Dữ liệu thiết kế giai đoạn không hợp lệ");
  if (!PHASES.includes(input.phaseKey)) fail("Giai đoạn NASM không hợp lệ");
  const schedule = isObject(input.weeklySchedule) ? input.weeklySchedule : {};
  const days = Array.isArray(schedule.days) ? schedule.days : [];
  if (days.length !== 7) fail("Lịch tập mỗi tuần cần đủ 7 ngày");
  const trainingDays = days.map((day) => day === true);
  const sessionsPerWeek = trainingDays.filter(Boolean).length;
  if (sessionsPerWeek < 1) fail("Chọn ít nhất 1 buổi tập mỗi tuần");

  const overrides = {};
  if (input.overrides !== undefined && input.overrides !== null) {
    if (!isObject(input.overrides)) fail("Chỉ số dự kiến không hợp lệ");
    for (const [key, value] of Object.entries(input.overrides)) {
      const range = OVERRIDE_RANGES[key];
      if (!range) fail("Chỉ số dự kiến không hợp lệ");
      if (value === null || value === "") continue;
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < range[0] || parsed > range[1]) fail("Chỉ số dự kiến không hợp lệ");
      overrides[key] = round1(parsed);
    }
  }

  return {
    phaseKey: input.phaseKey,
    durationWeeks: integer(input.durationWeeks, MIN_WEEKS, MAX_WEEKS, "Số tuần"),
    objective: text(input.objective, 500, "Giải thích mục tiêu giai đoạn"),
    entryReason: text(input.entryReason, 500, "Vì sao xếp như vậy"),
    keyFocus: list(input.keyFocus, "Trọng tâm chính"),
    expectedChanges: list(input.expectedChanges, "Thay đổi có thể thấy"),
    exitCriteria: list(input.exitCriteria, "Khi nào nên chuyển tiếp"),
    weeklySchedule: {
      sessionsPerWeek,
      sessionMinutes: integer(schedule.sessionMinutes, 15, 240, "Thời lượng mỗi buổi"),
      split: SPLITS.includes(schedule.split) ? schedule.split : fail("Phương pháp tập luyện không hợp lệ"),
      ...(schedule.split === "custom" ? { customSplitName: customSplitName(schedule.customSplitName) } : {}),
      days: trainingDays,
      note: text(schedule.note, 200, "Ghi chú lịch tập"),
    },
    overrides,
  };
};

const DELTA_KEYS = ["weightKg", "bodyFatPercent", "bmi", "waistCm", "hipCm", "restingHeartRate"];

// Áp số HLV ghi đè lên dự đoán của hệ thống rồi tính lại chênh lệch và khoảng ước tính.
export const applyOverrides = ({ checkpoint, baseline, overrides = {}, stageIndex = 0 }) => {
  const systemProjected = { ...checkpoint.projected };
  const projected = { ...systemProjected, ...overrides };
  const range = buildProjectedRange({ baseline, projected, stageIndex });
  for (const key of Object.keys(overrides)) {
    range[key] = { min: projected[key], max: projected[key] };
  }
  return {
    ...checkpoint,
    systemProjected,
    projected,
    projectedRange: range,
    deltaFromBaseline: Object.fromEntries(
      DELTA_KEYS.map((key) => [
        key,
        baseline[key] !== null && baseline[key] !== undefined && projected[key] !== null && projected[key] !== undefined
          ? round1(projected[key] - baseline[key])
          : null,
      ]),
    ),
    overrides,
  };
};

// Tài liệu Mongoose phải chuyển sang object thường trước khi trải ra.
const plain = (doc) => (doc?.toObject ? doc.toObject() : doc || {});

const withSessions = (intake, sessionsPerWeek) => {
  const value = plain(intake);
  return {
    ...value,
    trainingProfileGoal: { ...(value.trainingProfileGoal || {}), trainingDaysPerWeek: sessionsPerWeek },
  };
};

// Giai đoạn 1 do HLV thiết kế: cùng cấu trúc với bản hệ thống để các phần sau (đánh giá cuối giai đoạn,
// ảnh dự đoán, báo cáo) dùng lại được.
export const buildTrainerStageOne = ({ intake, assessment, aiReport, custom, trainerId = null }) => {
  const effective = withSessions(intake, custom.weeklySchedule.sessionsPerWeek);
  const personalizedPath = [custom.phaseKey];
  const [systemStage] = buildPhaseRoadmap({ personalizedPath, intake: effective, assessment, aiReport });
  const stage = {
    ...systemStage,
    durationWeeks: custom.durationWeeks,
    objective: custom.objective || systemStage.objective,
    entryReason: custom.entryReason || systemStage.entryReason,
    keyFocus: custom.keyFocus,
    expectedChanges: custom.expectedChanges,
    exitCriteria: custom.exitCriteria,
    weeklySchedule: custom.weeklySchedule,
    designedBy: trainerId,
  };
  const outcome = buildOutcomeTable({ intake: effective, assessment, personalizedPath, phaseRoadmap: [stage] });
  const checkpoint = applyOverrides({
    checkpoint: outcome.phaseCheckpoints[0],
    baseline: outcome.baseline,
    overrides: custom.overrides,
  });
  const phaseCheckpoints = [checkpoint];
  return {
    framework: buildFramework({ recommendedStartPhase: custom.phaseKey, phaseCeiling: custom.phaseKey, personalizedPath }),
    phaseRoadmap: [stage],
    outcomeTable: {
      ...outcome,
      phaseCheckpoints,
      goalProgress: buildGoalProgress({ intake, baseline: outcome.baseline, phaseCheckpoints }),
    },
    visualStages: buildVisualStages({ personalizedPath, intake, assessment }),
    personalizedPath,
  };
};
