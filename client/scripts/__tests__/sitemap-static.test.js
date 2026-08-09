import { describe, expect, test } from "vitest";

import { mergeMissingStaticRoutes } from "../sitemap-static.js";

const routeToXml = (route) =>
  `<url><loc>https://htcoachingweb.io.vn${route.url === "/" ? "/" : `${route.url}/`}</loc></url>`;

describe("sitemap static fallback", () => {
  test("keeps dynamic URLs and appends a missing static route once", () => {
    const existing =
      "<urlset>" +
      "<url><loc>https://htcoachingweb.io.vn/</loc></url>" +
      "<url><loc>https://htcoachingweb.io.vn/blog/dynamic-post</loc></url>" +
      "</urlset>";
    const staticRoutes = [{ url: "/" }, { url: "/quet-mon-an" }];

    const first = mergeMissingStaticRoutes({
      existing,
      staticRoutes,
      siteUrl: "https://htcoachingweb.io.vn",
      routeToXml,
    });
    const second = mergeMissingStaticRoutes({
      existing: first.content,
      staticRoutes,
      siteUrl: "https://htcoachingweb.io.vn",
      routeToXml,
    });

    expect(first.missingCount).toBe(1);
    expect(first.content).toContain("/blog/dynamic-post/");
    expect(first.content).toContain("/quet-mon-an/");
    expect(second.missingCount).toBe(0);
    expect(second.content.match(/\/quet-mon-an/g)).toHaveLength(1);
  });
});
