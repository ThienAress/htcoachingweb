const METRIC_LABELS = {
  scheduleAttendance: "Lịch tập với HLV",
  workoutCompletion: "Giáo án tập luyện",
  coachingCompletion: "Huấn luyện hằng ngày",
  mealCompliance: "Bữa ăn theo kế hoạch",
  habitCompliance: "Thói quen được giao",
};

export const progressMetricRows = (compliance = {}) =>
  Object.entries(compliance).map(([key, value]) => ({
    key,
    label: METRIC_LABELS[key] || key,
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
  ]) {
    for (const point of bodyProgress?.[metricKey]?.series || []) {
      if (!validBodyPoint(point)) continue;
      const row = byDate.get(point.dateKey) || {
        dateKey: point.dateKey,
        weightKg: null,
        waistCm: null,
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
    (metric) => metric?.average !== null && metric?.average !== undefined,
  ) ||
  ["weightKg", "waistCm"].some(
    (key) => (progress?.bodyProgress?.[key]?.series || []).length > 0,
  ) ||
  (progress?.weightTrend?.points || []).length > 0;
