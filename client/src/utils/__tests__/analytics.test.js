import { describe, expect, it, vi } from "vitest";

import {
  initializeAnalytics,
  trackAnalyticsEvent,
  trackAnalyticsEventOnce,
  trackAnalyticsPageView,
} from "../analytics";

const createStorage = () => {
  const values = new Map();
  return {
    getItem: vi.fn((key) => values.get(key) ?? null),
    setItem: vi.fn((key, value) => values.set(key, value)),
  };
};

describe("analytics event contract", () => {
  it("chỉ bootstrap GA4 trên production hostname canonical", () => {
    const appendChild = vi.fn();
    const documentRef = {
      createElement: vi.fn(() => ({ dataset: {} })),
      head: { appendChild },
    };
    const stagingWindow = { location: { hostname: "staging--htcoachingweb.netlify.app" } };
    const productionWindow = { location: { hostname: "htcoachingweb.io.vn" } };

    expect(
      initializeAnalytics({
        measurementId: "G-S7JEFVLP6G",
        allowedHostname: "htcoachingweb.io.vn",
        isProduction: true,
        windowRef: stagingWindow,
        documentRef,
      }),
    ).toBe(false);
    expect(stagingWindow.gtag).toBeUndefined();

    expect(
      initializeAnalytics({
        measurementId: "G-S7JEFVLP6G",
        allowedHostname: "htcoachingweb.io.vn",
        isProduction: true,
        windowRef: productionWindow,
        documentRef,
      }),
    ).toBe(true);
    expect(appendChild).toHaveBeenCalledTimes(1);
    expect([...productionWindow.dataLayer[1]]).toEqual([
      "config",
      "G-S7JEFVLP6G",
      { send_page_view: false },
    ]);
  });

  it("không bootstrap GA4 trong local build dù hostname được giả lập", () => {
    const windowRef = { location: { hostname: "htcoachingweb.io.vn" } };
    expect(
      initializeAnalytics({
        measurementId: "G-S7JEFVLP6G",
        isProduction: false,
        windowRef,
        documentRef: { createElement: vi.fn(), head: { appendChild: vi.fn() } },
      }),
    ).toBe(false);
    expect(windowRef.gtag).toBeUndefined();
  });

  it("chỉ gửi SPA page view với path đã làm sạch", () => {
    const gtag = vi.fn();
    expect(
      trackAnalyticsPageView("/blog/cach-tinh-macro/", {
        gtag,
        measurementId: "G-S7JEFVLP6G",
      }),
    ).toBe(true);
    expect(gtag).toHaveBeenCalledWith("event", "page_view", {
      page_path: "/blog/cach-tinh-macro/",
    });
    expect(
      trackAnalyticsPageView("/blog?email=private@example.com", {
        gtag,
        measurementId: "G-S7JEFVLP6G",
      }),
    ).toBe(false);
  });

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
