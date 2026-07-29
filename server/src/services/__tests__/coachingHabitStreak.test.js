import { describe, expect, it } from "vitest";
import { deriveHabitStreak } from "../coachingHabitStreak.service.js";

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
