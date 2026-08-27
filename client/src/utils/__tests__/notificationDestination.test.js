import { describe, expect, it } from "vitest";
import { notificationDestination } from "../notificationDestination";

describe("notificationDestination", () => {
  it("nâng deepLink báo cáo cũ sang tab Theo dõi và hỗ trợ", () => {
    expect(
      notificationDestination({
        deepLink:
          "/trainer/clients/client-123?date=2026-08-23#journal",
        targetType: "weekly_checkin",
      }),
    ).toBe(
      "/trainer/clients/client-123?tab=tasks&date=2026-08-23#journal",
    );
  });

  it("giữ báo cáo tuần ở tab Tổng quan", () => {
    expect(
      notificationDestination({
        deepLink:
          "/trainer/clients/client-123?date=2026-08-18#weekly-report",
      }),
    ).toBe(
      "/trainer/clients/client-123?date=2026-08-18#weekly-report",
    );
  });

  it.each([
    "https://example.com",
    "//example.com",
    "/\\example.com",
    "javascript:alert(1)",
    "/trainer/clients/client-123\nmalicious",
  ])(
    "không điều hướng tới deepLink không an toàn: %s",
    (deepLink) => {
      expect(
        notificationDestination({ deepLink, targetType: "weekly_checkin" }),
      ).toBe("/dashboard/progress");
    },
  );

  it("fallback về bảng điều khiển cho thông báo không thuộc báo cáo tuần", () => {
    expect(notificationDestination({ targetType: "daily_journal" })).toBe(
      "/dashboard",
    );
  });
});
