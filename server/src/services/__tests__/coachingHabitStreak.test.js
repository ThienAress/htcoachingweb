import { describe, expect, it } from "vitest";
import {
  deriveHabitStreak,
  isHabitWithinScheduleRange,
} from "../coachingHabitStreak.service.js";

const habit = (daysOfWeek) => ({
  lineageKey: "habit-lineage",
  schedule: {
    daysOfWeek,
    startDateKey: "2026-01-01",
    endDateKey: null,
  },
});
const journal = (dateKey, status = "completed") => ({
  dateKey,
  habitCompletions: [{ lineageKey: "habit-lineage", status }],
});

describe("deriveHabitStreak", () => {
  it("phân biệt ngày trong khoảng tuần với ngày được chọn", () => {
    const weeklyHabit = {
      schedule: {
        daysOfWeek: [1, 3, 5],
        startDateKey: "2026-08-17",
        endDateKey: "2026-08-23",
      },
    };

    expect([
      isHabitWithinScheduleRange(weeklyHabit, "2026-08-17"),
      isHabitWithinScheduleRange(weeklyHabit, "2026-08-23"),
      isHabitWithinScheduleRange(weeklyHabit, "2026-08-24"),
    ]).toEqual([true, true, false]);
  });
  it("continues across the Sunday/Monday week boundary", () => {
    expect(
      deriveHabitStreak({
        habit: habit([0, 1, 2, 3, 4, 5, 6]),
        journals: [journal("2026-07-26"), journal("2026-07-27")],
        dateKey: "2026-07-27",
      }),
    ).toBe(2);
  });

  it("skips non-scheduled days without breaking streak", () => {
    expect(
      deriveHabitStreak({
        habit: habit([0, 2]),
        journals: [journal("2026-07-27"), journal("2026-07-29")],
        dateKey: "2026-07-29",
      }),
    ).toBe(2);
  });

  it("stops on a skipped scheduled day", () => {
    expect(
      deriveHabitStreak({
        habit: habit([0, 1, 2, 3, 4, 5, 6]),
        journals: [journal("2026-07-28"), journal("2026-07-29", "skipped")],
        dateKey: "2026-07-29",
      }),
    ).toBe(0);
  });
});
