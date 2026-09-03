import { describe, expect, it, vi } from "vitest";

import { generateSitemap } from "../generate-sitemap.js";

describe("generateSitemap static CI mode", () => {
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
});
