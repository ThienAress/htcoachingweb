import { describe, expect, it } from "vitest";
import {
  buildBodyMetricChartModel,
  buildWeightChartModel,
} from "../progressCharts";

describe("progress chart presentation", () => {
  it("keeps an empty weight series empty", () => {
    expect(buildWeightChartModel([])).toMatchObject({
      points: [],
      measuredPoints: [],
      path: "",
      yTicks: [],
    });
  });

  it("centers a single weight point without dividing by zero", () => {
    const chart = buildWeightChartModel([
      { weekStartDateKey: "2026-07-27", weightKg: 70 },
    ]);

    expect(chart.points[0]).toMatchObject({
      x: 344,
      dateLabel: "27/07",
      weightKg: 70,
    });
  });

  it("maps a weight series from left to right inside the chart bounds", () => {
    const chart = buildWeightChartModel([
      { weekStartDateKey: "2026-07-13", weightKg: 72 },
      { weekStartDateKey: "2026-07-20", weightKg: 71 },
      { weekStartDateKey: "2026-07-27", weightKg: 69.5 },
    ]);

    expect(chart.points.map(({ x }) => x)).toEqual([72, 344, 616]);
    expect(chart.path).toMatch(/^M 72 /);
    expect(chart.yTicks).toHaveLength(4);
  });

  it("sorts body measurement points and ignores missing values", () => {
    const chart = buildBodyMetricChartModel([
      { dateKey: "2026-07-20", value: 78 },
      { dateKey: "2026-07-06", value: 80 },
      { dateKey: "2026-07-13", value: null },
      { dateKey: "2026-02-30", value: 79 },
    ]);

    expect(chart.points.map(({ dateKey, value }) => [dateKey, value])).toEqual([
      ["2026-07-06", 80],
      ["2026-07-20", 78],
    ]);
  });

  it("connects only report periods that contain a measurement", () => {
    const chart = buildBodyMetricChartModel(
      [
        { dateKey: "2026-07-06", value: 80 },
        { dateKey: "2026-07-20", value: 78 },
      ],
      {
        startDateKey: "2026-07-01",
        endDateKey: "2026-07-31",
      },
    );

    expect(chart.points.map(({ dateKey, value }) => [dateKey, value])).toEqual([
      ["2026-07-06", 80],
      ["2026-07-20", 78],
    ]);
    expect(chart.path.match(/M /g)).toHaveLength(1);
    expect(chart.path).toContain("L");
  });

  it("builds chart geometry from the rendered width", () => {
    const chart = buildBodyMetricChartModel(
      [
        { dateKey: "2026-07-06", value: 80 },
        { dateKey: "2026-07-13", value: 79 },
      ],
      { width: 320 },
    );

    expect(chart.dimensions).toMatchObject({ width: 320, height: 300 });
    expect(chart.points.map(({ x }) => x)).toEqual([64, 300]);
    expect(chart.xTicks).toHaveLength(2);
  });
});
