import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";

import {
  clearCollections,
  createTestApp,
  createTestUser,
  setupTestDB,
  teardownTestDB,
  withAuth,
} from "../../__tests__/setup.js";
import Recipe from "../../models/Recipe.js";
import recipeRoutes from "../../routes/recipe.routes.js";

let app;

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/recipes", recipeRoutes);
});

afterEach(async () => {
  await clearCollections();
});

afterAll(async () => {
  await teardownTestDB();
});

describe("GET /api/recipes/detail/:slug manual nutrition", () => {
  it("returns admin-entered whole-recipe nutrition and custom nutrients", async () => {
    await Recipe.create({
      name: "Gà áp chảo",
      slug: "ga-ap-chao",
      ingredients: [{ name: "Ức gà", measure: "150g" }],
      nutrition: {
        calories: 361,
        protein: 42,
        fat: 12,
        carb: 18,
        sugars: 3.2,
        salt: 1.1,
        additional: [{ label: "Chất xơ", unit: "g", value: 4.5 }],
      },
      isPublished: true,
    });

    const response = await request(app).get("/api/recipes/detail/ga-ap-chao");

    expect(response.status).toBe(200);
    expect(response.body.data.nutrition).toEqual({
      status: "available",
      source: "admin_manual",
      scope: "whole_recipe",
      values: {
        calories: 361,
        protein: 42,
        fat: 12,
        carb: 18,
        sugars: 3.2,
        salt: 1.1,
      },
      additional: [{ label: "Chất xơ", unit: "g", value: 4.5 }],
    });
  });

  it("lets admin create all core values and rejects duplicate custom labels", async () => {
    const admin = await createTestUser({
      email: "recipe-nutrition-admin@example.com",
      role: "admin",
    });
    const payload = {
      name: "Món admin nhập",
      slug: "mon-admin-nhap",
      ingredients: [],
      instructions: [],
      nutrition: {
        calories: 500,
        protein: 30,
        fat: 20,
        carb: 45,
        sugars: 8,
        salt: 1.5,
        additional: [{ label: "Chất xơ", unit: "g", value: 6 }],
      },
    };

    const created = await withAuth(
      request(app).post("/api/recipes"),
      admin.accessToken,
    ).send(payload);
    const invalid = await withAuth(
      request(app).post("/api/recipes"),
      admin.accessToken,
    ).send({
      ...payload,
      slug: "mon-admin-khong-hop-le",
      nutrition: {
        ...payload.nutrition,
        additional: [{ label: "Đạm", unit: "g", value: 5 }],
      },
    });

    expect(created.status).toBe(201);
    expect(created.body.data.nutrition).toMatchObject({
      source: "admin_manual",
      calories: 500,
      sugars: 8,
      additional: [{ label: "Chất xơ", unit: "g", value: 6 }],
    });
    expect(invalid.status).toBe(400);
  });

  it("does not fall back to ingredient estimation for legacy recipes", async () => {
    await Recipe.create({
      name: "Món cũ",
      slug: "mon-cu",
      ingredients: [{ name: "Ức gà", measure: "150g" }],
      isPublished: true,
    });

    const response = await request(app).get("/api/recipes/detail/mon-cu");

    expect(response.body.data.nutrition).toEqual({
      status: "unavailable",
      source: "admin_manual",
      scope: "whole_recipe",
      values: {},
      additional: [],
    });
  });

  it("accepts 60 additional nutrients and rejects the 61st", async () => {
    const admin = await createTestUser({
      email: "recipe-nutrition-limit-admin@example.com",
      role: "admin",
    });
    const additional = Array.from({ length: 60 }, (_, index) => ({
      label: `Vi chất ${index + 1}`,
      unit: "mcg",
      value: index / 10,
    }));
    const nutrition = {
      calories: 500,
      protein: 30,
      fat: 20,
      carb: 45,
      sugars: 8,
      salt: 1.5,
      additional,
    };

    const accepted = await withAuth(
      request(app).post("/api/recipes"),
      admin.accessToken,
    ).send({
      name: "Món đủ vi chất",
      slug: "mon-du-vi-chat",
      nutrition,
    });
    const rejected = await withAuth(
      request(app).post("/api/recipes"),
      admin.accessToken,
    ).send({
      name: "Món quá giới hạn",
      slug: "mon-qua-gioi-han",
      nutrition: {
        ...nutrition,
        additional: [
          ...additional,
          { label: "Vi chất 61", unit: "mg", value: 1 },
        ],
      },
    });

    expect(accepted.status).toBe(201);
    expect(accepted.body.data.nutrition.additional).toHaveLength(60);
    expect(rejected.status).toBe(400);
  });
});
