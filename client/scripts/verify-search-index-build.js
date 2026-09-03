import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  SEARCH_INDEX_EXERCISES,
  SEARCH_INDEX_RECIPE_SLUGS,
} from "../src/seo/searchIndexCohort.js";
import { slugifyExerciseName } from "../src/pages/ExercisesPage/exerciseDetailPath.js";
import {
  SEO_DESCRIPTION_MAX_LENGTH,
  SEO_DESCRIPTION_MIN_LENGTH,
} from "../src/seo/seoDescription.js";
import { extractSitemapRoutes } from "./sitemap-files.js";
import { resolveDynamicRoutePolicy } from "./dynamic-routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIR = path.resolve(__dirname, "..");
const DIST_DIR = path.join(CLIENT_DIR, "dist");
const PUBLIC_DIR = path.join(CLIENT_DIR, "public");
const SITE_URL = "https://htcoachingweb.io.vn";

const recipeRoutes = SEARCH_INDEX_RECIPE_SLUGS.map(
  (slug) => `/cong-thuc-nau-an/${slug}`,
);
const exerciseRoutes = SEARCH_INDEX_EXERCISES.map(
  ({ id, name }) => `/exercises/${id}/${slugifyExerciseName(name)}`,
);
const detailRoutes = [...recipeRoutes, ...exerciseRoutes];

const routeFile = (route) =>
  path.join(DIST_DIR, ...route.split("/").filter(Boolean), "index.html");

