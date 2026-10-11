import { describe, expect, it, vi } from "vitest";

import { generateSitemap } from "../generate-sitemap.js";

describe("generateSitemap build modes", () => {
  it("creates only static routes without making any dynamic request", async () => {
    const writeOutputsImpl = vi.fn();
    const fetchDynamicRouteContentImpl = vi.fn();
    const fetchPrerenderRecipesImpl = vi.fn();
    const logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };

    const result = await generateSitemap({
      env: {
        SKIP_DYNAMIC_ROUTES: "true",
        VITE_API_URL: "https://example.invalid/api",
      },
      writeOutputsImpl,
      fetchDynamicRouteContentImpl,
      fetchPrerenderRecipesImpl,
      logger,
    });

    expect(fetchDynamicRouteContentImpl).not.toHaveBeenCalled();
    expect(fetchPrerenderRecipesImpl).not.toHaveBeenCalled();
    expect(writeOutputsImpl).toHaveBeenCalledWith(
      expect.objectContaining({
        contentRoutes: [],
        recipeRoutes: [],
      }),
    );
    const [{ coreRoutes, prerenderRoutes }] = writeOutputsImpl.mock.calls[0];
    expect(prerenderRoutes).toEqual(coreRoutes);
    expect(result).toEqual({ mode: "static", submittedUrlCount: 9 });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/not valid for production deployment/i),
    );
  });

  it("requires staging dynamic sources without requiring the production SEO cohort", async () => {
    const writeOutputsImpl = vi.fn();
    const fetchDynamicRouteContentImpl = vi.fn(async ({ policy }) => {
      expect(policy).toMatchObject({
        requireDynamic: true,
        netlifyProduction: false,
      });
      return {
        content: {
          stories: [],
          trainers: [],
          blogs: [],
          recipes: [],
          exercises: [],
        },
        failures: [],
      };
    });
    const fetchPrerenderRecipesImpl = vi.fn(async () => []);

    const result = await generateSitemap({
      env: {
        NETLIFY: "true",
        CONTEXT: "branch-deploy",
        REQUIRE_DYNAMIC_ROUTES: "true",
        SITEMAP_API_URL: "https://staging.example.com/api",
      },
      writeOutputsImpl,
      fetchDynamicRouteContentImpl,
      fetchPrerenderRecipesImpl,
      logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });

    expect(writeOutputsImpl).toHaveBeenCalledWith(
      expect.objectContaining({
        contentRoutes: [],
        recipeRoutes: [],
      }),
    );
    expect(result).toEqual({ mode: "strict", submittedUrlCount: 9 });
  });

  it("keeps the approved SEO cohort mandatory for Netlify production", async () => {
    await expect(
      generateSitemap({
        env: {
          NETLIFY: "true",
          CONTEXT: "production",
          SITEMAP_API_URL: "https://api.htcoachingweb.io.vn/api",
        },
        writeOutputsImpl: vi.fn(),
        fetchDynamicRouteContentImpl: vi.fn(async () => ({
          content: {
            stories: [],
            trainers: [],
            blogs: [],
            recipes: [],
            exercises: [],
          },
          failures: [],
        })),
        fetchPrerenderRecipesImpl: vi.fn(async () => []),
        logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
      }),
    ).rejects.toThrow(/SEO selection|Pinned (recipe|exercise)/);
  });
});
