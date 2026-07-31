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

export const summarizeProgressAvailability = (progress) =>
  Object.values(progress?.compliance || {}).some(
    (metric) => metric?.percent !== null && metric?.percent !== undefined,
  ) ||
  Object.values(progress?.wellness || {}).some(
    (metric) => metric?.average !== null && metric?.average !== undefined,
  ) ||
  (progress?.weightTrend?.points || []).length > 0;