const readRequired = (filePath) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Required build artifact is missing: ${filePath}`);
  }
  return fs.readFileSync(filePath, "utf8");
};

const attribute = (tag, name) =>
  tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, "i"))?.[1] || "";

const tagsNamed = (html, tagName) =>
  html.match(new RegExp(`<${tagName}\\b[^>]*>`, "gi")) || [];

const assertExactRoutes = (label, received, expected) => {
  const receivedSet = new Set(received);
  const expectedSet = new Set(expected);
  const missing = expected.filter((route) => !receivedSet.has(route));
  const unexpected = received.filter((route) => !expectedSet.has(route));
  if (
    received.length !== expected.length ||
    receivedSet.size !== received.length ||
    missing.length > 0 ||
    unexpected.length > 0
  ) {
    throw new Error(
      `${label} does not match the approved cohort; missing=${missing.join(",") || "none"}; unexpected=${unexpected.join(",") || "none"}`,
    );
  }
};

const jsonLdDocuments = (html) => {
  const documents = [];
  const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(scriptPattern)) {
    if (attribute(match[1], "type").toLowerCase() !== "application/ld+json") {
      continue;
    }
    documents.push(JSON.parse(match[2]));
  }
  return documents;
};

const jsonLdNodes = (value) => {
  if (Array.isArray(value)) return value.flatMap(jsonLdNodes);
  if (!value || typeof value !== "object") return [];
  return [value, ...jsonLdNodes(value["@graph"])];
};

const hasJsonLdType = (html, expectedType) =>
  jsonLdDocuments(html)
    .flatMap(jsonLdNodes)
    .some((node) => {
      const types = Array.isArray(node["@type"])
        ? node["@type"]
        : [node["@type"]];
      return types.includes(expectedType);
    });

const expectedDetailType = (route) => {
  if (route.startsWith("/cong-thuc-nau-an/")) return "Recipe";
  if (route.startsWith("/exercises/")) return "HowTo";
  return null;
};

export const assertIndexableDetailHtml = (route, html) => {
  const titles = html.match(/<title\b[^>]*>[\s\S]*?<\/title>/gi) || [];
  const descriptions = tagsNamed(html, "meta").filter(
    (tag) => attribute(tag, "name") === "description",
  );
  const robots = tagsNamed(html, "meta").filter(
    (tag) => attribute(tag, "name") === "robots",
  );
  const canonicals = tagsNamed(html, "link").filter(
    (tag) => attribute(tag, "rel") === "canonical",
  );
  const expectedCanonical = `${SITE_URL}${route}/`;
  const descriptionLength = descriptions.length === 1
    ? attribute(descriptions[0], "content").length
    : 0;
  const expectedStructuredDataType = expectedDetailType(route);
  const hasExpectedStructuredData =
    expectedStructuredDataType &&
    hasJsonLdType(html, expectedStructuredDataType);

  if (
    titles.length !== 1 ||
    descriptions.length !== 1 ||
    descriptionLength < SEO_DESCRIPTION_MIN_LENGTH ||
    descriptionLength > SEO_DESCRIPTION_MAX_LENGTH ||
    robots.length !== 1 ||
    attribute(robots[0], "content") !== "index,follow" ||
    canonicals.length !== 1 ||
    attribute(canonicals[0], "href") !== expectedCanonical ||
    !hasExpectedStructuredData
  ) {
    throw new Error(`Rendered SEO contract failed for ${route}`);
  }
};

const listRenderedRecipeRoutes = () => {
  const root = path.join(DIST_DIR, "cong-thuc-nau-an");
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) =>
      fs.existsSync(path.join(root, entry.name, "index.html"))
        ? [`/cong-thuc-nau-an/${entry.name}`]
        : [],
    );
};

const listRenderedExerciseRoutes = () => {
  const root = path.join(DIST_DIR, "exercises");
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((idEntry) => {
      const idRoot = path.join(root, idEntry.name);
      return fs
        .readdirSync(idRoot, { withFileTypes: true })
        .filter(
          (slugEntry) =>
            slugEntry.isDirectory() &&
            fs.existsSync(path.join(idRoot, slugEntry.name, "index.html")),
        )
        .map((slugEntry) => `/exercises/${idEntry.name}/${slugEntry.name}`);
    });
};

const verifyFallbackShell = () => {
  const fallbackShell = readRequired(
    path.join(DIST_DIR, "dynamic-detail-shell.html"),
  );
  const fallbackRobots = tagsNamed(fallbackShell, "meta").filter(
    (tag) => attribute(tag, "name") === "robots",
  );
  const fallbackCanonicals = tagsNamed(fallbackShell, "link").filter(
    (tag) => attribute(tag, "rel") === "canonical",
  );
  const fallbackOpenGraphUrls = tagsNamed(fallbackShell, "meta").filter(
    (tag) => attribute(tag, "property") === "og:url",
  );
  const fallbackJsonLdCount = (
    fallbackShell.match(
      /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>/gi,
    ) || []
  ).length;
  if (
    fallbackRobots.length !== 1 ||
    attribute(fallbackRobots[0], "content") !== "noindex,follow" ||
    fallbackCanonicals.length !== 0 ||
    fallbackOpenGraphUrls.length !== 0 ||
    fallbackJsonLdCount !== 0
  ) {
    throw new Error("Dynamic detail fallback shell is not fail-closed");
  }
};

const verifySearchIndexBuild = () => {
  const policy = resolveDynamicRoutePolicy();
  const manifest = JSON.parse(
    readRequired(path.join(__dirname, ".generated", "prerender-routes.json")),
  );
  const manifestDetails = manifest.filter(
    (route) =>
      route.startsWith("/cong-thuc-nau-an/") ||
      route.startsWith("/exercises/"),
  );
  const recipeSitemap = extractSitemapRoutes(
    readRequired(path.join(PUBLIC_DIR, "sitemap-recipes.xml")),
    SITE_URL,
  );
  const exerciseSitemap = extractSitemapRoutes(
    readRequired(path.join(PUBLIC_DIR, "sitemap-content.xml")),
    SITE_URL,
  ).filter((route) => route.startsWith("/exercises/"));

  if (policy.skip) {
    assertExactRoutes("Static prerender manifest details", manifestDetails, []);
    assertExactRoutes("Static Recipe sitemap", recipeSitemap, []);
    assertExactRoutes("Static Exercise sitemap", exerciseSitemap, []);
    assertExactRoutes("Static rendered Recipe details", listRenderedRecipeRoutes(), []);
    assertExactRoutes("Static rendered Exercise details", listRenderedExerciseRoutes(), []);
    verifyFallbackShell();
    console.warn(
      "Static-only search build verified; this artifact is not valid for production deployment.",
    );
    return;
  }

  assertExactRoutes("Prerender manifest details", manifestDetails, detailRoutes);

  assertExactRoutes("Recipe sitemap", recipeSitemap, recipeRoutes);

  assertExactRoutes("Exercise sitemap", exerciseSitemap, exerciseRoutes);

  assertExactRoutes(
    "Rendered Recipe details",
    listRenderedRecipeRoutes(),
    recipeRoutes,
  );
  assertExactRoutes(
    "Rendered Exercise details",
    listRenderedExerciseRoutes(),
    exerciseRoutes,
  );

  detailRoutes.forEach((route) =>
    assertIndexableDetailHtml(route, readRequired(routeFile(route))),
  );

  const recipeHub = readRequired(path.join(DIST_DIR, "cong-thuc-nau-an", "index.html"));
  const exerciseHub = readRequired(path.join(DIST_DIR, "exercises", "index.html"));
  assertExactRoutes(
    "Recipe hub links",
    recipeRoutes.filter((route) => recipeHub.includes(`href="${route}/"`)),
    recipeRoutes,
  );
  assertExactRoutes(
    "Exercise hub links",
    exerciseRoutes.filter((route) => exerciseHub.includes(`href="${route}/"`)),
    exerciseRoutes,
  );

  verifyFallbackShell();

  console.log(
    `Search index build verified: ${recipeRoutes.length} Recipe + ${exerciseRoutes.length} Exercise details.`,
  );
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifySearchIndexBuild();
}
