import { describe, expect, it } from "vitest";
import {
  addDaysToDateKey,
  getAppDayOfWeek,
  getMonthWeekPeriod,
  getMonthWeekPeriods,
  getPreviousMonthWeekPeriod,
  getVietnamDateKey,
  getVietnamDayRangeUtc,
  parseDateKey,
} from "../dateKey.js";

describe("dateKey canonical helpers", () => {
  it("nhận leap day hợp lệ và từ chối ngày không tồn tại", () => {
    expect(parseDateKey("2028-02-29")).toEqual({
      year: 2028,
      month: 2,
      day: 29,
    });
    expect(() => parseDateKey("2026-02-29")).toThrow("không tồn tại");
  });

  it("tính đúng 23:30 và 00:30 tại UTC boundary của Việt Nam", () => {
    expect(getVietnamDateKey(new Date("2026-07-27T16:30:00.000Z"))).toBe(
      "2026-07-27",
    );
    expect(getVietnamDateKey(new Date("2026-07-27T17:30:00.000Z"))).toBe(
      "2026-07-28",
    );
  });

  it("tạo UTC range nửa mở cho một ngày Việt Nam", () => {
    const range = getVietnamDayRangeUtc("2026-07-28");
    expect(range.start.toISOString()).toBe("2026-07-27T17:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-07-28T17:00:00.000Z");
  });

  it("cộng ngày và giữ day index Monday-first", () => {
    expect(addDaysToDateKey("2026-12-31", 1)).toBe("2027-01-01");
    expect(getAppDayOfWeek("2026-07-27")).toBe(0);
  });
  it("chia tháng 7/2026 thành các tuần nằm gọn trong tháng", () => {
    expect(getMonthWeekPeriods("2026-07-15")).toEqual([
      { index: 1, startDateKey: "2026-07-01", endDateKey: "2026-07-05" },
      { index: 2, startDateKey: "2026-07-06", endDateKey: "2026-07-12" },
      { index: 3, startDateKey: "2026-07-13", endDateKey: "2026-07-19" },
      { index: 4, startDateKey: "2026-07-20", endDateKey: "2026-07-26" },
      { index: 5, startDateKey: "2026-07-27", endDateKey: "2026-07-31" },
    ]);
    expect(getMonthWeekPeriod("2026-07-03").startDateKey).toBe("2026-07-01");
    expect(getPreviousMonthWeekPeriod("2026-08-01")).toEqual({
      index: 5,
      startDateKey: "2026-07-27",
      endDateKey: "2026-07-31",
    });
  });
});
