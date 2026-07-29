import { describe, expect, it } from "vitest";
import { notificationDestination } from "../notificationDestination";

describe("notificationDestination", () => {
  it("ưu tiên deepLink nội bộ canonical từ API", () => {
    expect(
      notificationDestination({
        deepLink: "/trainer/coaching",
        targetType: "weekly_checkin",
      }),
    ).toBe("/trainer/coaching");
  });

  it.each(["https://example.com", "//example.com", "javascript:alert(1)"])(
    "không điều hướng tới deepLink không an toàn: %s",
    (deepLink) => {
      expect(
        notificationDestination({ deepLink, targetType: "weekly_checkin" }),
      ).toBe("/progress");
    },
  );

  it("fallback về Today cho notification không thuộc weekly check-in", () => {
    expect(notificationDestination({ targetType: "daily_journal" })).toBe(
      "/today",
    );
  });
});
