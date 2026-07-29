import { describe, expect, it } from "vitest";
import {
  attentionRows,
  todayStatusLabel,
} from "../trainerOverviewPresentation";

describe("trainerOverviewPresentation", () => {
  it("uses non-sensitive attention labels", () => {
    expect(
      attentionRows([
        { code: "pain_flag", severity: "high", count: 1, dateKey: "2026-07-29" },
        { code: "missed_weekly_checkin", severity: "medium", count: 1 },
      ]),
    ).toEqual([
      expect.objectContaining({
        label: "Có pain flag cần xem",
        detail: "Xem nhật ký được chia sẻ",
      }),
      expect.objectContaining({
        label: "Thiếu Weekly Check-in tuần trước",
      }),
    ]);
  });

  it("maps canonical Today statuses without inventing a second formula", () => {
    expect(todayStatusLabel("completed")).toBe("Đã hoàn thành");
    expect(todayStatusLabel("rest_day")).toBe("Ngày nghỉ");
    expect(todayStatusLabel("unknown")).toBe("Chưa xác định");
  });
});
