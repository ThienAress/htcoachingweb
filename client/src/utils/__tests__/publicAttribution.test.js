import { describe, expect, it, vi } from "vitest";

import {
  buildPublicAttribution,
  getPublicAttribution,
} from "../publicAttribution";

const createStorage = () => {
  const values = new Map();
  return {
    getItem: vi.fn((key) => values.get(key) ?? null),
    setItem: vi.fn((key, value) => values.set(key, value)),
  };
};

describe("public attribution contract", () => {
  it("chỉ giữ hostname, canonical path và bounded campaign fields", () => {
    const attribution = buildPublicAttribution({
      href: "https://htcoachingweb.io.vn/blog/cach-tinh-macro/?utm_source=Google&utm_medium=Organic&utm_campaign=Macro%20Launch#result",
      referrer: "https://www.google.com/search?q=private-keyword",
      capturedAt: "2026-08-05T10:00:00.000Z",
      contentType: "blog",
      contentSlug: "cach-tinh-macro",
    });

    expect(attribution).toEqual({
      source: "google",
      medium: "organic",
      campaign: "Macro Launch",
      referrerHost: "www.google.com",
      landingPath: "/blog/cach-tinh-macro/",
      contentType: "blog",
      contentSlug: "cach-tinh-macro",
      capturedAt: "2026-08-05T10:00:00.000Z",
    });
    expect(JSON.stringify(attribution)).not.toContain("private-keyword");
  });

  it("giữ first-touch source nhưng cập nhật blog context an toàn", () => {
    const storage = createStorage();
    const browser = {
      location: { href: "https://htcoachingweb.io.vn/?utm_source=newsletter" },
      sessionStorage: storage,
    };
    const documentObject = { referrer: "" };

    const first = getPublicAttribution({
      browser,
      documentObject,
      capturedAt: "2026-08-05T10:00:00.000Z",
    });
    browser.location.href = "https://htcoachingweb.io.vn/blog/flexible-dieting/?secret=1";
    const fromBlog = getPublicAttribution({
      browser,
      documentObject,
      contentType: "blog",
      contentSlug: "flexible-dieting",
    });

    expect(first.source).toBe("newsletter");
    expect(fromBlog).toMatchObject({
      source: "newsletter",
      landingPath: "/",
      contentType: "blog",
      contentSlug: "flexible-dieting",
    });
  });

  it("fail-safe khi sessionStorage bị chặn", () => {
    const unavailableStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };

    const attribution = getPublicAttribution({
      browser: {
        location: { href: "https://htcoachingweb.io.vn/contact?utm_source=Direct" },
        sessionStorage: unavailableStorage,
      },
      documentObject: { referrer: "" },
      capturedAt: "2026-08-05T10:00:00.000Z",
    });

    expect(attribution).toMatchObject({ source: "direct", landingPath: "/contact" });
  });

  it("không coi điều hướng cùng origin là referral source", () => {
    const attribution = buildPublicAttribution({
      href: "https://htcoachingweb.io.vn/register",
      referrer: "https://htcoachingweb.io.vn/#pricing?private=value",
      capturedAt: "2026-08-05T10:00:00.000Z",
    });

    expect(attribution).toMatchObject({
      source: "direct",
      medium: "none",
      referrerHost: "",
      landingPath: "/register",
    });
  });

  it("bỏ UTM có hình dạng PII thay vì biến đổi rồi lưu", () => {
    const attribution = buildPublicAttribution({
      href: "https://htcoachingweb.io.vn/?utm_source=private%40example.com&utm_campaign=private%40example.com",
      referrer: "",
      capturedAt: "2026-08-05T10:00:00.000Z",
    });

    expect(attribution).toMatchObject({
      source: "direct",
      medium: "none",
      campaign: "",
    });
    expect(JSON.stringify(attribution)).not.toContain("private");
  });

  it("bỏ stored attribution đã bị sửa thành raw URL", () => {
    const storage = createStorage();
    storage.setItem(
      "ht_public_attribution_v1",
      JSON.stringify({
        source: "google",
        medium: "organic",
        campaign: "",
        referrerHost: "google.com/search?email=private@example.com",
        landingPath: "//evil.example/path",
        contentType: "page",
        contentSlug: "",
        capturedAt: "2026-08-05T10:00:00.000Z",
      }),
    );

    const attribution = getPublicAttribution({
      browser: {
        location: { href: "https://htcoachingweb.io.vn/contact" },
        sessionStorage: storage,
      },
      documentObject: { referrer: "" },
      capturedAt: "2026-08-05T11:00:00.000Z",
    });

    expect(attribution).toMatchObject({
      source: "direct",
      referrerHost: "",
      landingPath: "/contact",
    });
  });
});
