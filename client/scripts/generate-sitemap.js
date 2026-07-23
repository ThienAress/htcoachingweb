import fs from "fs";
import path from "path";
import axios from "axios";
import { fileURLToPath } from "url";

import {
  fetchDynamicRouteContent,
  normalizeDynamicRouteApiUrl,
  resolveDynamicRoutePolicy,
} from "./dynamic-routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SITE_URL = "https://htcoachingweb.io.vn";
const today = new Date().toISOString().split("T")[0];

const staticRoutes = [
  { url: "/", priority: 1.0, changefreq: "weekly", lastmod: today },
  {
    url: "/ket-qua-khach-hang",
    priority: 0.9,
    changefreq: "weekly",
    lastmod: today,
  },
  { url: "/blog", priority: 0.9, changefreq: "weekly", lastmod: today },
  {
    url: "/cong-thuc-nau-an",
    priority: 0.8,
    changefreq: "weekly",
    lastmod: today,
  },
  { url: "/club", priority: 0.8, changefreq: "monthly", lastmod: today },
  {
    url: "/exercises",
    priority: 0.8,
    changefreq: "monthly",
    lastmod: today,
  },
  {
    url: "/tdee-calculator",
    priority: 0.7,
    changefreq: "yearly",
    lastmod: today,
  },
  {
    url: "/mealplan",
    priority: 0.7,
    changefreq: "yearly",
    lastmod: today,
  },
];

const validSlug = (value) => {
  const slug = String(value || "").trim();
  return /^[a-z0-9][a-z0-9-]{0,159}$/i.test(slug) ? slug : null;
};

const lastModified = (value) => {
  if (!value) return today;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? today
    : date.toISOString().split("T")[0];
};

const xmlEscape = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const toRoutes = (items, prefix, priority) =>
  items.flatMap((item) => {
    const slug = validSlug(item?.slug);
    return slug
      ? [
          {
            url: prefix + slug,
            priority,
            changefreq: "monthly",
            lastmod: lastModified(item?.updatedAt),
          },
        ]
      : [];
  });

const preserveExistingSitemap = (sitemapPath, failureCount) => {
  if (!fs.existsSync(sitemapPath)) return false;
  const existing = fs.readFileSync(sitemapPath, "utf8");
  const existingRouteCount = (existing.match(/<loc>/g) || []).length;
  if (existingRouteCount <= staticRoutes.length) return false;
  console.warn(
    "Preserving existing sitemap with " +
      existingRouteCount +
      " routes because " +
      failureCount +
      " dynamic source(s) failed.",
  );
  return true;
};

const generateSitemap = async () => {
  const policy = resolveDynamicRoutePolicy();
  const apiUrl = normalizeDynamicRouteApiUrl(
    process.env.SITEMAP_API_URL ||
      process.env.VITE_API_URL ||
      "https://htcoachingweb.onrender.com/api",
    policy,
  );
  const fetchApi = (pathName) =>
    axios.get(apiUrl + pathName, {
      timeout: policy.requireDynamic ? 30_000 : 10_000,
    });

  console.log(
    "Generating sitemap in " +
      (policy.requireDynamic ? "strict" : policy.skip ? "static" : "fallback") +
      " mode...",
  );
  const { content, failures } = await fetchDynamicRouteContent({
    fetchApi,
    policy,
  });

  const dynamicRoutes = [
    ...toRoutes(content.stories, "/ket-qua-khach-hang/", 0.8),
    ...toRoutes(content.trainers, "/huan-luyen-vien/", 0.8),
    ...toRoutes(content.blogs, "/blog/", 0.7),
    ...toRoutes(content.recipes, "/cong-thuc-nau-an/", 0.7),
  ];
  const publicDir = path.resolve(__dirname, "../public");
  const sitemapPath = path.join(publicDir, "sitemap.xml");

  if (
    failures.length > 0 &&
    !policy.skip &&
    preserveExistingSitemap(sitemapPath, failures.length)
  ) {
    return;
  }

  const uniqueRoutes = [
    ...new Map(
      [...staticRoutes, ...dynamicRoutes].map((route) => [route.url, route]),
    ).values(),
  ];
  const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${uniqueRoutes
  .map(
    (route) => `  <url>
    <loc>${xmlEscape(SITE_URL + route.url)}</loc>
    <lastmod>${route.lastmod}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>
`;

  fs.mkdirSync(publicDir, { recursive: true });
  fs.writeFileSync(sitemapPath, sitemapContent, "utf8");
  console.log(
    "Sitemap generated with " +
      uniqueRoutes.length +
      " routes at " +
      sitemapPath,
  );
};

generateSitemap().catch((error) => {
  console.error("Error generating sitemap:", error.message);
  process.exitCode = 1;
});
