import { describe, expect, it } from "vitest";
import {
  progressMetricRows,
  summarizeProgressAvailability,
} from "../progressPresentation";
import {
  checkinToWeeklyValues,
  weeklyFormSchema,
  weeklyValuesToPatch,
} from "../weeklyCheckinForm";

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
});
