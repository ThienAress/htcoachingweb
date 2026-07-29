import { describe, expect, it } from "vitest";
import {
  toHabitCompletionCommands,
  upsertHabitCompletion,
} from "../dailyHabits";
import { habitFormSchema, habitFormToPayload } from "../habitForm";

describe("dailyHabits adapter", () => {
  it("strips server snapshots before sending Journal patch", () => {
    expect(
      toHabitCompletionCommands([
        {
          habitId: "64b000000000000000000001",
          lineageKey: "lineage",
          version: 3,
          titleSnapshot: "Drink water",
          status: "completed",
          recordedAt: "2026-07-29T00:00:00.000Z",
        },
      ]),
    ).toEqual([
      {
        habitId: "64b000000000000000000001",
        status: "completed",
      },
    ]);
  });

  it("upserts by lineage so a new definition version does not duplicate completion", () => {
    const current = [
      {
        habitId: "64b000000000000000000001",
        lineageKey: "same-lineage",
        status: "completed",
      },
    ];
    expect(
      upsertHabitCompletion(current, {
        habitId: "64b000000000000000000002",
        lineageKey: "same-lineage",
        status: "skipped",
      }),
    ).toEqual([
      {
        habitId: "64b000000000000000000002",
        status: "skipped",
      },
    ]);
  });

  it("rejects a 21st completion", () => {
    const completions = Array.from({ length: 20 }, (_, index) => ({
      habitId: String(index),
      lineageKey: String(index),
      status: "completed",
    }));
    expect(() =>
      upsertHabitCompletion(completions, {
        habitId: "next",
        lineageKey: "next",
        status: "completed",
      }),
    ).toThrow(/20 habit completions/i);
  });

  it("requires a scheduled day and keeps self-created habit private by default", () => {
    expect(
      habitFormSchema.safeParse({
        title: "Walk",
        category: "movement",
        daysOfWeek: [],
        shared: false,
      }).success,
    ).toBe(false);
    expect(
      habitFormToPayload(
        {
          title: " Walk ",
          category: "movement",
          daysOfWeek: [2, 0],
          shared: false,
        },
        "2026-07-29",
      ),
    ).toMatchObject({
      title: "Walk",
      visibility: "private",
      schedule: { daysOfWeek: [0, 2] },
    });
  });
});
