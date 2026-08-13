import { describe, expect, it, vi } from "vitest";
import {
  CUSTOMER_DASHBOARD_THEME_STORAGE_KEY,
  persistCustomerDashboardTheme,
  resolveInitialCustomerDashboardTheme,
} from "../customerDashboardTheme.js";

const createStorage = (entries = {}) => {
  const values = new Map(Object.entries(entries));
  return {
    getItem: vi.fn((key) => values.get(key) ?? null),
    setItem: vi.fn((key, value) => values.set(key, value)),
  };
};

describe("customer dashboard theme", () => {
  it("mặc định dùng giao diện sáng", () => {
    const storage = createStorage();

    expect(resolveInitialCustomerDashboardTheme(storage)).toBe("light");
  });

  it("giữ lựa chọn hợp lệ và không lưu theme không hỗ trợ", () => {
    const storage = createStorage({
      [CUSTOMER_DASHBOARD_THEME_STORAGE_KEY]: "dark",
    });

    expect(resolveInitialCustomerDashboardTheme(storage)).toBe("dark");
    persistCustomerDashboardTheme("light", storage);
    persistCustomerDashboardTheme("sepia", storage);

    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(storage.setItem).toHaveBeenCalledWith(
      CUSTOMER_DASHBOARD_THEME_STORAGE_KEY,
      "light",
    );
  });

  it("trở về giao diện sáng khi storage không khả dụng", () => {
    const storage = {
      getItem: vi.fn(() => {
        throw new Error("storage unavailable");
      }),
    };

    expect(resolveInitialCustomerDashboardTheme(storage)).toBe("light");
  });
});
