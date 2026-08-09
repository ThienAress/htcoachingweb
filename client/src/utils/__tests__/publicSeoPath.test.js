import { describe, expect, test } from "vitest";

import {
  buildPublicPageHref,
  normalizePublicPath,
} from "../publicSeoPath.js";

describe("public SEO paths", () => {
  test("normalizes public canonical paths to one trailing slash", () => {
    expect(normalizePublicPath("/blog?sort=latest#top")).toBe("/blog/");
  });

  test("keeps the homepage canonical at the root", () => {
    expect(normalizePublicPath("/")).toBe("/");
  });

  test("builds crawlable recipe pagination hrefs without losing filters", () => {
    const params = new URLSearchParams("area=Vietnamese&page=3");

    expect(buildPublicPageHref("/cong-thuc-nau-an", params, 2)).toBe(
      "/cong-thuc-nau-an/?area=Vietnamese&page=2",
    );
    expect(buildPublicPageHref("/cong-thuc-nau-an", params, 1)).toBe(
      "/cong-thuc-nau-an/?area=Vietnamese",
    );
  });
});
