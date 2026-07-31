import { describe, expect, it } from "vitest";
import {
  toHabitCompletionCommands,
  upsertHabitCompletion,
} from "../dailyHabits";
import {
  habitFormSchema,
  habitFormToPayload,
  habitToFormValues,
} from "../habitForm";

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
    ).toThrow(/20 lượt hoàn thành thói quen/i);
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

  it("giao habit HLV cho đủ bảy ngày từ ngày tạo thực tế", () => {
    expect(
      habitFormToPayload(
        {
          title: "Đi bộ",
          category: "movement",
          daysOfWeek: [2],
          shared: false,
        },
        "2026-06-01",
        { trainer: true, todayDateKey: "2026-07-31" },
      ),
    ).toMatchObject({
      visibility: "shared",
      schedule: {
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        startDateKey: "2026-07-31",
        endDateKey: null,
      },
    });
  });
  it("prefills and preserves hidden definition fields when updating a habit", () => {
    const habit = {
      title: "Đi bộ",
      category: "movement",
      description: "Sau bữa tối",
      target: 30,
      unit: "phút",
      visibility: "shared",
      schedule: {
        daysOfWeek: [0, 2, 4],
        startDateKey: "2026-07-01",
        endDateKey: "2026-08-01",
      },
    };

    expect(habitToFormValues(habit)).toMatchObject({
      title: "Đi bộ",
      daysOfWeek: [0, 2, 4],
      shared: true,
    });
    expect(
      habitFormToPayload(habitToFormValues(habit), "2026-07-31", {
        trainer: true,
        habit,
        todayDateKey: "2026-07-31",
      }),
    ).toMatchObject({
      description: "Sau bữa tối",
      target: 30,
      unit: "phút",
      visibility: "shared",
      schedule: {
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        startDateKey: "2026-07-01",
        endDateKey: null,
      },
    });
  });
});