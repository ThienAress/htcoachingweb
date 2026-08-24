import { describe, expect, it, vi } from "vitest";

import {
  CHECKIN_PAGE_SIZE_STORAGE_KEY,
  readCheckinPageSize,
  saveCheckinPageSize,
} from "../checkinPageSize";

describe("checkin page-size preference", () => {
  it("đọc lựa chọn hợp lệ và fallback về 10", () => {
    expect(readCheckinPageSize({ getItem: () => "15" })).toBe(15);
    expect(readCheckinPageSize({ getItem: () => "25" })).toBe(10);
    expect(readCheckinPageSize({ getItem: () => { throw new Error("blocked"); } })).toBe(10);
  });

  it("chỉ lưu các lựa chọn 5, 10 hoặc 15", () => {
    const setItem = vi.fn();
    expect(saveCheckinPageSize(5, { setItem })).toBe(true);
    expect(setItem).toHaveBeenCalledWith(CHECKIN_PAGE_SIZE_STORAGE_KEY, "5");
    expect(saveCheckinPageSize(20, { setItem })).toBe(false);
    expect(setItem).toHaveBeenCalledTimes(1);
  });
});
