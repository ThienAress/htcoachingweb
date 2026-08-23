import { describe, expect, it } from "vitest";

import { buildWellnessMetricChartModel } from "../wellnessCharts";

describe("wellness trend chart model", () => {
  it("breaks the path when a day has no selected metric value", () => {
    const chart = buildWellnessMetricChartModel(
      [
        { dateKey: "2026-08-21", value: 6 },
        { dateKey: "2026-08-23", value: 8 },
      ],
      {
        startDateKey: "2026-08-21",
        endDateKey: "2026-08-23",
      },
    );

    expect({
      values: chart.points.map(({ dateKey, value }) => [dateKey, value]),
      moveCommands: chart.path.match(/M /g)?.length,
      hasLine: chart.path.includes("L"),
      average: chart.average.value,
    }).toEqual({
      values: [
        ["2026-08-21", 6],
        ["2026-08-22", null],
        ["2026-08-23", 8],
      ],
      moveCommands: 2,
      hasLine: false,
      average: 7,
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
