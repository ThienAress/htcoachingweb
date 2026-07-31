import { describe, expect, it } from "vitest";
import { calculateTodaySummary } from "../todayDashboardSummary.service.js";

const sections = ({ schedules = [], exercises = [], workouts = [], journal = null } = {}) => ({
  schedule: { status: schedules.length ? "ready" : "empty", items: schedules },
  coaching: {
    status: exercises.length ? "ready" : "empty",
    day: exercises.length ? { exercises } : null,
  },
  workout: { status: workouts.length ? "ready" : "empty", items: workouts },
  journal: { status: journal ? "ready" : "empty", day: journal },
});

const wellness = (filledCount) =>
  Object.fromEntries(
    [
      "sleepHours",
      "waterMl",
      "steps",
      "energy",
      "hunger",
      "stress",
      "soreness",
      "pain",
    ].map((field, index) => [field, index < filledCount ? index : null]),
  );

const journal = ({ filled = 0, status = "draft", meals = [], entries = [] } = {}) => ({
  status,
  wellness: wellness(filled),
  nutrition: {
    assignment: meals.length
      ? { savedMealPlanId: "plan-1", version: 2 }
      : null,
    plannedMealKeys: meals,
    entries,
  },
});

const plannedEntry = (plannedMealKey, status = "eaten") => ({
  mode: "follow_plan",
  status,
  plannedMealKey,
  savedMealPlanId: "plan-1",
  version: 2,
});

describe("Today Dashboard module completion", () => {
  it("does not turn a day without training assignments into 100 percent", () => {
    const result = calculateTodaySummary(sections(), []);

    expect(result.moduleProgress.training).toEqual({
      completed: 0,
      total: 0,
      percent: null,
      state: "not_applicable",
    });
  });

  it("starts an empty journal at 0 percent", () => {
    const result = calculateTodaySummary(sections(), []);

    expect(result.moduleProgress.journal.percent).toBe(0);
  });

  it("counts three filled wellness fields as 30 percent", () => {
    const result = calculateTodaySummary(
      sections({ journal: journal({ filled: 3 }) }),
      [],
    );

    expect(result.moduleProgress.journal.percent).toBe(30);
  });

  it("counts eight filled wellness fields as 80 percent before submit", () => {
    const result = calculateTodaySummary(
      sections({ journal: journal({ filled: 8 }) }),
      [],
    );

    expect(result.moduleProgress.journal.percent).toBe(80);
  });

  it("counts a complete submitted journal as 100 percent", () => {
    const result = calculateTodaySummary(
      sections({ journal: journal({ filled: 8, status: "submitted" }) }),
      [],
    );

    expect(result.moduleProgress.journal.percent).toBe(100);
  });

  it("counts each planned meal only once", () => {
    const result = calculateTodaySummary(
      sections({
        journal: journal({
          meals: ["breakfast", "lunch"],
          entries: [
            plannedEntry("breakfast"),
            plannedEntry("breakfast", "changed"),
          ],
        }),
      }),
      [],
    );

    expect(result.moduleProgress.nutrition).toMatchObject({
      completed: 1,
      total: 2,
      percent: 50,
    });
  });

  it("accepts eaten, changed and skipped as recorded planned meals", () => {
    const result = calculateTodaySummary(
      sections({
        journal: journal({
          meals: ["breakfast", "lunch", "dinner"],
          entries: [
            plannedEntry("breakfast", "eaten"),
            plannedEntry("lunch", "changed"),
            plannedEntry("dinner", "skipped"),
          ],
        }),
      }),
      [],
    );

    expect(result.moduleProgress.nutrition.percent).toBe(100);
  });

  it("includes schedules, coaching exercises and workout plans in training", () => {
    const result = calculateTodaySummary(
      sections({
        schedules: [{ status: "completed" }],
        exercises: [{ completed: false }],
        workouts: [{ status: "completed" }],
      }),
      [],
    );

    expect(result.moduleProgress.training).toMatchObject({
      completed: 2,
      total: 3,
      percent: 67,
    });
  });
});
