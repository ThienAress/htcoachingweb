import { describe, expect, it, vi } from "vitest";

import {
  dynamicRouteTestConstants,
  fetchDynamicRouteContent,
  normalizeDynamicRouteApiUrl,
  resolveDynamicRoutePolicy,
} from "../dynamic-routes.js";

const responseFor = (path) => {
  if (path.startsWith("/customer-stories")) {
    return { data: { data: [{ slug: "story-one" }] } };
  }
  if (path === "/trainers") {
    return { data: { data: [{ slug: "trainer-one" }] } };
  }
  if (path.startsWith("/blog")) {
    return { data: { data: [{ slug: "blog-one" }] } };
  }
  return { data: { data: [{ slug: "recipe-one" }] } };
};

describe("dynamic route release policy", () => {
  it("automatically requires dynamic routes for Netlify production", () => {
    const policy = resolveDynamicRoutePolicy({
      NETLIFY: "true",
      CONTEXT: "production",
    });
    expect(policy).toEqual({
      skip: false,
      requireDynamic: true,
      netlifyProduction: true,
    });
    expect(
      normalizeDynamicRouteApiUrl(
        dynamicRouteTestConstants.productionApiBase + "/",
        policy,
      ),
    ).toBe(dynamicRouteTestConstants.productionApiBase);
  });

  it("rejects skip mode and a wrong API on Netlify production", () => {
    expect(() =>
      resolveDynamicRoutePolicy({
        NETLIFY: "true",
        CONTEXT: "production",
        SKIP_DYNAMIC_ROUTES: "true",
      }),
    ).toThrow(/cannot be enabled/);

    const policy = resolveDynamicRoutePolicy({
      NETLIFY: "true",
      CONTEXT: "production",
    });
    expect(() =>
      normalizeDynamicRouteApiUrl(
        "https://htcoachingweb-staging.onrender.com/api",
        policy,
      ),
    ).toThrow(/approved production API/);
  });

  it("keeps CI skip mode deterministic without making network calls", async () => {
    const fetchApi = vi.fn();
    const result = await fetchDynamicRouteContent({
      fetchApi,
      policy: resolveDynamicRoutePolicy({ SKIP_DYNAMIC_ROUTES: "true" }),
    });
    expect(fetchApi).not.toHaveBeenCalled();
    expect(result.skipped).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it("fails a strict build when one source is unavailable", async () => {
    const fetchApi = vi.fn(async (path) => {
      if (path.startsWith("/recipes")) {
        const error = new Error("not found");
        error.response = { status: 404 };
        throw error;
      }
      return responseFor(path);
    });
    const logger = { error: vi.fn() };

    await expect(
      fetchDynamicRouteContent({
        fetchApi,
        policy: resolveDynamicRoutePolicy({ REQUIRE_DYNAMIC_ROUTES: "true" }),
        logger,
        retryDelayMs: 0,
      }),
    ).rejects.toThrow(/recipes \(HTTP 404\)/);
    expect(fetchApi).toHaveBeenCalledTimes(
      dynamicRouteTestConstants.sourceCount,
    );
  });

  it("preserves successful sources only in explicit non-strict mode", async () => {
    const fetchApi = vi.fn(async (path) => {
      if (path.startsWith("/blog")) throw new Error("temporary");
      return responseFor(path);
    });
    const result = await fetchDynamicRouteContent({
      fetchApi,
      policy: resolveDynamicRoutePolicy({}),
      logger: { error: vi.fn() },
      retryDelayMs: 0,
    });

    expect(result.content.stories).toHaveLength(1);
    expect(result.content.blogs).toEqual([]);
    expect(result.failures.map((failure) => failure.key)).toEqual(["blogs"]);
  });

  it("treats malformed successful responses as strict failures", async () => {
    const fetchApi = vi.fn(async (path) =>
      path === "/trainers" ? { data: { success: true } } : responseFor(path),
    );
    await expect(
      fetchDynamicRouteContent({
        fetchApi,
        policy: resolveDynamicRoutePolicy({ REQUIRE_DYNAMIC_ROUTES: "true" }),
        logger: { error: vi.fn() },
        retryDelayMs: 0,
      }),
    ).rejects.toThrow(/trainers \(invalid response\)/);
  });

  it("retries transient failures but not permanent 404 responses", async () => {
    let recipeAttempts = 0;
    const transientFetch = vi.fn(async (path) => {
      if (path.startsWith("/recipes") && recipeAttempts++ === 0) {
        const error = new Error("timeout");
        error.code = "ECONNABORTED";
        throw error;
      }
      return responseFor(path);
    });
    const recovered = await fetchDynamicRouteContent({
      fetchApi: transientFetch,
      policy: resolveDynamicRoutePolicy({ REQUIRE_DYNAMIC_ROUTES: "true" }),
      logger: { error: vi.fn() },
      retryDelayMs: 0,
    });
    expect(recovered.content.recipes).toHaveLength(1);
    expect(recipeAttempts).toBe(2);

    let permanentAttempts = 0;
    const permanentFetch = vi.fn(async (path) => {
      if (path.startsWith("/recipes")) {
        permanentAttempts += 1;
        const error = new Error("not found");
        error.response = { status: 404 };
        throw error;
      }
      return responseFor(path);
    });
    await expect(
      fetchDynamicRouteContent({
        fetchApi: permanentFetch,
        policy: resolveDynamicRoutePolicy({ REQUIRE_DYNAMIC_ROUTES: "true" }),
        logger: { error: vi.fn() },
        retryDelayMs: 0,
      }),
    ).rejects.toThrow(/recipes \(HTTP 404\)/);
    expect(permanentAttempts).toBe(1);
  });
});
