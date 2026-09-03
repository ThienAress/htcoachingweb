import { describe, expect, it } from "vitest";

import { assertIndexableDetailHtml } from "../verify-search-index-build.js";

const recipeRoute = "/cong-thuc-nau-an/mon-an-kiem-chung";
const exerciseRoute = "/exercises/64b000000000000000000000/bai-tap-kiem-chung";

const detailHtml = (route, jsonLd) => `<!doctype html>
<html lang="vi">
  <head>
    <title>Nội dung kiểm chứng | HTCOACHING</title>
    <meta name="description" content="${"M".repeat(150)}">
    <meta name="robots" content="index,follow">
    <link rel="canonical" href="https://htcoachingweb.io.vn${route}/">
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  </head>
  <body></body>
</html>`;

const structuredDataShapes = (type) => [
  ["object", { "@context": "https://schema.org", "@type": type }],
  [
    "top-level array",
    [
      { "@type": "BreadcrumbList" },
      { "@context": "https://schema.org", "@type": type },
    ],
  ],
  [
    "@graph",
    {
      "@context": "https://schema.org",
      "@graph": [{ "@type": "BreadcrumbList" }, { "@type": type }],
    },
  ],
];

describe("search index build structured-data verifier", () => {
  it.each([
    ...structuredDataShapes("Recipe").map(([shape, jsonLd]) => [
      `Recipe ${shape}`,
      recipeRoute,
      jsonLd,
    ]),
    ...structuredDataShapes("HowTo").map(([shape, jsonLd]) => [
      `HowTo ${shape}`,
      exerciseRoute,
      jsonLd,
    ]),
  ])("accepts %s JSON-LD", (_, route, jsonLd) => {
    expect(() => assertIndexableDetailHtml(route, detailHtml(route, jsonLd)))
      .not.toThrow();
  });

  it.each([
    ["Recipe", recipeRoute, { "@type": "BreadcrumbList" }],
    ["HowTo", exerciseRoute, { "@type": "Recipe" }],
  ])("rejects a detail page without @type %s", (_, route, jsonLd) => {
    expect(() =>
      assertIndexableDetailHtml(route, detailHtml(route, jsonLd)),
    ).toThrow(/rendered SEO contract failed/i);
  });
});
