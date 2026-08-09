import { describe, expect, it, vi } from "vitest";

import {
  trackAnalyticsEvent,
  trackAnalyticsEventOnce,
} from "../analytics";

const createStorage = () => {
  const values = new Map();
  return {
    getItem: vi.fn((key) => values.get(key) ?? null),
    setItem: vi.fn((key, value) => values.set(key, value)),
  };
};

describe("analytics event contract", () => {
  it("no-op khi gtag không khả dụng", () => {
    expect(
      trackAnalyticsEvent("generate_lead", { lead_type: "contact" }, { gtag: null }),
    ).toBe(false);
  });

  it("chỉ gửi event và params thuộc allowlist", () => {
    const gtag = vi.fn();

    const tracked = trackAnalyticsEvent(
      "generate_lead",
      {
        lead_type: "contact",
        email: "private@example.com",
        phone: "0900000000",
        arbitrary: "blocked",
      },
      { gtag },
    );

    expect(tracked).toBe(true);
    expect(gtag).toHaveBeenCalledWith("event", "generate_lead", {
      lead_type: "contact",
    });
  });

  it("từ chối event không được khai báo", () => {
    const gtag = vi.fn();

    expect(trackAnalyticsEvent("page_payload", { value: "x" }, { gtag })).toBe(false);
    expect(gtag).not.toHaveBeenCalled();
  });

  it("không gửi event khi required params không hợp lệ", () => {
    const gtag = vi.fn();

    expect(
      trackAnalyticsEvent(
        "generate_lead",
        { lead_type: "private@example.com" },
        { gtag },
      ),
    ).toBe(false);
    expect(gtag).not.toHaveBeenCalled();
  });

  it("dedupe cùng một success event trong browser session", () => {
    const gtag = vi.fn();
    const storage = createStorage();
    const options = { gtag, storage };

    expect(
      trackAnalyticsEventOnce(
        "generate_lead",
        "booking:11111111-1111-4111-8111-111111111111",
        { lead_type: "booking" },
        options,
      ),
    ).toBe(true);
    expect(
      trackAnalyticsEventOnce(
        "generate_lead",
        "booking:11111111-1111-4111-8111-111111111111",
        { lead_type: "booking" },
        options,
      ),
    ).toBe(false);
    expect(gtag).toHaveBeenCalledTimes(1);
  });
});
