import { describe, expect, it, vi } from "vitest";

vi.mock("../../utils/sendMail.js", () => ({
  sendScheduleReminderMail: vi.fn(),
}));

import { buildReminderWindows } from "../scheduleReminderCron.js";

describe("schedule reminder windows", () => {
  it("splits the reminder window correctly across midnight in Vietnam", () => {
    const windows = buildReminderWindows(
      new Date("2026-07-19T16:30:00.000Z"),
    );

    expect(windows).toEqual([
      {
        dateKey: "2026-07-19",
        dayOfWeek: 6,
        startTime: "23:55",
        endTime: "23:59",
      },
      {
        dateKey: "2026-07-20",
        dayOfWeek: 0,
        startTime: "00:00",
        endTime: "00:05",
      },
    ]);
  });

  it("returns one window when the target range stays on the same day", () => {
    const windows = buildReminderWindows(
      new Date("2026-07-20T02:00:00.000Z"),
    );

    expect(windows).toEqual([
      {
        dateKey: "2026-07-20",
        dayOfWeek: 0,
        startTime: "09:25",
        endTime: "09:35",
      },
    ]);
  });
});
