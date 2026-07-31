import { describe, expect, it, vi } from "vitest";

import {
  createPrerenderResponseCache,
  fetchPrerenderRecipes,
  responseForPrerenderRequest,
} from "../prerender-content.js";

describe("prerender content cache", () => {
  it("fetches every public recipe detail page in bounded batches", async () => {
    const fetchApi = vi.fn(async (path) => {
      const page = Number(
        new URL(path, "https://example.test").searchParams.get("page"),
      );
      const pageSize = page === 3 ? 1 : 50;
      return {
        data: {
          data: Array.from({ length: pageSize }, (_, index) => ({
            slug: `recipe-${page}-${index + 1}`,
            name: `Recipe ${page}-${index + 1}`,
          })),
          pagination: { total: 101, page, limit: 50, totalPages: 3 },
        },
      };
    });

    const recipes = await fetchPrerenderRecipes(fetchApi);

    expect(recipes).toHaveLength(101);
    expect(fetchApi.mock.calls.map(([path]) => path)).toEqual([
      "/recipes?limit=50&page=1&view=prerender",
      "/recipes?limit=50&page=2&view=prerender",
      "/recipes?limit=50&page=3&view=prerender",
    ]);
  });

  it("serves auth and recipe detail requests without hitting production", () => {
    const cache = createPrerenderResponseCache([
      { slug: "recipe-one", name: "Recipe One", ingredients: [] },
    ]);

    expect(
      responseForPrerenderRequest(
        "https://api.htcoachingweb.io.vn/api/recipes/detail/recipe-one",
        cache,
      ),
    ).toMatchObject({ status: 200 });
    expect(
      responseForPrerenderRequest(
        "https://api.htcoachingweb.io.vn/api/user/me",
        cache,
      ),
    ).toMatchObject({ status: 401 });
  });
});
