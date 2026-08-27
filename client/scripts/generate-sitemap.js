import fs from "fs";
import path from "path";
import axios from "axios";
import { fileURLToPath } from "url";

import {
  fetchDynamicRouteContent,
  normalizeDynamicRouteApiUrl,
  resolveDynamicRoutePolicy,
} from "./dynamic-routes.js";
import { selectRecipesForSeo } from "./recipe-seo-selection.js";
import {
  buildSitemapIndex,
  buildUrlSet,
  extractSitemapRoutes,
} from "./sitemap-files.js";
import { normalizePublicPath } from "../src/utils/publicSeoPath.js";
import { slugifyExerciseName } from "../src/pages/ExercisesPage/exerciseDetailPath.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SITE_URL = "https://htcoachingweb.io.vn";
const today = new Date().toISOString().split("T")[0];
const publicDir = path.resolve(__dirname, "../public");
const generatedDir = path.resolve(__dirname, ".generated");

const staticRoutes = [
  { url: "/", priority: 1.0, changefreq: "weekly", lastmod: today },
  { url: "/ket-qua-khach-hang", priority: 0.9, changefreq: "weekly", lastmod: today },
  { url: "/blog", priority: 0.9, changefreq: "weekly", lastmod: today },
  { url: "/cong-thuc-nau-an", priority: 0.8, changefreq: "weekly", lastmod: today },
  { url: "/club", priority: 0.8, changefreq: "monthly", lastmod: today },
  { url: "/exercises", priority: 0.8, changefreq: "monthly", lastmod: today },
  { url: "/tdee-calculator", priority: 0.7, changefreq: "yearly", lastmod: today },
  { url: "/quet-mon-an", priority: 0.8, changefreq: "monthly", lastmod: today },
  { url: "/mealplan", priority: 0.7, changefreq: "yearly", lastmod: today },
];

const validSlug = (value) => {
  const slug = String(value || "").trim();
  return /^[a-z0-9][a-z0-9-]{0,159}$/i.test(slug) ? slug : null;
};

const lastModified = (value) => {
  if (!value) return today;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? today : date.toISOString().split("T")[0];
};

const toRoutes = (items, prefix, priority) =>
  items.flatMap((item) => {
    const slug = validSlug(item?.slug);
    return slug
      ? [{
          url: prefix + slug,
          priority,
          changefreq: "monthly",
          lastmod: lastModified(item?.updatedAt),
        }]
      : [];
  });

const toExerciseRoutes = (items) =>
  items.flatMap((item) => {
    const id = String(item?._id || "").trim();
    if (!/^[a-f0-9]{24}$/i.test(id)) return [];
    return [
      {
        url: `/exercises/${id}/${slugifyExerciseName(item?.name)}`,
        priority: 0.6,
        changefreq: "monthly",
        lastmod: lastModified(item?.updatedAt),
      },
    ];
  });

const uniqueRoutes = (routes) => [
  ...new Map(routes.map((route) => [route.url, route])).values(),
];

const routeFromPath = (url) => ({
  url,
  priority: url.startsWith("/cong-thuc-nau-an/") ? 0.6 : 0.7,
  changefreq: "monthly",
  lastmod: today,
});

const readExistingRoutes = () => {
  const indexPath = path.join(publicDir, "sitemap.xml");
  if (!fs.existsSync(indexPath)) return [];
  const index = fs.readFileSync(indexPath, "utf8");
  if (!/<sitemapindex/i.test(index)) {
    return extractSitemapRoutes(index, SITE_URL);
  }
  return ["sitemap-core.xml", "sitemap-content.xml", "sitemap-recipes.xml"]
    .flatMap((fileName) => {
      const filePath = path.join(publicDir, fileName);
      return fs.existsSync(filePath)
        ? extractSitemapRoutes(fs.readFileSync(filePath, "utf8"), SITE_URL)
        : [];
    });
};

