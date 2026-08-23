import {
  getMonthWeekPeriods,
  isValidDateKey,
} from "../../utils/vietnamDate";

const DEFAULT_CHART_WIDTH = 640;
const WIDE_CHART_HEIGHT = 330;
const COMPACT_CHART_HEIGHT = 300;

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

const chartDimensions = (requestedWidth) => {
  const width = Math.max(280, Number(requestedWidth) || DEFAULT_CHART_WIDTH);
  const compact = width < 520;
  const height = compact ? COMPACT_CHART_HEIGHT : WIDE_CHART_HEIGHT;
  const padding = compact
    ? { top: 24, right: 20, bottom: 52, left: 64 }
    : { top: 24, right: 24, bottom: 52, left: 72 };
  return {
    width,
    height,
    padding,
    plotWidth: width - padding.left - padding.right,
    plotHeight: height - padding.top - padding.bottom,
  };
};

const nextMonth = (dateKey) => {
  const [year, month] = dateKey.split("-").map(Number);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonthNumber = month === 12 ? 1 : month + 1;
  return `${nextYear}-${String(nextMonthNumber).padStart(2, "0")}-01`;
};

const periodStartKeys = (startDateKey, endDateKey) => {
  if (!isValidDateKey(startDateKey) || !isValidDateKey(endDateKey)) return [];
  const result = [];
  let monthCursor = `${startDateKey.slice(0, 7)}-01`;
  const lastMonth = `${endDateKey.slice(0, 7)}-01`;
  while (monthCursor <= lastMonth) {
    for (const period of getMonthWeekPeriods(monthCursor)) {
      if (
        period.startDateKey >= startDateKey &&
        period.startDateKey <= endDateKey
      ) {
        result.push(period.startDateKey);
      }
    }
    monthCursor = nextMonth(monthCursor);
  }
  return result;
};

const emptyChart = (dimensions) => ({
  dimensions,
  points: [],
  measuredPoints: [],
  path: "",
  yTicks: [],
  xTicks: [],
  baseline: null,
});

const tickIndexes = (length, maximum) => {
  if (length <= maximum) return Array.from({ length }, (_, index) => index);
  return [
    ...new Set(
      Array.from({ length: maximum }, (_, index) =>
        Math.round((index / (maximum - 1)) * (length - 1)),
      ),
    ),
  ];
};

export const buildBodyMetricChartModel = (
  sourcePoints = [],
  { startDateKey = null, endDateKey = null, width = DEFAULT_CHART_WIDTH } = {},
) => {
  const dimensions = chartDimensions(width);
  const measurements = sourcePoints
    .filter(
      (point) =>
        isValidDateKey(point?.dateKey) &&
        typeof point?.value === "number" &&
        Number.isFinite(point.value) &&
        point.value > 0 &&
        (!startDateKey || point.dateKey >= startDateKey) &&
        (!endDateKey || point.dateKey <= endDateKey),
    )
    .sort((left, right) => left.dateKey.localeCompare(right.dateKey));
  if (measurements.length === 0) return emptyChart(dimensions);

  const measurementByDate = new Map(
    measurements.map((point) => [point.dateKey, point]),
  );
  const canonicalPeriodKeys = periodStartKeys(startDateKey, endDateKey);
  const timelineKeys = [
    ...new Set([
      ...(canonicalPeriodKeys.length > 0
        ? canonicalPeriodKeys
        : measurements.map((point) => point.dateKey)),
      ...measurements.map((point) => point.dateKey),
    ]),
  ].sort();
  const values = timelineKeys.map((dateKey) =>
    measurementByDate.get(dateKey) || { dateKey, value: null },
  );

  const metricValues = measurements.map((point) => point.value);
  const rawMin = Math.min(...metricValues);
  const rawMax = Math.max(...metricValues);
  const domainPadding = Math.max(0.5, (rawMax - rawMin) * 0.15);
  const domainMin = rawMin - domainPadding;
  const domainMax = rawMax + domainPadding;
  const { height, padding, plotHeight, plotWidth } = dimensions;
  const timelineTimes = values.map((point) =>
    Date.parse(`${point.dateKey}T12:00:00+07:00`),
  );
  const firstTime = timelineTimes[0];
  const lastTime = timelineTimes.at(-1);
  const xFor = (index) =>
    firstTime === lastTime
      ? padding.left + plotWidth / 2
      : padding.left +
        ((timelineTimes[index] - firstTime) / (lastTime - firstTime)) *
          plotWidth;
  const yFor = (value) =>
    padding.top + ((domainMax - value) / (domainMax - domainMin)) * plotHeight;
  const points = values.map((point, index) => ({
    ...point,
    x: roundCoordinate(xFor(index)),
    y: Number.isFinite(point.value)
      ? roundCoordinate(yFor(point.value))
      : null,
    dateLabel: dateLabel(point.dateKey),
  }));
  let drawing = false;
  const path = points
    .map((point) => {
      if (!Number.isFinite(point.value)) {
        drawing = false;
        return "";
      }
      const command = drawing ? "L" : "M";
      drawing = true;
      return `${command} ${point.x} ${point.y}`;
    })
    .filter(Boolean)
    .join(" ");
  const yTicks = Array.from({ length: 4 }, (_, index) => {
    const value = domainMax - (index / 3) * (domainMax - domainMin);
    return {
      value: Number(value.toFixed(1)),
      weight: Number(value.toFixed(1)),
      y: roundCoordinate(yFor(value)),
    };
  });
  const xTicks = tickIndexes(points.length, dimensions.width < 520 ? 4 : 6).map(
    (index) => points[index],
  );
  const measuredPoints = points.filter((point) => Number.isFinite(point.value));
  const firstPoint = measuredPoints[0];

  return {
    dimensions,
    points,
    measuredPoints,
    path,
    yTicks,
    xTicks,
    baseline: {
      value: firstPoint.value,
      y: roundCoordinate(yFor(firstPoint.value)),
    },
    axisBottom: height - padding.bottom,
  };
};

export const buildWeightChartModel = (sourcePoints = [], options) =>
  buildBodyMetricChartModel(
    sourcePoints.map((point) => ({
      ...point,
      dateKey: point?.weekStartDateKey,
      value: point?.weightKg,
    })),
    options,
  );
