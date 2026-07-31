import { describe, expect, it } from "vitest";
import {
  progressMetricRows,
  summarizeProgressAvailability,
} from "../progressPresentation";
import {
  checkinToWeeklyValues,
  getAdherenceLevel,
  weeklyFormSchema,
  weeklyValuesToPatch,
} from "../weeklyCheckinForm";
import { getMonthWeekPeriods } from "../../../utils/vietnamDate";

describe("Progress presentation", () => {
  it("keeps unavailable compliance distinct from zero percent", () => {
    const rows = progressMetricRows({
      scheduleAttendance: {
        numerator: 0,
        denominator: 0,
        percent: null,
      },
      mealCompliance: {
        numerator: 0,
        denominator: 2,
        percent: 0,
      },
    });

    expect(rows[0].displayPercent).toBe("Chưa có dữ liệu");
    expect(rows[1].displayPercent).toBe("0%");
  });

  it("detects a fully empty progress result", () => {
    expect(
      summarizeProgressAvailability({
        compliance: {
          scheduleAttendance: { percent: null },
          mealCompliance: { percent: null },
        },
        wellness: { energy: { average: null, count: 0 } },
        weightTrend: { points: [] },
      }),
    ).toBe(false);
  });
});

describe("Weekly Check-in form", () => {
  it("normalizes optional numbers and trims text without client-owned extras", () => {
    const values = weeklyFormSchema.parse({
      weightKg: "72.5",
      waistCm: "",
      energy: "8",
      adherence: "7",
      wins: "  Tập đủ lịch  ",
      challenges: "",
      note: "Ổn",
    });

    expect(weeklyValuesToPatch(values)).toEqual({
      body: {
        weightKg: 72.5,
        waistCm: null,
        energy: 8,
        adherence: 7,
        wins: "Tập đủ lịch",
        challenges: "",
        note: "Ổn",
      },
    });
  });

  it("maps server null values to controlled form strings", () => {
    expect(
      checkinToWeeklyValues({
        body: { weightKg: null, energy: 6, note: "Tuần tốt" },
      }),
    ).toMatchObject({
      weightKg: "",
      energy: "6",
      note: "Tuần tốt",
    });
  });

  it("chia tháng thành các kỳ tuần rõ ràng", () => {
    expect(getMonthWeekPeriods("2026-07-15")).toEqual([
      { index: 1, startDateKey: "2026-07-01", endDateKey: "2026-07-05" },
      { index: 2, startDateKey: "2026-07-06", endDateKey: "2026-07-12" },
      { index: 3, startDateKey: "2026-07-13", endDateKey: "2026-07-19" },
      { index: 4, startDateKey: "2026-07-20", endDateKey: "2026-07-26" },
      { index: 5, startDateKey: "2026-07-27", endDateKey: "2026-07-31" },
    ]);
  });

  it("diễn giải điểm bám kế hoạch bằng ngôn ngữ coaching", () => {
    expect([2, 5, 8, 10].map((score) => getAdherenceLevel(score).label)).toEqual([
      "Cần hỗ trợ thêm",
      "Chưa ổn định",
      "Bám khá tốt",
      "Bám rất tốt",
    ]);
  });
});
