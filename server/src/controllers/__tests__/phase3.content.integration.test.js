import request from "supertest";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock("../../utils/sendMail.js", () => ({
  sendMail: vi.fn().mockResolvedValue(undefined),
}));

import {
  clearCollections,
  createTestApp,
  createTestUser,
  setupTestDB,
  teardownTestDB,
  withAuth,
} from "../../__tests__/setup.js";
import { protect } from "../../middlewares/auth.middleware.js";
import BlogPost from "../../models/BlogPost.js";
import Order from "../../models/Order.js";
import Recipe from "../../models/Recipe.js";
import {
  inspectLegacyRecipePublication,
  runPhase3ContentMigration,
} from "../../migrations/20260719-phase3-content-performance.js";
import {
  getPublicBlogPostBySlug,
  getPublicBlogPosts,
} from "../blog.controller.js";
import { getCheckinOrderOptions } from "../order.controller.js";
import { createRecipe, getRecipes } from "../recipe.controller.js";

let app;

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();

  app.get("/api/blog", getPublicBlogPosts);
  app.get("/api/blog/:slug", getPublicBlogPostBySlug);
  app.get("/api/recipes", getRecipes);
  app.post("/api/recipes", protect, createRecipe);
  app.get(
    "/api/orders/checkin-options",
    protect,
    (req, _res, next) => {
      req.isAdmin = req.user.role === "admin";
      next();
    },
    getCheckinOrderOptions,
  );
});

afterEach(async () => {
  await clearCollections();
});

afterAll(async () => {
  await teardownTestDB();
});

describe("Phase 3 content and option queries", () => {
  it("sorts popular blog posts by views and prioritizes related tags", async () => {
    const base = {
      content: "<p>Content</p>",
      excerpt: "Excerpt",
      category: "tap-luyen",
      status: "published",
      publishedAt: new Date("2026-07-01T00:00:00.000Z"),
    };
    await BlogPost.create([
      {
        ...base,
        title: "Current",
        slug: "current",
        tags: ["strength"],
        views: 5,
      },
      {
        ...base,
        title: "Most Viewed",
        slug: "most-viewed",
        tags: ["mobility"],
        views: 100,
      },
      {
        ...base,
        title: "Tag Match",
        slug: "tag-match",
        tags: ["strength"],
        views: 20,
      },
      {
        ...base,
        title: "Draft",
        slug: "draft",
        tags: ["strength"],
        views: 1000,
        status: "draft",
        publishedAt: null,
      },
    ]);

    const popular = await request(app).get("/api/blog?sort=popular&limit=3");
    expect(popular.status).toBe(200);
    expect(popular.body.data.map((post) => post.slug)).toEqual([
      "most-viewed",
      "tag-match",
      "current",
    ]);

    const detail = await request(app).get("/api/blog/current");
    expect(detail.status).toBe(200);
    expect(detail.body.relatedPosts[0].slug).toBe("tag-match");
    expect(
      (await BlogPost.findOne({ slug: "current" }).lean()).views,
    ).toBe(6);
  });

  it("creates recipes as drafts and rejects malformed structured fields", async () => {
    const { accessToken } = await createTestUser({
      email: "recipe-admin@example.com",
      role: "admin",
    });

    const invalid = await withAuth(
      request(app).post("/api/recipes").send({
        name: "Protein Bowl",
        tags: "protein",
      }),
      accessToken,
    );
    expect(invalid.status).toBe(400);

    const created = await withAuth(
      request(app).post("/api/recipes").send({
        name: "Protein Bowl",
        ingredients: [{ name: "Chicken", measure: "200g" }],
        instructions: ["Cook thoroughly"],
        tags: ["protein"],
      }),
      accessToken,
    );
    expect(created.status).toBe(201);
    expect(created.body.data.slug).toBe("protein-bowl");
    expect(created.body.data.isPublished).toBe(false);
    expect((await Recipe.findById(created.body.data._id)).isPublished).toBe(
      false,
    );

    const publicList = await request(app).get("/api/recipes");
    expect(publicList.status).toBe(200);
    expect(publicList.body.data).toEqual([]);
  });

  it("publishes only validated legacy MealDB recipes during migration", async () => {
    const now = new Date();
    await Recipe.collection.insertMany([
      {
        name: "Legacy MealDB Recipe",
        slug: "legacy-mealdb-recipe",
        source: "mealdb",
        ingredients: [{ name: "Chicken", measure: "200g" }],
        instructions: ["Cook thoroughly"],
        tags: [],
        createdAt: now,
        updatedAt: now,
      },
      {
        name: "Legacy AI Recipe",
        slug: "legacy-ai-recipe",
        source: "ai",
        ingredients: [{ name: "Rice", measure: "100g" }],
        instructions: ["Cook thoroughly"],
        tags: [],
        createdAt: now,
        updatedAt: now,
      },
    ]);

    expect(await inspectLegacyRecipePublication()).toEqual({
      candidates: 1,
      validCandidates: 1,
      invalidCandidates: 0,
      validationErrorFields: {},
      duplicateSlugGroups: 0,
    });

    const result = await runPhase3ContentMigration();
    const mealDbRecipe = await Recipe.collection.findOne({
      slug: "legacy-mealdb-recipe",
    });
    const aiRecipe = await Recipe.collection.findOne({
      slug: "legacy-ai-recipe",
    });

    expect(result.recipes.publishedMealDb).toBe(1);
    expect(result.recipes.draftedOtherSources).toBe(1);
    expect(mealDbRecipe.isPublished).toBe(true);
    expect(aiRecipe.isPublished).toBe(false);
  });

  it("fails the recipe migration before writes when MealDB data is invalid", async () => {
    await Recipe.collection.insertOne({
      slug: "invalid-mealdb-recipe",
      source: "mealdb",
      ingredients: [],
      instructions: [],
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(runPhase3ContentMigration()).rejects.toMatchObject({
      code: "PHASE3_RECIPE_PREFLIGHT_FAILED",
    });
    const stored = await Recipe.collection.findOne({
      slug: "invalid-mealdb-recipe",
    });
    expect(stored.isPublished).toBeUndefined();
  });

  it("returns only eligible trainer-owned check-in options", async () => {
    const { user: trainer, accessToken } = await createTestUser({
      email: "options-trainer@example.com",
      role: "trainer",
    });
    const { user: otherTrainer } = await createTestUser({
      email: "other-options-trainer@example.com",
      role: "trainer",
    });

    await Order.create([
      {
        name: "[Regex] Client",
        email: "eligible@example.com",
        package: "PT",
        sessions: 2,
        totalSessions: 10,
        status: "approved",
        trainerId: trainer._id,
      },
      {
        name: "No Sessions",
        email: "empty@example.com",
        package: "PT",
        sessions: 0,
        totalSessions: 10,
        status: "approved",
        trainerId: trainer._id,
      },
      {
        name: "Other Client",
        email: "other@example.com",
        package: "PT",
        sessions: 3,
        totalSessions: 10,
        status: "approved",
        trainerId: otherTrainer._id,
      },
    ]);

    const response = await withAuth(
      request(app).get("/api/orders/checkin-options?search=[Regex]&limit=100"),
      accessToken,
    );
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toEqual(
      expect.objectContaining({
        name: "[Regex] Client",
        sessions: 2,
      }),
    );
  });
});
