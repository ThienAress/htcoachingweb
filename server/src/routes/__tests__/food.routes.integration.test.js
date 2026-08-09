import request from "supertest";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";

import {
  clearCollections,
  createTestApp,
  createTestUser,
  setupTestDB,
  teardownTestDB,
  withAuth,
} from "../../__tests__/setup.js";
import Food from "../../models/Food.js";
import foodRoutes from "../food.routes.js";

const VERIFIED_SOURCE = {
  type: "manual_verified",
  provider: "HTCOACHING",
  datasetVersion: "manual-2026-08",
  license: "proprietary-internal",
  attribution: "HTCOACHING manual nutrition review",
  verifiedAt: "2026-08-04T00:00:00.000Z",
};

const FOOD_PAYLOAD = {
  label: "Ức gà chín",
  protein: 31,
  carb: 0,
  fat: 3.6,
  calories: 165,
  nutritionBasis: "per_100g",
  source: VERIFIED_SOURCE,
};

describe("Food provenance contract", () => {
  let app;
  let adminToken;

  beforeAll(async () => {
    await setupTestDB();
    app = createTestApp();
    app.use("/api/foods", foodRoutes);
    await Food.init();
  });

  beforeEach(async () => {
    adminToken = (await createTestUser({
      email: "food-admin@example.test",
      role: "admin",
    })).accessToken;
  });

  afterEach(async () => {
    await clearCollections();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  test("loads legacy documents with explicit unknown provenance defaults", async () => {
    const legacy = await Food.create({
      label: "Cơm trắng legacy",
      protein: 2.7,
      carb: 28,
      fat: 0.3,
      calories: 130,
    });

    expect(legacy.toObject()).toMatchObject({
      nutritionBasis: "per_100g",
      source: { type: "legacy_unknown" },
    });
  });

  test("rejects a new Food record without provenance", async () => {
    const { source: _source, ...missingSource } = FOOD_PAYLOAD;
    const response = await withAuth(
      request(app).post("/api/foods").send(missingSource),
      adminToken,
    );

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("FOOD_SOURCE_REQUIRED");
  });

  test("creates a verified per-100-g Food record with provenance", async () => {
    const response = await withAuth(
      request(app).post("/api/foods").send(FOOD_PAYLOAD),
      adminToken,
    );

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      nutritionBasis: "per_100g",
      source: {
        type: "manual_verified",
        provider: "HTCOACHING",
        datasetVersion: "manual-2026-08",
        license: "proprietary-internal",
      },
    });
  });

  test("blocks macro edits on legacy data until provenance is supplied", async () => {
    const legacy = await Food.create({
      label: "Legacy macro",
      protein: 10,
      carb: 10,
      fat: 10,
      calories: 170,
    });
    const response = await withAuth(
      request(app).put(`/api/foods/${legacy._id}`).send({ protein: 20 }),
      adminToken,
    );

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("FOOD_SOURCE_REQUIRED");
  });

  test("rejects a batch when any new item has no source metadata", async () => {
    const response = await withAuth(
      request(app).post("/api/foods/batch").send({
        foods: [
          FOOD_PAYLOAD,
          {
            label: "Thiếu provenance",
            protein: 1,
            carb: 2,
            fat: 3,
          },
        ],
      }),
      adminToken,
    );

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("FOOD_SOURCE_REQUIRED");
  });

  test("does not merge Open Food Facts ODbL data into the Food collection", async () => {
    const response = await withAuth(
      request(app).post("/api/foods").send({
        ...FOOD_PAYLOAD,
        source: {
          type: "open_food_facts",
          provider: "Open Food Facts",
          externalId: "4006381333931",
          datasetVersion: "live-api",
          license: "ODbL 1.0",
          attribution: "Open Food Facts contributors",
          retrievedAt: "2026-08-04T00:00:00.000Z",
        },
      }),
      adminToken,
    );

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(await Food.countDocuments()).toBe(0);
  });
});
