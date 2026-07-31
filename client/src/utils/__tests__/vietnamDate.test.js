import { describe, expect, it } from "vitest";
import {
  addDaysToDateKey,
  getAppDayOfWeek,
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
});
