import { describe, expect, it } from "vitest";
import {
  bodyProgressHistoryRows,
  normalizeProgressSection,
  normalizeProgressDaysForSection,
  progressMetricRows,
  progressRangeOptions,
  progressSectionHasData,
  summarizeProgressAvailability,
} from "../progressPresentation";
import {
  checkinToWeeklyValues,
  deriveWeeklyCheckinEditState,
  getMissingWeeklyFields,
  weeklyFormSchema,
  weeklyValuesToPatch,
} from "../weeklyCheckinForm";
import { getMonthWeekPeriods } from "../../../utils/vietnamDate";

describe("Progress presentation", () => {
  it("uses six-month ranges only for body progress", () => {
    expect([
      progressRangeOptions("body"),
      progressRangeOptions("wellness"),
      normalizeProgressDaysForSection("body", 7),
      normalizeProgressDaysForSection("wellness", 180),
    ]).toEqual([
      [30, 90, 180],
      [7, 30, 90],
      30,
      90,
    ]);
  });

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

  it("merges weight and waist histories by date without inventing zeroes", () => {
    expect(
      bodyProgressHistoryRows({
        weightKg: {
          series: [
            { dateKey: "2026-07-06", value: 70 },
            { dateKey: "2026-07-20", value: 69 },
          ],
        },
        waistCm: {
          series: [{ dateKey: "2026-07-13", value: 78 }],
        },
      }),
    ).toEqual([
      {
        dateKey: "2026-07-06",
        weightKg: 70,
        waistCm: null,
        bodyFatPercent: null,
        skeletalMusclePercent: null,
      },
      {
        dateKey: "2026-07-13",
        weightKg: null,
        waistCm: 78,
        bodyFatPercent: null,
        skeletalMusclePercent: null,
      },
      {
        dateKey: "2026-07-20",
        weightKg: 69,
        waistCm: null,
        bodyFatPercent: null,
        skeletalMusclePercent: null,
      },
    ]);
  });

  it("counts waist-only progress as available", () => {
    expect(
      summarizeProgressAvailability({
        compliance: {},
        wellness: {},
        bodyProgress: {
          weightKg: { series: [] },
          waistCm: { series: [{ dateKey: "2026-07-20", value: 78 }] },
        },
      }),
    ).toBe(true);
  });

  it("counts a body-composition-only measurement as available", () => {
    expect(
      summarizeProgressAvailability({
        compliance: {},
        wellness: {},
        bodyProgress: {
          bodyFatPercent: {
            series: [{ dateKey: "2026-07-20", value: 18.5 }],
          },
        },
      }),
    ).toBe(true);
  });

  it("accepts only the three canonical progress sections", () => {
    expect([
      normalizeProgressSection("compliance"),
      normalizeProgressSection("body"),
      normalizeProgressSection("wellness"),
      normalizeProgressSection("unknown"),
    ]).toEqual(["compliance", "body", "wellness", null]);
  });

  it("does not turn missing section data into zero", () => {
    expect(
      [
        progressSectionHasData("compliance", {
          compliance: { scheduleAttendance: { percent: null } },
        }),
        progressSectionHasData("body", {
          bodyProgress: { weightKg: { series: [] }, waistCm: { series: [] } },
        }),
        progressSectionHasData("wellness", {
          wellness: { energy: { average: null }, daily: [] },
        }),
      ],
    ).toEqual([false, false, false]);
  });
});

describe("Weekly Check-in form", () => {
  it("lists the optional weekly measurements that are still empty", () => {
    expect(
      getMissingWeeklyFields({
        weightKg: "72.5",
        waistCm: "",
        bodyFatPercent: null,
        skeletalMusclePercent: "42",
      }),
    ).toEqual([
      { key: "waistCm", label: "Vòng eo" },
      { key: "bodyFatPercent", label: "Tỷ lệ mỡ cơ thể" },
    ]);
  });

  it("normalizes and submits only the four optional body measurements", () => {
    const values = weeklyFormSchema.parse({
      weightKg: "72.5",
      waistCm: "",
      bodyFatPercent: "18.5",
      skeletalMusclePercent: "42",
    });

    expect(weeklyValuesToPatch(values)).toEqual({
      body: {
        weightKg: 72.5,
        waistCm: null,
        bodyFatPercent: 18.5,
        skeletalMusclePercent: 42,
      },
    });
  });

  it("rejects body composition values outside the accepted range", () => {
    expect(
      weeklyFormSchema.safeParse({
        weightKg: "",
        waistCm: "",
        bodyFatPercent: "0",
        skeletalMusclePercent: "81",
      }).success,
    ).toBe(false);
  });

  it("maps server null values to controlled form strings", () => {
    expect(
      checkinToWeeklyValues({
        body: {
          weightKg: null,
          bodyFatPercent: 18.5,
          skeletalMusclePercent: null,
          energy: 6,
          note: "Dữ liệu cũ không còn thuộc form",
        },
      }),
    ).toMatchObject({
      weightKg: "",
      bodyFatPercent: "18.5",
      skeletalMusclePercent: "",
    });
  });

  it("locks a submitted report except while its single update is open", () => {
    const submitted = { status: "submitted", correctionCount: 0 };
    const locked = deriveWeeklyCheckinEditState({
      checkin: submitted,
      canEdit: true,
      isCorrectionOpen: false,
    });
    const open = deriveWeeklyCheckinEditState({
      checkin: submitted,
      canEdit: true,
      isCorrectionOpen: true,
      hasChanges: false,
    });
    const changed = deriveWeeklyCheckinEditState({
      checkin: submitted,
      canEdit: true,
      isCorrectionOpen: true,
      hasChanges: true,
    });
    const used = deriveWeeklyCheckinEditState({
      checkin: { status: "submitted", correctionCount: 1 },
      canEdit: true,
      isCorrectionOpen: true,
    });

    expect([
      [locked.fieldsDisabled, locked.canOpenCorrection],
      [open.fieldsDisabled, open.canSubmitCorrection],
      [changed.fieldsDisabled, changed.canSubmitCorrection],
      [used.fieldsDisabled, used.canOpenCorrection],
    ]).toEqual([
      [true, true],
      [false, false],
      [false, true],
      [true, false],
    ]);
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

});
