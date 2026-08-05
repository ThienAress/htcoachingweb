import request from "supertest";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import {
  clearCollections,
  createTestApp,
  createTestUser,
  setupTestDB,
  teardownTestDB,
  withAuth,
} from "../../__tests__/setup.js";
import foodReferenceRoutes from "../foodReference.routes.js";
import { lookupFoodReferenceByGtin } from "../../services/foodReferenceLookup.service.js";

vi.mock("../../services/foodReferenceLookup.service.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, lookupFoodReferenceByGtin: vi.fn() };
});

const REFERENCE = {
  id: "usda_fdc-123456",
  gtin: "036000291452",
  label: "Greek yogurt",
  nutritionBasis: "per_100g",
  calories: 100,
  protein: 10,
  carb: 4,
  fat: 2,
  source: {
    type: "usda_fdc",
    provider: "USDA FoodData Central",
    externalId: "123456",
    datasetVersion: "2026-01-02",
    license: "CC0 1.0",
    attribution: "U.S. Department of Agriculture, Agricultural Research Service",
  },
};

describe("GET /api/food-references/barcode/:gtin", () => {
  let app;
  let accessToken;

  beforeAll(async () => {
    await setupTestDB();
    app = createTestApp();
    app.use("/api/food-references", foodReferenceRoutes);
  });

  beforeEach(async () => {
    accessToken = (await createTestUser()).accessToken;
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await clearCollections();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  test("requires authentication", async () => {
    const response = await request(app).get(
      "/api/food-references/barcode/036000291452",
    );

    expect(response.status).toBe(401);
    expect(lookupFoodReferenceByGtin).not.toHaveBeenCalled();
  });

  test("rejects a malformed or invalid GTIN before lookup", async () => {
    const response = await withAuth(
      request(app).get("/api/food-references/barcode/4006381333932"),
      accessToken,
    );

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("FOOD_REFERENCE_GTIN_INVALID");
    expect(lookupFoodReferenceByGtin).not.toHaveBeenCalled();
  });

  test("returns a private no-store external reference", async () => {
    lookupFoodReferenceByGtin.mockResolvedValueOnce(REFERENCE);
    const response = await withAuth(
      request(app).get("/api/food-references/barcode/036000291452"),
      accessToken,
    );

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.body).toEqual({ success: true, data: REFERENCE });
    expect(lookupFoodReferenceByGtin).toHaveBeenCalledWith("036000291452");
  });

  test("returns a stable not-found contract", async () => {
    lookupFoodReferenceByGtin.mockResolvedValueOnce(null);
    const response = await withAuth(
      request(app).get("/api/food-references/barcode/036000291452"),
      accessToken,
    );

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      success: false,
      code: "FOOD_REFERENCE_NOT_FOUND",
    });
  });
});
