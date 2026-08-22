import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";
import request from "supertest";

import {
  clearCollections,
  createTestApp,
  createTestUser,
  setupTestDB,
  teardownTestDB,
  withAuth,
} from "../../__tests__/setup.js";
import { protect } from "../../middlewares/auth.middleware.js";
import { optionalAuth } from "../../middlewares/optionalAuth.js";
import { csrfProtection } from "../../middlewares/csrf.js";
import {
  validateRecipeId,
  validateRecipeReview,
} from "../../middlewares/validation.js";
import Recipe from "../../models/Recipe.js";
import RecipeReview from "../../models/RecipeReview.js";
import {
  getReviews,
  removeReview,
  upsertReview,
} from "../recipeReview.controller.js";

let app;

beforeAll(async () => {
  await setupTestDB();
  await RecipeReview.init();
  app = createTestApp();
  app.get(
    "/api/recipes/:recipeId/reviews",
    optionalAuth,
    validateRecipeId,
    getReviews,
  );
  app.put(
    "/api/recipes/:recipeId/reviews",
    protect,
    csrfProtection,
    validateRecipeReview,
    upsertReview,
  );
  app.delete(
    "/api/recipes/:recipeId/reviews",
    protect,
    csrfProtection,
    validateRecipeId,
    removeReview,
  );
});

afterEach(async () => {
  await clearCollections();
});

afterAll(async () => {
  await teardownTestDB();
});

const createRecipe = () =>
  Recipe.create({
    name: "Gà áp chảo",
    slug: "ga-ap-chao-review-test",
    isPublished: true,
    ingredients: [],
    instructions: [],
  });

describe("Recipe review API", () => {
  it("requires auth and CSRF, validates rating, then upserts one review per user", async () => {
    const recipe = await createRecipe();
    const { user, accessToken } = await createTestUser({
      name: "Người thử món",
      email: "recipe-review@example.com",
    });
    const endpoint = `/api/recipes/${recipe._id}/reviews`;

    expect((await request(app).put(endpoint).send({ rating: 5 })).status).toBe(401);
    expect(
      (
        await request(app)
          .put(endpoint)
          .set("Cookie", [`accessToken=${accessToken}`])
          .send({ rating: 5 })
      ).status,
    ).toBe(403);
    expect(
      (
        await withAuth(request(app).put(endpoint), accessToken).send({ rating: 6 })
      ).status,
    ).toBe(400);

    const created = await withAuth(request(app).put(endpoint), accessToken).send({
      rating: 4,
      comment: "Dễ làm và ngon.",
    });
    expect(created.status).toBe(200);
    expect(created.body.data).toMatchObject({
      rating: 4,
      comment: "Dễ làm và ngon.",
      displayName: "Người thử món",
      isOwner: true,
    });

    await withAuth(request(app).put(endpoint), accessToken).send({
      rating: 5,
      comment: "Đã thử lại với ít dầu hơn.",
    });
    expect(await RecipeReview.countDocuments({ recipeId: recipe._id, userId: user._id })).toBe(1);
  });

  it("returns public-safe review fields, summary, pagination and the viewer's review", async () => {
    const recipe = await createRecipe();
    const { user, accessToken } = await createTestUser({
      name: "Khách HT",
      email: "private-review-email@example.com",
    });
    await RecipeReview.create({
      recipeId: recipe._id,
      userId: user._id,
      rating: 5,
      comment: "Rất ổn.",
    });
    const endpoint = `/api/recipes/${recipe._id}/reviews?limit=10&page=1`;

    const publicResponse = await request(app).get(endpoint);
    expect(publicResponse.body.data).toMatchObject({
      summary: { total: 1, averageRating: 5 },
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      myReview: null,
      items: [{ displayName: "Khách HT", rating: 5, isOwner: false }],
    });
    expect(JSON.stringify(publicResponse.body)).not.toContain("private-review-email@example.com");

    const authenticated = await withAuth(request(app).get(endpoint), accessToken);
    expect(authenticated.body.data.myReview).toMatchObject({ rating: 5, isOwner: true });
    expect(authenticated.body.data.items[0].isOwner).toBe(true);
  });

  it("only deletes the signed-in user's own review", async () => {
    const recipe = await createRecipe();
    const owner = await createTestUser({ email: "review-owner@example.com" });
    const other = await createTestUser({ email: "review-other@example.com" });
    await RecipeReview.create({ recipeId: recipe._id, userId: owner.user._id, rating: 4 });
    const endpoint = `/api/recipes/${recipe._id}/reviews`;

    expect((await withAuth(request(app).delete(endpoint), other.accessToken)).status).toBe(404);
    expect(await RecipeReview.countDocuments()).toBe(1);
    expect((await withAuth(request(app).delete(endpoint), owner.accessToken)).status).toBe(200);
    expect(await RecipeReview.countDocuments()).toBe(0);
  });
});
