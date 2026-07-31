import { describe, expect, it } from "vitest";
import {
  buildWeightChartModel,
  wellnessScoreRows,
} from "../progressCharts";

describe("progress chart presentation", () => {
  it("keeps an empty weight series empty", () => {
    expect(buildWeightChartModel([])).toEqual({
      points: [],
      path: "",
      yTicks: [],
    });
  });

  it("centers a single weight point without dividing by zero", () => {
    const chart = buildWeightChartModel([
      { weekStartDateKey: "2026-07-27", weightKg: 70 },
    ]);

    expect(chart.points[0]).toMatchObject({
      x: 320,
      y: 103,
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

    expect(chart.points.map(({ x }) => x)).toEqual([52, 320, 588]);
    expect(chart.path).toMatch(/^M 52 /);
    expect(chart.yTicks).toHaveLength(3);
  });

  it("keeps all wellness score labels visible while rejecting invalid averages", () => {
    const rows = wellnessScoreRows({
      energy: { average: 7.4, count: 4 },
      hunger: { average: 11, count: 2 },
      stress: { average: null, count: 0 },
      soreness: { average: 3, count: 5 },
      pain: { average: -1, count: 2 },
    });

    expect(rows.map(({ key, average }) => [key, average])).toEqual([
      ["energy", 7.4],
      ["hunger", null],
      ["stress", null],
      ["soreness", 3],
      ["pain", null],
    ]);
  });
});
