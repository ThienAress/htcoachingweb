import { describe, expect, it } from "vitest";
import {
  addDaysToDateKey,
  getAppDayOfWeek,
  getMonthWeekPeriods,
  getRecentMonthDateKeys,
  getVietnamDateKey,
  isValidDateKey,
} from "../vietnamDate";

describe("vietnamDate", () => {
  it("tính đúng 23:30 và 00:30 tại UTC boundary của Việt Nam", () => {
    expect(getVietnamDateKey(new Date("2026-07-27T16:30:00.000Z"))).toBe(
      "2026-07-27",
    );
    expect(getVietnamDateKey(new Date("2026-07-27T17:30:00.000Z"))).toBe(
      "2026-07-28",
    );
  });

  it("validate calendar date thay vì chỉ regex", () => {
    expect(isValidDateKey("2028-02-29")).toBe(true);
    expect(isValidDateKey("2026-02-29")).toBe(false);
  });

  it("cộng ngày qua năm mới", () => {
    expect(addDaysToDateKey("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("trả day index Monday-first", () => {
    expect(getAppDayOfWeek("2026-07-27")).toBe(0);
  });

  it("gộp ngày lẻ và trả bốn tháng báo cáo gần nhất", () => {
    expect(getMonthWeekPeriods("2026-08-24")).toEqual([
      {
        index: 1,
        startDateKey: "2026-08-03",
        rangeStartDateKey: "2026-08-01",
        endDateKey: "2026-08-09",
      },
      {
        index: 2,
        startDateKey: "2026-08-10",
        rangeStartDateKey: "2026-08-10",
        endDateKey: "2026-08-16",
      },
      {
        index: 3,
        startDateKey: "2026-08-17",
        rangeStartDateKey: "2026-08-17",
        endDateKey: "2026-08-23",
      },
      {
        index: 4,
        startDateKey: "2026-08-24",
        rangeStartDateKey: "2026-08-24",
        endDateKey: "2026-08-31",
      },
    ]);
    expect(getRecentMonthDateKeys("2026-08-24")).toEqual([
      "2026-08-01",
      "2026-07-01",
      "2026-06-01",
      "2026-05-01",
    ]);
  });
});
