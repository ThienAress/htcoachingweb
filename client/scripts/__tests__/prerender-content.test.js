import { describe, expect, it, vi } from "vitest";

import {
  createPrerenderResponseCache,
  fetchPrerenderPageData,
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

  it("retries public detail fetches and serves deterministic prerender responses", async () => {
    let storyAttempts = 0;
    const fetchApi = vi.fn(async (path) => {
      if (path === "/customer-stories/story-one?lang=vi") {
        storyAttempts += 1;
        if (storyAttempts === 1) {
          const error = new Error("timeout");
          error.code = "ECONNABORTED";
          throw error;
        }
        return {
          data: { success: true, data: { slug: "story-one", name: "Story" } },
        };
      }
      if (path === "/customer-stories?limit=20&lang=vi") {
        return {
          data: {
            success: true,
            data: [{ slug: "story-one", name: "Story" }],
          },
        };
      }
      if (path === "/blog/blog-one?view=prerender") {
        return {
          data: {
            success: true,
            data: { slug: "blog-one", title: "Blog" },
            relatedPosts: [],
            discoveryPosts: [],
          },
        };
      }
      if (path === "/exercises?limit=500&page=1") {
        return {
          data: {
            success: true,
            data: [
              {
                _id: "64b000000000000000000001",
                name: "Goblet Squat",
                instructions: [],
              },
            ],
            pagination: { total: 1, page: 1, limit: 500, totalPages: 1 },
          },
        };
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    const pageData = await fetchPrerenderPageData(
      [
        "/ket-qua-khach-hang/story-one",
        "/blog/blog-one",
        "/exercises/64b000000000000000000001/goblet-squat",
      ],
      fetchApi,
      { retryDelayMs: 0 },
    );
    const cache = createPrerenderResponseCache([], pageData);

    expect({
      storyAttempts,
      story: JSON.parse(
        responseForPrerenderRequest(
          "https://htcoachingweb-staging.onrender.com/api/customer-stories/story-one?lang=vi",
          cache,
        ).body,
      ).data.slug,
      blog: JSON.parse(
        responseForPrerenderRequest(
          "https://htcoachingweb-staging.onrender.com/api/blog/blog-one",
          cache,
        ).body,
      ).data.slug,
      exercise: JSON.parse(
        responseForPrerenderRequest(
          "https://htcoachingweb-staging.onrender.com/api/exercises/64b000000000000000000001",
          cache,
        ).body,
      ).data.name,
      exerciseReviews: JSON.parse(
        responseForPrerenderRequest(
          "https://htcoachingweb-staging.onrender.com/api/exercises/64b000000000000000000001/reviews",
          cache,
        ).body,
      ).data.summary,
      documentRequest: responseForPrerenderRequest(
        "http://localhost:5174/blog/blog-one",
        cache,
      ),
    }).toEqual({
      storyAttempts: 2,
      story: "story-one",
      blog: "blog-one",
      exercise: "Goblet Squat",
      exerciseReviews: { total: 0, averageRating: 0 },
      documentRequest: null,
    });
  });

  it("prefetches a large exercise catalog through paginated list requests", async () => {
    const total = 1_374;
    const exercises = Array.from({ length: total }, (_, index) => ({
      _id: index.toString(16).padStart(24, "0"),
      name: `Exercise ${index + 1}`,
      instructions: [],
    }));
    const routes = exercises.map(
      (exercise) => `/exercises/${exercise._id}/exercise`,
    );
    const fetchApi = vi.fn(async (path) => {
      const page = Number(
        new URL(path, "https://example.test").searchParams.get("page"),
      );
      return {
        data: {
          success: true,
          data: exercises.slice((page - 1) * 500, page * 500),
          pagination: { total, page, limit: 500, totalPages: 3 },
        },
      };
    });

    const pageData = await fetchPrerenderPageData(routes, fetchApi, {
      retryDelayMs: 0,
    });

    expect(pageData.exercises.size).toBe(total);
    expect(fetchApi.mock.calls.map(([path]) => path)).toEqual([
      "/exercises?limit=500&page=1",
      "/exercises?limit=500&page=2",
      "/exercises?limit=500&page=3",
    ]);
  });
});
