import { normalizePublicPath } from "../src/utils/publicSeoPath.js";

export const canonicalUrlForRoute = (route, siteUrl) =>
  new URL(normalizePublicPath(route), siteUrl).href;

export const routesFromPrerenderManifest = (manifest) => {
  if (!Array.isArray(manifest) || manifest.length === 0) {
    throw new Error("Prerender route manifest is empty");
  }
  const routes = manifest.map((value) => {
    const route = String(value || "").trim();
    if (
      !route.startsWith("/") ||
      route.startsWith("//") ||
      route.includes("?") ||
      route.includes("#") ||
      route.includes("\\")
    ) {
      throw new Error("Prerender route manifest contains an invalid path");
    }
    return route === "/" ? "/" : route.replace(/\/+$/, "");
  });
  return [...new Set(routes)];
};

export const mapWithConcurrency = async (items, concurrency, worker) => {
  if (
    !Number.isSafeInteger(concurrency) ||
    concurrency < 1 ||
    concurrency > 16
  ) {
    throw new Error("Prerender concurrency must be an integer from 1 to 16");
  }

  const results = new Array(items.length);
  let nextIndex = 0;
  const runWorker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, items.length) },
      () => runWorker(),
    ),
  );
  return results;
};
