import { describe, expect, it, vi } from "vitest";

import {
  canonicalUrlForRoute,
  mapWithConcurrency,
  routesFromSitemap,
} from "../prerender-routes.js";

describe("prerender route planning", () => {
  it("uses every same-origin URL from the generated sitemap", () => {
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>https://htcoachingweb.io.vn/</loc></url>
        <url><loc>https://htcoachingweb.io.vn/blog/bai-viet/</loc></url>
        <url><loc>https://htcoachingweb.io.vn/cong-thuc-nau-an/recipe-747/</loc></url>
      </urlset>`;

    expect(routesFromSitemap(sitemap, "https://htcoachingweb.io.vn")).toEqual([
      "/",
      "/blog/bai-viet",
      "/cong-thuc-nau-an/recipe-747",
    ]);
  });

  it("uses the Netlify trailing-slash URL as the prerender canonical", () => {
    expect(
      canonicalUrlForRoute("/blog/bai-viet", "https://htcoachingweb.io.vn"),
    ).toBe("https://htcoachingweb.io.vn/blog/bai-viet/");
  });

  it("rejects an empty sitemap or URLs outside the production origin", () => {
    expect(() =>
      routesFromSitemap("<urlset></urlset>", "https://htcoachingweb.io.vn"),
    ).toThrow(/does not contain any URLs/i);
    expect(() =>
      routesFromSitemap(
        "<urlset><url><loc>https://example.com/page</loc></url></urlset>",
        "https://htcoachingweb.io.vn",
      ),
    ).toThrow(/outside the site origin/i);
  });

  it("keeps prerender work within the configured concurrency", async () => {
    let active = 0;
    let maxActive = 0;
    const worker = vi.fn(async (route) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      active -= 1;
      return route.toUpperCase();
    });

    const results = await mapWithConcurrency(
      ["/one", "/two", "/three", "/four", "/five"],
      2,
      worker,
    );

    expect(results).toEqual(["/ONE", "/TWO", "/THREE", "/FOUR", "/FIVE"]);
    expect(maxActive).toBe(2);
  });
});
