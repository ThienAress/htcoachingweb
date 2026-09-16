const METRIC_LABELS = {
  scheduleAttendance: "Lịch tập với HLV",
  workoutCompletion: "Giáo án tập luyện",
  coachingCompletion: "Huấn luyện hằng ngày",
  mealCompliance: "Bữa ăn theo kế hoạch",
  habitCompliance: "Thói quen được giao",
};

const SELF_MANAGED_METRIC_LABELS = {
  mealCompliance: "Bữa ăn đã lưu",
  habitCompliance: "Thói quen cá nhân",
};

const PROGRESS_SECTION_KEYS = new Set(["compliance", "body", "wellness", "composition"]);
const BODY_METRIC_KEYS = ["weightKg", "waistCm", "hipCm", "abdomenCm", "waistHipRatio", "bodyFatPercent", "skeletalMusclePercent"];
const BODY_PROGRESS_RANGES = Object.freeze([30, 90, 180]);
const DAILY_PROGRESS_RANGES = Object.freeze([7, 30, 90]);

export const normalizeProgressSection = (value) =>
  PROGRESS_SECTION_KEYS.has(value) ? value : null;

export const progressRangeOptions = (section) =>
  ["body", "composition"].includes(section) ? [...BODY_PROGRESS_RANGES] : [...DAILY_PROGRESS_RANGES];

export const normalizeProgressDaysForSection = (section, days) => {
  const ranges = progressRangeOptions(section);
  const value = Number(days);
  if (ranges.includes(value)) return value;
  if (["body", "composition"].includes(section) && value < ranges[0]) return ranges[0];
  return ranges.at(-1);
};

export const progressRangeLabel = (days) =>
  ({ 7: "7 ngày", 30: "30 ngày", 90: "3 tháng", 180: "6 tháng" })[days] ||
  `${days} ngày`;

export const progressSectionHasData = (section, progress = {}) => {
  if (section === "compliance") {
    return Object.values(progress.compliance || {}).some(
      (metric) => metric?.percent !== null && metric?.percent !== undefined,
    );
  }
  if (section === "body") {
    return BODY_METRIC_KEYS.some(
      (key) => (progress.bodyProgress?.[key]?.series || []).length > 0,
    );
  }
  if (section === "wellness") {
    return (
      (progress.wellness?.daily || []).length > 0 ||
      Object.entries(progress.wellness || {}).some(
        ([key, metric]) =>
          key !== "daily" &&
          ((metric?.average !== null && metric?.average !== undefined) ||
            (metric?.latest !== null && metric?.latest !== undefined)),
      )
    );
  }
  return false;
};

export const progressMetricRows = (
  compliance = {},
  { selfManaged = false } = {},
) =>
  Object.entries(compliance)
    .filter(
      ([key]) =>
        !selfManaged || Object.hasOwn(SELF_MANAGED_METRIC_LABELS, key),
    )
    .map(([key, value]) => ({
    key,
    label:
      (selfManaged ? SELF_MANAGED_METRIC_LABELS[key] : METRIC_LABELS[key]) ||
      key,
    numerator: value?.numerator || 0,
    denominator: value?.denominator || 0,
    percent: value?.percent ?? null,
    displayPercent:
      value?.percent === null || value?.percent === undefined
        ? "Chưa có dữ liệu"
        : value.percent + "%",
    }));

const validBodyPoint = (point) =>
  /^\d{4}-\d{2}-\d{2}$/.test(String(point?.dateKey || "")) &&
  typeof point?.value === "number" &&
  Number.isFinite(point.value) &&
  point.value > 0;

export const bodyProgressHistoryRows = (bodyProgress = {}) => {
  const byDate = new Map();
  for (const [metricKey, field] of [
    ["weightKg", "weightKg"],
    ["waistCm", "waistCm"],
    ["hipCm", "hipCm"],
    ["abdomenCm", "abdomenCm"],
    ["waistHipRatio", "waistHipRatio"],
    ["bodyFatPercent", "bodyFatPercent"],
    ["skeletalMusclePercent", "skeletalMusclePercent"],
  ]) {
    for (const point of bodyProgress?.[metricKey]?.series || []) {
      if (!validBodyPoint(point)) continue;
      const row = byDate.get(point.dateKey) || {
        dateKey: point.dateKey,
        weightKg: null,
        waistCm: null,
        hipCm: null,
        abdomenCm: null,
        waistHipRatio: null,
        bodyFatPercent: null,
        skeletalMusclePercent: null,
      };
      row[field] = point.value;
      byDate.set(point.dateKey, row);
    }
  }
  return [...byDate.values()].sort((left, right) =>
    left.dateKey.localeCompare(right.dateKey),
  );
};

export const summarizeProgressAvailability = (progress) =>
  Object.values(progress?.compliance || {}).some(
    (metric) => metric?.percent !== null && metric?.percent !== undefined,
  ) ||
  Object.values(progress?.wellness || {}).some(
    (metric) =>
      (metric?.average !== null && metric?.average !== undefined) ||
      (metric?.latest !== null && metric?.latest !== undefined),
  ) ||
  BODY_METRIC_KEYS.some(
    (key) => (progress?.bodyProgress?.[key]?.series || []).length > 0,
  ) ||
  (progress?.weightTrend?.points || []).length > 0;
