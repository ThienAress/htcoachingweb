import { describe, expect, it } from "vitest";

import { buildWellnessMetricChartModel } from "../wellnessCharts";

describe("wellness trend chart model", () => {
  it("only plots submitted values and sorts dates from oldest to newest", () => {
    const chart = buildWellnessMetricChartModel(
      [
        { dateKey: "2026-08-23", value: 8 },
        { dateKey: "2026-08-21", value: 6 },
      ],
      {
        startDateKey: "2026-08-21",
        endDateKey: "2026-08-23",
      },
    );

    expect({
      values: chart.points.map(({ dateKey, dateLabel, value }) => [
        dateKey,
        dateLabel,
        value,
      ]),
      moveCommands: chart.path.match(/M /g)?.length,
      hasLine: chart.path.includes("L"),
      average: chart.average.value,
    }).toEqual({
      values: [
        ["2026-08-21", "21/8", 6],
        ["2026-08-23", "23/8", 8],
      ],
      moveCommands: 1,
      hasLine: true,
      average: 7,
    });
  });

  it("does not calculate an average for qualitative observations", () => {
    const chart = buildWellnessMetricChartModel(
      [
        { dateKey: "2026-08-01", value: 3 },
        { dateKey: "2026-08-07", value: 9 },
      ],
      {
        domain: [0, 9],
        includeAverage: false,
        tickValues: [0, 3, 6, 9],
      },
    );

    expect({
      dates: chart.xTicks.map(({ dateKey }) => dateKey),
      yTicks: chart.yTicks.map(({ value }) => value),
      average: chart.average,
    }).toEqual({
      dates: ["2026-08-01", "2026-08-07"],
      yTicks: [9, 6, 3, 0],
      average: null,
    });
  });

  it("keeps score metrics on the canonical zero-to-ten domain", () => {
    const chart = buildWellnessMetricChartModel(
      [
        { dateKey: "2026-08-21", value: 4 },
        { dateKey: "2026-08-22", value: 7 },
        { dateKey: "2026-08-23", value: 12 },
      ],
      {
        startDateKey: "2026-08-21",
        endDateKey: "2026-08-23",
        domain: [0, 10],
      },
    );

    expect({
      domain: chart.domain,
      measuredValues: chart.measuredPoints.map(({ value }) => value),
    }).toEqual({ domain: [0, 10], measuredValues: [4, 7] });
  });

  it("accepts zero, rejects invalid observations and follows rendered width", () => {
    const chart = buildWellnessMetricChartModel(
      [
        { dateKey: "2026-08-21", value: 0 },
        { dateKey: "2026-02-30", value: 5 },
        { dateKey: "2026-08-22", value: -1 },
      ],
      {
        startDateKey: "2026-08-21",
        endDateKey: "2026-08-22",
        width: 320,
      },
    );

    expect({
      dimensions: chart.dimensions,
      measured: chart.measuredPoints.map(({ value }) => value),
    }).toMatchObject({
      dimensions: { width: 320, height: 300 },
      measured: [0],
    });
  });
});
