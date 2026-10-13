import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import {
  clearCollections,
  createTestApp,
  setupTestDB,
  teardownTestDB,
} from "../../__tests__/setup.js";
import Food from "../../models/Food.js";
import FoodPriceObservation from "../../models/FoodPriceObservation.js";
import foodRoutes from "../food.routes.js";

const baseFood = (label) => ({
  label,
  protein: 10,
  carb: 10,
  fat: 1,
  calories: 89,
  nutritionBasis: "per_100g",
});

describe("Public food list hardening", () => {
  let app;

  beforeAll(async () => {
    await setupTestDB();
    app = createTestApp();
    app.use("/api/foods", foodRoutes);
    await Promise.all([Food.init(), FoodPriceObservation.init()]);
  });

  afterEach(async () => {
    await clearCollections();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  test("treats regex metacharacters in search as literal text", async () => {
    await Food.create([baseFood("Gà (luộc)"), baseFood("Gà luộc")]);

    const literal = await request(app).get("/api/foods").query({ search: "(luộc)" });
    const malformed = await request(app).get("/api/foods").query({ search: "(a+" });

    expect(literal.status).toBe(200);
    expect(literal.body.data.map((food) => food.label)).toEqual(["Gà (luộc)"]);
    expect(malformed.status).toBe(200);
    expect(malformed.body.data).toEqual([]);
  });

  test("caps the page size and falls back to page 1 for invalid pages", async () => {
    await Food.create(
      Array.from({ length: 105 }, (_, index) => baseFood(`Food ${String(index).padStart(3, "0")}`)),
    );

    const oversized = await request(app).get("/api/foods").query({ limit: 5000 });
    const negativePage = await request(app).get("/api/foods").query({ page: -3, limit: 10 });

    expect(oversized.status).toBe(200);
    expect(oversized.body.data).toHaveLength(100);
    expect(oversized.body.pagination).toMatchObject({ limit: 100, total: 105, totalPages: 2 });
    expect(negativePage.status).toBe(200);
    expect(negativePage.body.pagination.page).toBe(1);
    expect(negativePage.body.data[0].label).toBe("Food 000");
  });

  test("still returns the full catalog for the meal planner", async () => {
    await Food.create(Array.from({ length: 105 }, (_, index) => baseFood(`Item ${index}`)));

    const response = await request(app).get("/api/foods").query({ all: "true" });

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(105);
  });
});
