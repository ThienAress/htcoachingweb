import { describe, expect, it } from "vitest";
import { buildProgressReadModel } from "../progressReadModel.service.js";

const range = { days: 30, startDateKey: "2026-09-01", endDateKey: "2026-09-30" };
describe("progress circumference projection", () => {
  it("includes hip and abdomen without fabricating a cross-period ratio", () => {
    const result = buildProgressReadModel({ range, weeklyCheckins: [
      { weekStartDateKey: "2026-09-07", status: "submitted", waistCm: 80, abdomenCm: 85 },
      { weekStartDateKey: "2026-09-14", status: "submitted", hipCm: 100 },
    ] }).bodyProgress;
    expect(result.hipCm.current.value).toBe(100);
    expect(result.abdomenCm.current.value).toBe(85);
    expect(result.waistHipRatio.current).toBeNull();
  });
  it("derives ratio only from same-record valid measurements", () => {
    const result = buildProgressReadModel({ range, weeklyCheckins: [
      { weekStartDateKey: "2026-09-07", status: "submitted", waistCm: 80, hipCm: 100 },
    ] }).bodyProgress;
    expect(result.waistHipRatio).toEqual({ unit: "", current: { dateKey: "2026-09-07", value: 0.8 }, delta: null, series: [{ dateKey: "2026-09-07", value: 0.8 }] });
  });
});
