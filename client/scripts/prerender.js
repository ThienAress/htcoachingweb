import puppeteer from "puppeteer";
import express from "express";
import fs from "fs";
import path from "path";
import axios from "axios";
import { fileURLToPath } from "url";

import {
  normalizeDynamicRouteApiUrl,
  resolveDynamicRoutePolicy,
} from "./dynamic-routes.js";
import {
  createPrerenderResponseCache,
  fetchPrerenderPageData,
  fetchPrerenderRecipes,
  responseForPrerenderRequest,
} from "./prerender-content.js";
import {
  canonicalUrlForRoute,
  mapWithConcurrency,
  routesFromPrerenderManifest,
} from "./prerender-routes.js";
import { validatePrerenderSnapshot } from "./prerender-validation.js";
import {
  getTrainerPlanCatalogMeta,
  listTrainerPlanBenefits,
  listTrainerPlans,
} from "../../server/src/services/trainerPlanCatalog.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = 5174;
const DIST_DIR = path.resolve(__dirname, "../dist");
const SITE_URL = "https://htcoachingweb.io.vn";
const PRERENDER_CONCURRENCY = Number.parseInt(
  process.env.PRERENDER_CONCURRENCY || "8",
  10,
);
const NAVIGATION_TIMEOUT_MS = 5_000;
const SNAPSHOT_POLL_INTERVAL_MS = 500;
const SNAPSHOT_MAX_WAIT_MS = 30_000;
const HOME_SNAPSHOT_MAX_WAIT_MS = 30_000;
const BLOCKED_PRERENDER_HOSTS = new Set([
  "www.google-analytics.com",
  "www.googletagmanager.com",
]);

const trainerPlanCatalog = listTrainerPlans();
const trainerPlanBenefits = listTrainerPlanBenefits();
const trainerPlanCatalogMeta = getTrainerPlanCatalogMeta();
const trainerPlanCatalogResponse = JSON.stringify({
  success: true,
  data: trainerPlanCatalog,
  benefits: trainerPlanBenefits,
  meta: trainerPlanCatalogMeta,
});
const expectedServiceOffers = trainerPlanCatalog.flatMap((plan) =>
  plan.billingCycles.map((cycle) => ({
    price: plan.prices[cycle],
    priceCurrency: trainerPlanCatalogMeta.currency,
  })),
);

const isTrainerPlanCatalogRequest = (requestUrl) => {
  try {
    return new URL(requestUrl).pathname.endsWith(
      "/trainer-subscriptions/catalog",
    );
  } catch {
    return false;
  }
};

