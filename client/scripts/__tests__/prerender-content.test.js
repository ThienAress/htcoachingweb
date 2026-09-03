import { describe, expect, it, vi } from "vitest";

import {
  createPrerenderResponseCache,
  fetchPrerenderPageData,
  fetchPrerenderRecipes,
  responseForPrerenderRequest,
} from "../prerender-content.js";

describe("prerender content cache", () => {
  it("fetches only recipe details declared in the prerender manifest", async () => {
    const fetchApi = vi.fn(async (path) => {
      const slug = path.split("/").at(-1);
      return {
        data: {
          success: true,
          data: { slug, name: `Recipe ${slug}` },
        },
      };
    });

    const recipes = await fetchPrerenderRecipes(
      [
        "/",
        "/cong-thuc-nau-an/recipe-one",
        "/cong-thuc-nau-an/recipe-two",
        "/cong-thuc-nau-an/recipe-one",
      ],
      fetchApi,
      { retryDelayMs: 0 },
    );

    expect(recipes.map(({ slug }) => slug)).toEqual([
      "recipe-one",
      "recipe-two",
    ]);
    expect(fetchApi.mock.calls.map(([path]) => path)).toEqual([
      "/recipes/detail/recipe-one",
      "/recipes/detail/recipe-two",
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
      if (path === "/exercises/64b000000000000000000001") {
        return {
          data: {
            success: true,
            data: {
              _id: "64b000000000000000000001",
              name: "Goblet Squat",
              instructions: [],
            },
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

  it("prefetches only exercise details declared in the manifest", async () => {
    const exercises = Array.from({ length: 10 }, (_, index) => ({
      _id: index.toString(16).padStart(24, "0"),
      name: `Exercise ${index + 1}`,
      instructions: [],
    }));
    const routes = exercises.map(
      (exercise) => `/exercises/${exercise._id}/exercise`,
    );
    const fetchApi = vi.fn(async (path) => {
      const id = path.split("/").at(-1);
      return {
        data: {
          success: true,
          data: exercises.find((exercise) => exercise._id === id),
        },
      };
    });

    const pageData = await fetchPrerenderPageData(routes, fetchApi, {
      retryDelayMs: 0,
    });

    expect(pageData.exercises.size).toBe(10);
    expect(fetchApi.mock.calls.map(([path]) => path)).toEqual(
      exercises.map(({ _id }) => `/exercises/${_id}`),
    );
  });

  it("serves cohort-only hub lists from the deterministic cache", () => {
    const exerciseId = "64b000000000000000000001";
    const cache = createPrerenderResponseCache(
      [{ slug: "recipe-one", name: "Recipe One" }],
      {
        exercises: new Map([
          [
            exerciseId,
            {
              success: true,
              data: { _id: exerciseId, name: "Goblet Squat" },
            },
          ],
        ]),
      },
    );

    const recipeList = JSON.parse(
      responseForPrerenderRequest(
        "https://api.htcoachingweb.io.vn/api/recipes?search=&category=&area=&page=1&limit=12",
        cache,
      ).body,
    );
    const exerciseList = JSON.parse(
      responseForPrerenderRequest(
        "https://api.htcoachingweb.io.vn/api/exercises?page=1&limit=500",
        cache,
      ).body,
    );

    expect(recipeList.data.map(({ slug }) => slug)).toEqual(["recipe-one"]);
    expect(exerciseList.data.map(({ _id }) => _id)).toEqual([exerciseId]);
  });
});
