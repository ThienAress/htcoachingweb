import { describe, expect, it } from "vitest";
import {
  buildProgressReadModel,
  createProgressRange,
} from "../progressReadModel.service.js";

const range = {
  days: 7,
  startDateKey: "2026-07-23",
  endDateKey: "2026-07-29",
};

describe("progressReadModel", () => {
  it("keeps every missing denominator and average explicitly unavailable", () => {
    const result = buildProgressReadModel({ range });

    for (const metric of Object.values(result.compliance)) {
      expect(metric).toEqual({ numerator: 0, denominator: 0, percent: null });
    }
    expect(result.wellness.sleepHours).toEqual({ average: null, count: 0 });
    expect(result.weightTrend).toEqual({ points: [], changeKg: null });
  });

  it("calculates only due assignments and never turns missing values into zero", () => {
    const result = buildProgressReadModel({
      range,
      schedules: [
        { dateKey: "2026-07-23", status: "completed" },
        { dateKey: "2026-07-24", status: "scheduled" },
        { dateKey: "2026-07-25", status: "cancelled" },
        { dateKey: "2026-07-29", status: "scheduled" },
      ],
      workouts: [
        { dateKey: "2026-07-23", status: "completed" },
        { dateKey: "2026-07-24", status: "published" },
        { dateKey: "2026-07-29", status: "published" },
      ],
      coachingDays: [
        { dateKey: "2026-07-23", status: "completed" },
        { dateKey: "2026-07-24", status: "pending" },
        { dateKey: "2026-07-29", status: "pending" },
      ],
      journals: [
        {
          dateKey: "2026-07-23",
          wellness: { sleepHours: 8, energy: 7 },
          plannedMealKeys: ["breakfast", "lunch"],
          nutritionEntries: [
            { plannedMealKey: "breakfast", status: "eaten" },
            { plannedMealKey: "lunch", status: "changed" },
          ],
          habitCompletions: [
            { lineageKey: "habit-a", status: "completed" },
          ],
        },
        {
          dateKey: "2026-07-24",
          wellness: { sleepHours: 6 },
          plannedMealKeys: [],
          nutritionEntries: [{ status: "eaten" }],
          habitCompletions: [
            { lineageKey: "habit-a", status: "skipped" },
          ],
        },
      ],
      habits: [
        {
          lineageKey: "habit-a",
          version: 1,
          status: "active",
          effectiveDateKey: "2026-07-01",
          schedule: {
            startDateKey: "2026-07-01",
            endDateKey: null,
            daysOfWeek: [3, 4],
          },
        },
      ],
      weeklyCheckins: [
        { weekStartDateKey: "2026-07-20", status: "submitted", weightKg: 70 },
        { weekStartDateKey: "2026-07-27", status: "reviewed", weightKg: 69 },
        { weekStartDateKey: "2026-07-13", status: "draft", weightKg: 68 },
      ],
    });

    expect(result.compliance.scheduleAttendance).toEqual({
      numerator: 1,
      denominator: 2,
      percent: 50,
    });
    expect(result.compliance.workoutCompletion.percent).toBe(50);
    expect(result.compliance.coachingCompletion.percent).toBe(50);
    expect(result.compliance.mealCompliance.percent).toBe(50);
    expect(result.compliance.habitCompliance.percent).toBe(50);
    expect(result.wellness.sleepHours).toEqual({ average: 7, count: 2 });
    expect(result.wellness.energy).toEqual({ average: 7, count: 1 });
    expect(result.weightTrend.changeKg).toBe(-1);
    expect(result.weightTrend.points).toHaveLength(2);
  });

  it("uses the effective immutable habit version and ignores unscheduled days", () => {
    const result = buildProgressReadModel({
      range,
      journals: [
        {
          dateKey: "2026-07-23",
          habitCompletions: [
            { lineageKey: "habit-a", status: "completed" },
          ],
        },
      ],
      habits: [
        {
          lineageKey: "habit-a",
          version: 1,
          status: "active",
          effectiveDateKey: "2026-07-01",
          schedule: {
            startDateKey: "2026-07-01",
            endDateKey: null,
            daysOfWeek: [3, 4, 5],
          },
        },
        {
          lineageKey: "habit-a",
          version: 2,
          status: "paused",
          effectiveDateKey: "2026-07-24",
          schedule: {
            startDateKey: "2026-07-01",
            endDateKey: null,
            daysOfWeek: [3, 4, 5],
          },
        },
      ],
    });

    expect(result.compliance.habitCompliance).toEqual({
      numerator: 1,
      denominator: 1,
      percent: 100,
    });
  });

  it("creates exact bounded 7/30/90-day Vietnam ranges", () => {
    const now = new Date("2026-07-29T08:00:00.000Z");

    expect(createProgressRange(7, now)).toEqual({
      days: 7,
      startDateKey: "2026-07-23",
      endDateKey: "2026-07-29",
    });
    expect(createProgressRange(30, now).startDateKey).toBe("2026-06-30");
    expect(createProgressRange(90, now).startDateKey).toBe("2026-05-01");
    expect(() => createProgressRange(365, now)).toThrow(/7, 30 hoặc 90/);
  });
});