const shouldAbortPrerenderRequest = (request) => {
  if (["image", "font", "media"].includes(request.resourceType())) return true;
  try {
    return BLOCKED_PRERENDER_HOSTS.has(new URL(request.url()).hostname);
  } catch {
    return false;
  }
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

const renderRoute = async (browser, route, recipeCache) => {
  const page = await browser.newPage();
  const expectedCanonical = canonicalUrlForRoute(route, SITE_URL);
  const diagnostics = [];
  const recordDiagnostic = (message) => {
    if (diagnostics.length < 12) diagnostics.push(message);
  };
  page.on("console", (message) => {
    if (message.type() === "error") {
      recordDiagnostic("console: " + message.text());
    }
  });
  page.on("pageerror", (error) => {
    recordDiagnostic("pageerror: " + error.message);
  });
  page.on("requestfailed", (request) => {
    let failedUrl = request.url();
    try {
      const parsedUrl = new URL(failedUrl);
      failedUrl = parsedUrl.origin + parsedUrl.pathname;
    } catch {
      // Keep Puppeteer's original value when it is not a valid URL.
    }
    recordDiagnostic(
      "requestfailed [" +
        request.resourceType() +
        "]: " +
        failedUrl +
        " (" +
        (request.failure()?.errorText || "unknown") +
        ")",
    );
  });
  try {
    await page.evaluateOnNewDocument(() => {
      sessionStorage.setItem("introDone", "true");
      localStorage.setItem("ht_language", "vi");
      window.isIntroDone = true;
    });
    await page.setExtraHTTPHeaders({
      "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
    });

    await page.setCacheEnabled(false);

    await page.setRequestInterception(true);
    page.on("request", (request) => {
      const cachedResponse = responseForPrerenderRequest(
        request.url(),
        recipeCache,
      );
      if (cachedResponse) {
        void request.respond(cachedResponse);
      } else if (isTrainerPlanCatalogRequest(request.url())) {
        void request.respond({
          status: 200,
          contentType: "application/json; charset=utf-8",
          headers: { "Access-Control-Allow-Origin": "*" },
          body: trainerPlanCatalogResponse,
        });
      } else if (shouldAbortPrerenderRequest(request)) {
        void request.abort();
      } else {
        void request.continue();
      }
    });

    try {
      await page.goto("http://localhost:" + PORT + route, {
        waitUntil: "domcontentloaded",
        timeout: NAVIGATION_TIMEOUT_MS,
      });
    } catch (error) {
      console.warn("Navigation warning for " + route + ": " + error.message);
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
    const captureSnapshot = () => page.evaluate(() => ({
      rootLength:
        document.querySelector("#root")?.innerHTML.trim().length || 0,
      fatalFallbackCount: document.querySelectorAll(
        "[data-app-fatal-error]",
      ).length,
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
      structuredData: [
        ...document.querySelectorAll('script[type="application/ld+json"]'),
      ]
        .map((element) => {
          try {
            return JSON.parse(element.textContent || "");
          } catch {
            return null;
          }
        })
        .filter(Boolean),
    }));
    const validationOptions = route === "/"
      ? { expectedServiceOffers }
      : undefined;
    let snapshot = await captureSnapshot();
    let validationErrors = validatePrerenderSnapshot(
      snapshot,
      expectedCanonical,
      validationOptions,
    );
    const snapshotAttempts = Math.ceil(
      (route === "/" ? HOME_SNAPSHOT_MAX_WAIT_MS : SNAPSHOT_MAX_WAIT_MS) /
        SNAPSHOT_POLL_INTERVAL_MS,
    );
    for (
      let attempt = 0;
      validationErrors.length > 0 && attempt < snapshotAttempts;
      attempt += 1
    ) {
      await new Promise((resolve) =>
        setTimeout(resolve, SNAPSHOT_POLL_INTERVAL_MS),
      );
      snapshot = await captureSnapshot();
      validationErrors = validatePrerenderSnapshot(
        snapshot,
        expectedCanonical,
        validationOptions,
      );
    }
    if (validationErrors.length > 0) {
      console.warn(
        "Skipping " + route + ": " + validationErrors.join("; "),
      );
      if (diagnostics.length > 0) {
        console.warn(
          "Diagnostics for " + route + ": " + diagnostics.join(" | "),
        );
      }
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
  let routesToPrerender = routesFromPrerenderManifest(
    JSON.parse(
      fs.readFileSync(
        path.resolve(__dirname, ".generated/prerender-routes.json"),
        "utf8",
      ),
    ),
  );
  let recipes = [];
  let pageData = {};
  if (!policy.skip) {
    try {
      recipes = await fetchPrerenderRecipes((pathName) =>
        axios.get(apiUrl + pathName, {
          timeout: policy.requireDynamic ? 30_000 : 10_000,
        }),
      );
    } catch (error) {
      if (policy.requireDynamic) throw error;
      console.warn(
        "Skipping recipe prerender because public content could not be cached: " +
          error.message,
      );
      routesToPrerender = routesToPrerender.filter(
        (route) => !route.startsWith("/cong-thuc-nau-an/"),
      );
    }
    try {
      pageData = await fetchPrerenderPageData(
        routesToPrerender,
        (pathName) =>
          axios.get(apiUrl + pathName, {
            timeout: policy.requireDynamic ? 30_000 : 10_000,
          }),
      );
    } catch (error) {
      if (policy.requireDynamic) throw error;
      console.warn(
        "Skipping detail cache because public content could not be prefetched: " +
          error.message,
      );
    }
  }
  const responseCache = createPrerenderResponseCache(recipes, pageData);
  console.log(
    "Prerender dynamic route mode: " +
      (policy.requireDynamic ? "strict" : policy.skip ? "static" : "fallback"),
  );

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

    const renderResults = await mapWithConcurrency(
      routesToPrerender,
      PRERENDER_CONCURRENCY,
      async (route) => {
        console.log("Prerendering route: " + route);
        return {
          route,
          success: await renderRoute(browser, route, responseCache),
        };
      },
    );
    const failures = renderResults
      .filter((result) => !result.success)
      .map((result) => result.route);

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
