import puppeteer from "puppeteer";
import express from "express";
import fs from "fs";
import path from "path";
import axios from "axios";
import { fileURLToPath } from "url";

import {
  fetchDynamicRouteContent,
  normalizeDynamicRouteApiUrl,
  resolveDynamicRoutePolicy,
} from "./dynamic-routes.js";
import { validatePrerenderSnapshot } from "./prerender-validation.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = 5174;
const DIST_DIR = path.resolve(__dirname, "../dist");
const SITE_URL = "https://htcoachingweb.io.vn";
const staticRoutes = [
  "/",
  "/ket-qua-khach-hang",
  "/blog",
  "/cong-thuc-nau-an",
  "/club",
  "/exercises",
  "/tdee-calculator",
  "/mealplan",
];

const validSlug = (value) => {
  const slug = String(value || "").trim();
  return /^[a-z0-9][a-z0-9-]{0,159}$/i.test(slug) ? slug : null;
};

const routesFor = (items, prefix) =>
  items.flatMap((item) => {
    const slug = validSlug(item?.slug);
    return slug ? [prefix + slug] : [];
  });

const discoverDynamicRoutes = async (policy, apiUrl) => {
  const { content } = await fetchDynamicRouteContent({
    fetchApi: (pathName) =>
      axios.get(apiUrl + pathName, {
        timeout: policy.requireDynamic ? 30_000 : 10_000,
      }),
    policy,
  });
  return [
    ...routesFor(content.stories, "/ket-qua-khach-hang/"),
    ...routesFor(content.trainers, "/huan-luyen-vien/"),
    ...routesFor(content.blogs, "/blog/"),
    ...routesFor(content.recipes, "/cong-thuc-nau-an/"),
  ];
};

const startServer = (app) =>
  new Promise((resolve, reject) => {
    const server = app.listen(PORT, () => resolve(server));
    server.once("error", reject);
  });

const stopServer = (server) =>
  new Promise((resolve, reject) => {
    if (!server?.listening) {
      resolve();
      return;
    }
    server.close((error) => (error ? reject(error) : resolve()));
  });

const renderRoute = async (browser, route) => {
  const page = await browser.newPage();
  const expectedCanonical = new URL(route, SITE_URL).href;
  try {
    await page.evaluateOnNewDocument(() => {
      sessionStorage.setItem("introDone", "true");
      localStorage.setItem("ht_language", "vi");
      window.isIntroDone = true;
    });
    await page.setExtraHTTPHeaders({
      "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
    });

    await page.setRequestInterception(true);
    page.on("request", (request) => {
      if (["image", "font", "media"].includes(request.resourceType())) {
        void request.abort();
      } else {
        void request.continue();
      }
    });

    try {
      await page.goto("http://localhost:" + PORT + route, {
        waitUntil: "networkidle2",
        timeout: 30_000,
      });
      await page.waitForFunction(
        (canonical) => {
          const root = document.querySelector("#root");
          const canonicals = [
            ...document.querySelectorAll('link[rel="canonical"]'),
          ];
          return (
            root &&
            root.innerHTML.trim().length > 100 &&
            canonicals.length === 1 &&
            canonicals[0].href === canonical
          );
        },
        { timeout: 30_000 },
        expectedCanonical,
      );
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.warn("Navigation warning for " + route + ": " + error.message);
    }

    const snapshot = await page.evaluate(() => ({
      rootLength:
        document.querySelector("#root")?.innerHTML.trim().length || 0,
      titles: [...document.querySelectorAll("title")].map((element) =>
        element.textContent.trim(),
      ),
      descriptions: [
        ...document.querySelectorAll('meta[name="description"]'),
      ].map((element) => element.content.trim()),
      canonicals: [
        ...document.querySelectorAll('link[rel="canonical"]'),
      ].map((element) => element.href),
      robots: [...document.querySelectorAll('meta[name="robots"]')].map(
        (element) => element.content.trim(),
      ),
    }));
    const validationErrors = validatePrerenderSnapshot(
      snapshot,
      expectedCanonical,
    );
    if (validationErrors.length > 0) {
      console.warn(
        "Skipping " + route + ": " + validationErrors.join("; "),
      );
      return false;
    }

    const html = await page.content();

    const segments = route.split("/").filter(Boolean);
    const routePath =
      segments.length === 0 ? DIST_DIR : path.join(DIST_DIR, ...segments);
    fs.mkdirSync(routePath, { recursive: true });
    fs.writeFileSync(path.join(routePath, "index.html"), html, "utf8");
    console.log(
      "  rendered " + route + " - " + (html.length / 1024).toFixed(1) + "KB",
    );
    return true;
  } catch (error) {
    console.error("Failed to prerender " + route + ": " + error.message);
    return false;
  } finally {
    await page.close();
  }
};

const prerender = async () => {
  if (!fs.existsSync(DIST_DIR)) {
    throw new Error('The "dist" folder is missing. Run the Vite build first.');
  }

  const policy = resolveDynamicRoutePolicy();
  const apiUrl = normalizeDynamicRouteApiUrl(
    process.env.PRERENDER_API_URL ||
      process.env.VITE_API_URL ||
      "https://api.htcoachingweb.io.vn/api",
    policy,
  );
  console.log(
    "Prerender dynamic route mode: " +
      (policy.requireDynamic ? "strict" : policy.skip ? "static" : "fallback"),
  );
  const dynamicRoutes = await discoverDynamicRoutes(policy, apiUrl);
  const routesToPrerender = [...new Set([...staticRoutes, ...dynamicRoutes])];

  // Keep the freshly built SPA shell immutable while routes are rendered.
  // The root route is written to dist/index.html, so reading that file again
  // for later routes would leak the homepage canonical and content into every
  // subsequent prerender.
  const appShellHtml = fs.readFileSync(
    path.join(DIST_DIR, "index.html"),
    "utf8",
  );
  const app = express();
  app.use(express.static(DIST_DIR, { index: false }));
  app.get(/.*/, (_req, res) => {
    res
      .set("Cache-Control", "no-store")
      .type("html")
      .send(appShellHtml);
  });

  const server = await startServer(app);
  let browser;
  try {
    console.log("Prerender server running at http://localhost:" + PORT);
    console.log("Total routes to prerender: " + routesToPrerender.length);
    browser = await puppeteer.launch({
      headless: "new",
      // Prerender runs on localhost but reads the public production API.
      // CORS remains enforced in the deployed application; this flag is only
      // applied to the isolated build-time browser that creates static HTML.
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-web-security",
      ],
    });

    const failures = [];
    for (const route of routesToPrerender) {
      console.log("Prerendering route: " + route);
      if (!(await renderRoute(browser, route))) failures.push(route);
    }

    if (policy.requireDynamic && failures.length > 0) {
      throw new Error(
        "Strict prerender failed for " +
          failures.length +
          " route(s): " +
          failures.join(", "),
      );
    }
    console.log(
      "Prerendering completed with " +
        (routesToPrerender.length - failures.length) +
        "/" +
        routesToPrerender.length +
        " routes.",
    );
  } finally {
    if (browser) await browser.close();
    await stopServer(server);
  }
};

prerender().catch((error) => {
  console.error("Error during prerendering:", error.message);
  process.exitCode = 1;
});
