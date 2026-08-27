import { describe, expect, it } from "vitest";
import {
  toHabitCompletionCommands,
  upsertHabitCompletion,
} from "../dailyHabits";
import {
  getHabitWeekRange,
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
        description: "",
        category: "movement",
        daysOfWeek: [],
        shared: false,
      }).success,
    ).toBe(false);
    expect(
      habitFormToPayload(
        {
          title: " Walk ",
          description: " Sau bữa tối ",
          category: "movement",
          daysOfWeek: [2, 0],
          shared: false,
        },
        "2026-07-29",
      ),
    ).toMatchObject({
      title: "Walk",
      description: "Sau bữa tối",
      visibility: "private",
      schedule: { daysOfWeek: [0, 2] },
    });
  });

  it("giao habit HLV theo các ngày đã chọn trong tuần workspace", () => {
    expect(
      habitFormToPayload(
        {
          title: "Đi bộ",
          description: "Đi bộ sau bữa tối",
          category: "movement",
          daysOfWeek: [4, 2],
          shared: false,
        },
        "2026-08-21",
        { trainer: true },
      ),
    ).toMatchObject({
      description: "Đi bộ sau bữa tối",
      visibility: "shared",
      schedule: {
        daysOfWeek: [2, 4],
        startDateKey: "2026-08-17",
        endDateKey: "2026-08-23",
      },
    });
  });

  it("tính tuần từ Thứ Hai đến Chủ Nhật qua ranh giới tháng", () => {
    expect(getHabitWeekRange("2026-09-01")).toEqual({
      startDateKey: "2026-08-31",
      endDateKey: "2026-09-06",
    });
  });
  it("prefills and preserves hidden definition fields when updating a habit", () => {
    const habit = {
      title: "Đi bộ",
      description: "Sau bữa tối",
      category: "movement",
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
      description: "Sau bữa tối",
      daysOfWeek: [0, 2, 4],
      shared: true,
    });
    expect(
      habitFormToPayload(habitToFormValues(habit), "2026-07-31", {
        trainer: true,
        habit,
      }),
    ).toMatchObject({
      description: "Sau bữa tối",
      target: 30,
      unit: "phút",
      visibility: "shared",
      schedule: {
        daysOfWeek: [0, 2, 4],
        startDateKey: "2026-07-27",
        endDateKey: "2026-08-02",
      },
    });
  });
});
