import { describe, expect, it } from "vitest";

import {
  buildSitemapIndex,
  buildUrlSet,
  extractSitemapRoutes,
} from "../sitemap-files.js";

describe("split sitemap files", () => {
  it("builds an index and keeps child URL sets separate", () => {
    const siteUrl = "https://htcoachingweb.io.vn";
    const child = buildUrlSet({
      routes: [
        {
          url: "/blog/bai-viet",
          lastmod: "2026-08-10",
          changefreq: "monthly",
          priority: 0.7,
        },
      ],
      siteUrl,
      normalizePath: (value) => value + "/",
    });
    const index = buildSitemapIndex({
      fileNames: ["sitemap-core.xml", "sitemap-content.xml"],
      siteUrl,
      lastmod: "2026-08-10",
    });

    expect(index).toContain("<sitemapindex");
    expect(index).not.toContain("/blog/bai-viet/");
    expect(extractSitemapRoutes(child, siteUrl)).toEqual(["/blog/bai-viet"]);
  });
});
