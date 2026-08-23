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
import FoodPriceObservation from "../../models/FoodPriceObservation.js";
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
  saturates: 1,
  sugars: 0,
  fibre: 0,
  salt: 0.2,
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
    await Promise.all([Food.init(), FoodPriceObservation.init()]);
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
      allergenProfile: {
        reviewStatus: "unreviewed",
        reviewedScopes: [],
        specificContains: [],
      },
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
      saturates: 1,
      sugars: 0,
      fibre: 0,
      salt: 0.2,
      source: {
        type: "manual_verified",
        provider: "HTCOACHING",
        datasetVersion: "manual-2026-08",
        license: "proprietary-internal",
      },
    });
  });

  test("stores reviewed allergen metadata and exposes fail-closed public metadata", async () => {
    const response = await withAuth(
      request(app).post("/api/foods").send({
        ...FOOD_PAYLOAD,
        label: "Bơ đậu phộng có nhãn",
        allergenProfile: {
          reviewStatus: "reviewed",
          contains: ["peanut"],
          mayContain: ["tree_nut"],
          sourceType: "package_label",
          sourceUrl: "https://example.com/label",
          reviewedAt: "2026-08-10T00:00:00.000Z",
        },
      }),
      adminToken,
    );

    expect(response.status).toBe(201);
    expect(response.body.data.allergenProfile).toMatchObject({
      reviewStatus: "reviewed",
      contains: ["peanut"],
      mayContain: ["tree_nut"],
    });
  });

  test("stores reviewed specific-food exclusion metadata", async () => {
    const response = await withAuth(
      request(app).post("/api/foods").send({
        ...FOOD_PAYLOAD,
        label: "Ức gà kiểm duyệt nhóm thịt",
        allergenProfile: {
          reviewStatus: "reviewed",
          contains: [],
          mayContain: [],
          reviewedScopes: ["specific_foods"],
          specificContains: ["chicken"],
          sourceType: "official_database",
          sourceUrl: "https://example.com/chicken",
          reviewedAt: "2026-08-10T00:00:00.000Z",
        },
      }),
      adminToken,
    );

    expect(response.status).toBe(201);
    expect(response.body.data.allergenProfile).toMatchObject({
      reviewedScopes: ["specific_foods"],
      specificContains: ["chicken"],
    });
  });

  test("rejects specific-food tags without reviewed scope", async () => {
    const response = await withAuth(
      request(app).post("/api/foods").send({
        ...FOOD_PAYLOAD,
        label: "Ức gà thiếu scope",
        allergenProfile: {
          reviewStatus: "reviewed",
          contains: [],
          mayContain: [],
          reviewedScopes: [],
          specificContains: ["chicken"],
          sourceType: "official_database",
          sourceUrl: "https://example.com/chicken",
          reviewedAt: "2026-08-10T00:00:00.000Z",
        },
      }),
      adminToken,
    );

    expect(response.status).toBe(400);
  });

  test("publishes a TP.HCM reference price from one fresh retailer source", async () => {
    const food = await Food.create({
      ...FOOD_PAYLOAD,
      label: "Ức gà có giá",
      allergenProfile: { reviewStatus: "unreviewed" },
    });
    const observedAt = new Date().toISOString();
    const created = await withAuth(
      request(app).post(`/api/foods/${food._id}/prices`).send({
        sourceKey: "bach_hoa_xanh",
        packGrams: 500,
        regularPriceVnd: 60_000,
        promotionalPriceVnd: null,
        sourceUrl: "https://www.bachhoaxanh.com/thit-ga/uc-ga",
        observedAt,
      }),
      adminToken,
    );
    const response = await request(app).get("/api/foods?all=true");

    expect(created.status).toBe(201);
    expect(response.body.data[0].marketPrice).toMatchObject({
      region: "ho_chi_minh",
      currency: "VND",
      lowVndPer100g: 12_000,
      typicalVndPer100g: 12_000,
      highVndPer100g: 12_000,
      sourceCount: 1,
      coverageStatus: "sufficient",
    });
  });

  test("rejects a price source outside the retailer allowlist", async () => {
    const food = await Food.create({ ...FOOD_PAYLOAD, label: "Giá sai nguồn" });
    const response = await withAuth(
      request(app).post(`/api/foods/${food._id}/prices`).send({
        sourceKey: "winmart",
        packGrams: 500,
        regularPriceVnd: 70_000,
        promotionalPriceVnd: null,
        sourceUrl: "https://attacker.example/price",
        observedAt: "2026-08-10T00:00:00.000Z",
      }),
      adminToken,
    );

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("FOOD_PRICE_SOURCE_INVALID");
  });

  test("does not count a manual label as an independent online retailer", async () => {
    const food = await Food.create({
      ...FOOD_PAYLOAD,
      label: "Giá manual không hợp lệ",
    });
    const response = await withAuth(
      request(app).post(`/api/foods/${food._id}/prices`).send({
        sourceKey: "manual_verified",
        packGrams: 500,
        regularPriceVnd: 70_000,
        promotionalPriceVnd: null,
        sourceUrl: "https://winmart.vn/products/uc-ga",
        observedAt: "2026-08-10T00:00:00.000Z",
      }),
      adminToken,
    );

    expect(response.status).toBe(400);
    expect(await FoodPriceObservation.countDocuments({ foodId: food._id })).toBe(
      0,
    );
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
