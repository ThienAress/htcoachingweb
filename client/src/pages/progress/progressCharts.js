const CHART_WIDTH = 640;
const CHART_HEIGHT = 220;
const PADDING = { top: 24, right: 52, bottom: 38, left: 52 };

const SCORE_CONFIG = [
  { key: "energy", label: "Năng lượng", color: "accent-emerald-400" },
  { key: "hunger", label: "Mức đói", color: "accent-amber-400" },
  { key: "stress", label: "Căng thẳng", color: "accent-orange-400" },
  { key: "soreness", label: "Đau mỏi cơ", color: "accent-violet-400" },
  { key: "pain", label: "Mức đau", color: "accent-rose-400" },
];

const roundCoordinate = (value) => Number(value.toFixed(2));
const dateLabel = (dateKey) => {
  const [year, month, day] = String(dateKey || "").split("-");
  return year && month && day ? `${day}/${month}` : "";
};

export const wellnessScoreRows = (wellness = {}) =>
  SCORE_CONFIG.map((config) => {
    const metric = wellness?.[config.key];
    const sourceAverage = metric?.average;
    const hasAverage =
      typeof sourceAverage === "number" &&
      Number.isFinite(sourceAverage) &&
      sourceAverage >= 0 &&
      sourceAverage <= 10;
    const average = hasAverage ? sourceAverage : null;

    return {
      ...config,
      average,
      count:
        hasAverage && Number.isSafeInteger(metric.count) ? metric.count : 0,
      percent: hasAverage ? average * 10 : null,
    };
  });

export const buildBodyMetricChartModel = (sourcePoints = []) => {
  const values = sourcePoints
    .filter(
      (point) =>
        /^\d{4}-\d{2}-\d{2}$/.test(String(point?.dateKey || "")) &&
        typeof point?.value === "number" &&
        Number.isFinite(point.value) &&
        point.value > 0,
    )
    .sort((left, right) =>
      left.dateKey.localeCompare(right.dateKey),
    );
  if (values.length === 0) return { points: [], path: "", yTicks: [] };

  const metricValues = values.map((point) => point.value);
  const rawMin = Math.min(...metricValues);
  const rawMax = Math.max(...metricValues);
  const domainPadding = Math.max(0.5, (rawMax - rawMin) * 0.15);
  const minWeight = rawMin - domainPadding;
  const maxWeight = rawMax + domainPadding;
  const plotWidth = CHART_WIDTH - PADDING.left - PADDING.right;
  const plotHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  const xFor = (index) =>
    values.length === 1
      ? CHART_WIDTH / 2
      : PADDING.left + (index / (values.length - 1)) * plotWidth;
  const yFor = (value) =>
    PADDING.top + ((maxWeight - value) / (maxWeight - minWeight)) * plotHeight;
  const points = values.map((point, index) => ({
    ...point,
    x: roundCoordinate(xFor(index)),
    y: roundCoordinate(yFor(point.value)),
    dateLabel: dateLabel(point.dateKey),
  }));
  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const middleWeight = (minWeight + maxWeight) / 2;
  const yTicks = [maxWeight, middleWeight, minWeight].map((weight) => ({
    weight: Number(weight.toFixed(1)),
    y: roundCoordinate(yFor(weight)),
  }));

  return { points, path, yTicks };
};

export const buildWeightChartModel = (sourcePoints = []) =>
  buildBodyMetricChartModel(
    sourcePoints.map((point) => ({
      ...point,
      dateKey: point?.weekStartDateKey,
      value: point?.weightKg,
    })),
  );

export const WEIGHT_CHART_VIEWBOX = `0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`;
export const BODY_METRIC_CHART_VIEWBOX = WEIGHT_CHART_VIEWBOX;
