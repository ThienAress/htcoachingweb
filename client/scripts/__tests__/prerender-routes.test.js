import { describe, expect, it, vi } from "vitest";

import {
  canonicalUrlForRoute,
  mapWithConcurrency,
  routesFromPrerenderManifest,
} from "../prerender-routes.js";

describe("prerender route planning", () => {
  it("uses the Netlify trailing-slash URL as the prerender canonical", () => {
    expect(
      canonicalUrlForRoute("/blog/bai-viet", "https://htcoachingweb.io.vn"),
    ).toBe("https://htcoachingweb.io.vn/blog/bai-viet/");
  });

  it("loads only safe local paths from the prerender manifest", () => {
    expect(
      routesFromPrerenderManifest([
        "/",
        "/cong-thuc-nau-an/recipe-one/",
        "/cong-thuc-nau-an/recipe-one",
      ]),
    ).toEqual(["/", "/cong-thuc-nau-an/recipe-one"]);
  });

  it("rejects an empty or external prerender manifest", () => {
    expect(() =>
      routesFromPrerenderManifest([]),
    ).toThrow(/manifest is empty/i);
    expect(() =>
      routesFromPrerenderManifest(["https://example.com/page"]),
    ).toThrow(/invalid path/i);
  });

  it("keeps prerender work within the configured concurrency", async () => {
    let active = 0;
    let maxActive = 0;
    const worker = vi.fn(async (route) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      active -= 1;
      return route.toUpperCase();
    });

    const results = await mapWithConcurrency(
      ["/one", "/two", "/three", "/four", "/five"],
      2,
      worker,
    );

    expect(results).toEqual(["/ONE", "/TWO", "/THREE", "/FOUR", "/FIVE"]);
    expect(maxActive).toBe(2);
  });

  it("rejects concurrency above the bounded build-time limit", async () => {
    await expect(mapWithConcurrency(["/"], 17, async () => true)).rejects.toThrow(
      "integer from 1 to 16",
    );
  });
});