const writeOutputs = ({ coreRoutes, contentRoutes, recipeRoutes, prerenderRoutes }) => {
  fs.mkdirSync(publicDir, { recursive: true });
  fs.mkdirSync(generatedDir, { recursive: true });
  const groups = [
    ["sitemap-core.xml", coreRoutes],
    ["sitemap-content.xml", contentRoutes],
    ["sitemap-recipes.xml", recipeRoutes],
  ];
  groups.forEach(([fileName, routes]) => {
    fs.writeFileSync(
      path.join(publicDir, fileName),
      buildUrlSet({ routes, siteUrl: SITE_URL, normalizePath: normalizePublicPath }),
      "utf8",
    );
  });
  fs.writeFileSync(
    path.join(publicDir, "sitemap.xml"),
    buildSitemapIndex({
      fileNames: groups.map(([fileName]) => fileName),
      siteUrl: SITE_URL,
      lastmod: today,
    }),
    "utf8",
  );
  fs.writeFileSync(
    path.join(generatedDir, "prerender-routes.json"),
    JSON.stringify(uniqueRoutes(prerenderRoutes).map((route) => route.url), null, 2) + "\n",
    "utf8",
  );
};

const generateSitemap = async () => {
  const policy = resolveDynamicRoutePolicy();
  const apiUrl = normalizeDynamicRouteApiUrl(
    process.env.SITEMAP_API_URL || process.env.VITE_API_URL || "https://api.htcoachingweb.io.vn/api",
    policy,
  );
  const { content, failures } = await fetchDynamicRouteContent({
    fetchApi: (pathName) => axios.get(apiUrl + pathName, {
      timeout: policy.requireDynamic ? 30_000 : 10_000,
    }),
    policy,
    fetchAllPages: true,
  });

  if (failures.length > 0 && !policy.skip) {
    const existing = readExistingRoutes();
    if (existing.length <= staticRoutes.length) {
      throw new Error("Dynamic sitemap sources failed and no safe existing sitemap is available");
    }
    const recipePaths = existing.filter((url) => url.startsWith("/cong-thuc-nau-an/"));
    const contentPaths = existing.filter(
      (url) =>
        !recipePaths.includes(url) &&
        !staticRoutes.some((route) => route.url === url),
    );
    writeOutputs({
      coreRoutes: staticRoutes,
      contentRoutes: contentPaths.map(routeFromPath),
      recipeRoutes: recipePaths.slice(0, 30).map(routeFromPath),
      prerenderRoutes: [...staticRoutes, ...existing.map(routeFromPath)],
    });
    console.warn("Preserved existing dynamic routes after non-strict source failure.");
    return;
  }

  const storyRoutes = toRoutes(content.stories, "/ket-qua-khach-hang/", 0.8);
  const trainerRoutes = toRoutes(content.trainers, "/huan-luyen-vien/", 0.8);
  const blogRoutes = toRoutes(content.blogs, "/blog/", 0.7);
  const exerciseRoutes = toExerciseRoutes(content.exercises);
  const allRecipeRoutes = toRoutes(content.recipes, "/cong-thuc-nau-an/", 0.6);
  const selectedRecipes = selectRecipesForSeo(content.recipes, {
    limit: 30,
    minimum: 20,
    strict: policy.netlifyProduction,
  });
  const recipeRoutes = toRoutes(selectedRecipes, "/cong-thuc-nau-an/", 0.7);
  const contentRoutes = [
    ...storyRoutes,
    ...trainerRoutes,
    ...blogRoutes,
    ...exerciseRoutes,
  ];
  writeOutputs({
    coreRoutes: staticRoutes,
    contentRoutes,
    recipeRoutes,
    prerenderRoutes: [...staticRoutes, ...contentRoutes, ...allRecipeRoutes],
  });
  console.log(
    `Sitemap index generated with ${staticRoutes.length + contentRoutes.length + recipeRoutes.length} submitted URLs; ${allRecipeRoutes.length} recipe pages remain prerendered.`,
  );
};

generateSitemap().catch((error) => {
  console.error("Error generating sitemap:", error.message);
  process.exitCode = 1;
});
