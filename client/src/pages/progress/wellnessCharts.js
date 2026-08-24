import {
  addDaysToDateKey,
  isValidDateKey,
} from "../../utils/vietnamDate";

const DEFAULT_WIDTH = 640;
const WIDE_HEIGHT = 330;
const COMPACT_HEIGHT = 300;

const roundCoordinate = (value) => Number(value.toFixed(2));

const chartDimensions = (requestedWidth) => {
  const width = Math.max(280, Number(requestedWidth) || DEFAULT_WIDTH);
  const compact = width < 520;
  const height = compact ? COMPACT_HEIGHT : WIDE_HEIGHT;
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

const dateLabel = (dateKey) => {
  const [, month, day] = String(dateKey || "").split("-");
  return month && day ? `${day}/${month}` : "";
};

const dailyKeys = (startDateKey, endDateKey) => {
  if (
    !isValidDateKey(startDateKey) ||
    !isValidDateKey(endDateKey) ||
    startDateKey > endDateKey
  ) {
    return [];
  }
  const result = [];
  let cursor = startDateKey;
  while (cursor <= endDateKey && result.length < 366) {
    result.push(cursor);
    cursor = addDaysToDateKey(cursor, 1);
  }
  return result;
};

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

const emptyChart = (dimensions) => ({
  dimensions,
  domain: null,
  points: [],
  measuredPoints: [],
  path: "",
  yTicks: [],
  xTicks: [],
  average: null,
});

const normalizeFixedDomain = (fixedDomain) => {
  if (
    Array.isArray(fixedDomain) &&
    fixedDomain.length === 2 &&
    Number.isFinite(fixedDomain[0]) &&
    Number.isFinite(fixedDomain[1]) &&
    fixedDomain[0] < fixedDomain[1]
  ) {
    return [...fixedDomain];
  }
  return null;
};

const resolveDomain = (values, fixedDomain) => {
  if (fixedDomain) return fixedDomain;
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const padding = Math.max(
    0.5,
    (rawMax - rawMin) * 0.15,
    Math.abs(rawMax) * 0.05,
  );
  const domainMin = Math.max(0, rawMin - padding);
  const domainMax = Math.max(domainMin + 1, rawMax + padding);
  return [domainMin, domainMax];
};

export const buildWellnessMetricChartModel = (
  sourcePoints = [],
  {
    startDateKey = null,
    endDateKey = null,
    width = DEFAULT_WIDTH,
    domain: fixedDomain = null,
  } = {},
) => {
  const dimensions = chartDimensions(width);
  const normalizedFixedDomain = normalizeFixedDomain(fixedDomain);
  const measurements = sourcePoints
    .filter(
      (point) =>
        isValidDateKey(point?.dateKey) &&
        typeof point?.value === "number" &&
        Number.isFinite(point.value) &&
        point.value >= 0 &&
        (!normalizedFixedDomain ||
          (point.value >= normalizedFixedDomain[0] &&
            point.value <= normalizedFixedDomain[1])) &&
        (!startDateKey || point.dateKey >= startDateKey) &&
        (!endDateKey || point.dateKey <= endDateKey),
    )
    .sort((left, right) => left.dateKey.localeCompare(right.dateKey));
  if (measurements.length === 0) return emptyChart(dimensions);

  const measurementByDate = new Map(
    measurements.map((point) => [point.dateKey, point]),
  );
  const canonicalKeys = dailyKeys(startDateKey, endDateKey);
  const timelineKeys = [
    ...new Set([
      ...(canonicalKeys.length
        ? canonicalKeys
        : measurements.map((point) => point.dateKey)),
      ...measurements.map((point) => point.dateKey),
    ]),
  ].sort();
  const values = timelineKeys.map(
    (key) => measurementByDate.get(key) || { dateKey: key, value: null },
  );
  const metricValues = measurements.map(({ value }) => value);
  const domain = resolveDomain(metricValues, normalizedFixedDomain);
  const [domainMin, domainMax] = domain;
  const { padding, plotHeight, plotWidth } = dimensions;
  const firstTime = Date.parse(`${timelineKeys[0]}T12:00:00+07:00`);
  const lastTime = Date.parse(`${timelineKeys.at(-1)}T12:00:00+07:00`);
  const xFor = (dateKey) =>
    firstTime === lastTime
      ? padding.left + plotWidth / 2
      : padding.left +
        ((Date.parse(`${dateKey}T12:00:00+07:00`) - firstTime) /
          (lastTime - firstTime)) *
          plotWidth;
  const yFor = (value) =>
    padding.top + ((domainMax - value) / (domainMax - domainMin)) * plotHeight;
  const points = values.map((point) => ({
    ...point,
    x: roundCoordinate(xFor(point.dateKey)),
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
  const yTicks = Array.from({ length: 5 }, (_, index) => {
    const value = domainMax - (index / 4) * (domainMax - domainMin);
    return {
      value: Number(value.toFixed(1)),
      y: roundCoordinate(yFor(value)),
    };
  });
  const xTicks = tickIndexes(points.length, dimensions.width < 520 ? 4 : 6).map(
    (index) => points[index],
  );
  const measuredPoints = points.filter((point) => Number.isFinite(point.value));
  const averageValue = Number(
    (
      metricValues.reduce((sum, value) => sum + value, 0) /
      metricValues.length
    ).toFixed(2),
  );

  return {
    dimensions,
    domain,
    points,
    measuredPoints,
    path,
    yTicks,
    xTicks,
    average: {
      value: averageValue,
      y: roundCoordinate(yFor(averageValue)),
    },
  };
};
