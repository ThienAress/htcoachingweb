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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = 5174;
const DIST_DIR = path.resolve(__dirname, "../dist");
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
  try {
    await page.evaluateOnNewDocument(() => {
      sessionStorage.setItem("introDone", "true");
      window.isIntroDone = true;
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
        () => {
          const root = document.querySelector("#root");
          return root && root.innerHTML.trim().length > 100;
        },
        { timeout: 15_000 },
      );
      await new Promise((resolve) => setTimeout(resolve, 3_000));
    } catch (error) {
      console.warn("Navigation warning for " + route + ": " + error.message);
    }

    const html = await page.content();
    const rootMatch = html.match(/<div id="root">([\s\S]*?)<\/div>/);
    const hasContent = rootMatch && rootMatch[1].trim().length > 100;
    if (!hasContent) {
      console.warn("Skipping " + route + ": prerendered root is empty");
      return false;
    }

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
      "https://htcoachingweb.onrender.com/api",
    policy,
  );
  console.log(
    "Prerender dynamic route mode: " +
      (policy.requireDynamic ? "strict" : policy.skip ? "static" : "fallback"),
  );
  const dynamicRoutes = await discoverDynamicRoutes(policy, apiUrl);
  const routesToPrerender = [...new Set([...staticRoutes, ...dynamicRoutes])];

  const app = express();
  app.use(express.static(DIST_DIR));
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(DIST_DIR, "index.html"));
  });

  const server = await startServer(app);
  let browser;
  try {
    console.log("Prerender server running at http://localhost:" + PORT);
    console.log("Total routes to prerender: " + routesToPrerender.length);
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
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
