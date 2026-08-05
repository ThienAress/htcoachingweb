import { afterEach, describe, expect, test, vi } from "vitest";

import {
  isValidGtin,
  lookupFoodReferenceByGtin,
} from "../foodReferenceLookup.service.js";

const jsonResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: vi.fn().mockResolvedValue(body),
});

const fdcFood = (overrides = {}) => ({
  fdcId: 123456,
  description: "Greek yogurt",
  brandOwner: "Example Dairy",
  gtinUpc: "036000291452",
  publicationDate: "2026-01-02",
  servingSize: 170,
  servingSizeUnit: "g",
  householdServingFullText: "1 cup",
  foodNutrients: [
    { nutrientNumber: "208", unitName: "KCAL", value: 100 },
    { nutrientNumber: "203", unitName: "G", value: 10 },
    { nutrientNumber: "205", unitName: "G", value: 4 },
    { nutrientNumber: "204", unitName: "G", value: 2 },
  ],
  ...overrides,
});

describe("food reference lookup", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  test("validates GTIN-8/12/13/14 check digits", () => {
    expect(isValidGtin("96385074")).toBe(true);
    expect(isValidGtin("036000291452")).toBe(true);
    expect(isValidGtin("4006381333931")).toBe(true);
    expect(isValidGtin("10012345000017")).toBe(true);
    expect(isValidGtin("4006381333932")).toBe(false);
    expect(isValidGtin("ABC-123")).toBe(false);
  });

  test("returns an exact USDA branded match normalized per 100 g", async () => {
    vi.stubEnv("FOOD_REFERENCE_LOOKUP_ENABLED", "true");
    vi.stubEnv("FDC_API_KEY", "test-key");
    vi.stubEnv("OPEN_FOOD_FACTS_ENABLED", "false");
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ foods: [fdcFood()] }),
    );

    const result = await lookupFoodReferenceByGtin("036000291452", {
      fetchImpl,
      now: () => new Date("2026-08-04T00:00:00.000Z"),
    });

    expect(result).toMatchObject({
      id: "usda_fdc-123456",
      gtin: "036000291452",
      label: "Greek yogurt",
      brand: "Example Dairy",
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
      },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toContain("api.nal.usda.gov/fdc/v1/foods/search");
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ method: "POST" });
  });

  test("falls back to an explicitly enabled Open Food Facts reference", async () => {
    vi.stubEnv("FOOD_REFERENCE_LOOKUP_ENABLED", "true");
    vi.stubEnv("FDC_API_KEY", "test-key");
    vi.stubEnv("OPEN_FOOD_FACTS_ENABLED", "true");
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ foods: [] }))
      .mockResolvedValueOnce(
        jsonResponse({
          status: 1,
          product: {
            code: "4006381333931",
            product_name: "Hazelnut wafer",
            brands: "Example Foods",
            serving_size: "30 g",
            last_modified_t: 1785715200,
            nutriments: {
              "energy-kcal_100g": 510,
              proteins_100g: 7.1,
              carbohydrates_100g: 61,
              fat_100g: 27,
            },
          },
        }),
      );

    const result = await lookupFoodReferenceByGtin("4006381333931", {
      fetchImpl,
      now: () => new Date("2026-08-04T00:00:00.000Z"),
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[1][0]).toContain(
      "world.openfoodfacts.org/api/v2/product/4006381333931.json",
    );
    expect(result).toMatchObject({
      id: "open_food_facts-4006381333931",
      nutritionBasis: "per_100g",
      calories: 510,
      source: {
        type: "open_food_facts",
        license: "ODbL 1.0",
        attribution: "Open Food Facts contributors",
      },
    });
  });

  test("does not return a reference when required per-100-g macros are missing", async () => {
    vi.stubEnv("FOOD_REFERENCE_LOOKUP_ENABLED", "true");
    vi.stubEnv("FDC_API_KEY", "test-key");
    vi.stubEnv("OPEN_FOOD_FACTS_ENABLED", "false");
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        foods: [
          fdcFood({
            foodNutrients: [
              { nutrientNumber: "208", unitName: "KCAL", value: 100 },
              { nutrientNumber: "203", unitName: "G", value: 10 },
              { nutrientNumber: "205", unitName: "G", value: 4 },
            ],
          }),
        ],
      }),
    );

    await expect(
      lookupFoodReferenceByGtin("036000291452", { fetchImpl }),
    ).resolves.toBeNull();
  });

  test("never calls a provider when external lookup is disabled", async () => {
    vi.stubEnv("FOOD_REFERENCE_LOOKUP_ENABLED", "false");
    const fetchImpl = vi.fn();

    await expect(
      lookupFoodReferenceByGtin("036000291452", { fetchImpl }),
    ).rejects.toMatchObject({
      code: "FOOD_REFERENCE_LOOKUP_DISABLED",
      status: 503,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test("returns a generic provider error without exposing upstream details", async () => {
    vi.stubEnv("FOOD_REFERENCE_LOOKUP_ENABLED", "true");
    vi.stubEnv("FDC_API_KEY", "test-key");
    vi.stubEnv("OPEN_FOOD_FACTS_ENABLED", "true");
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 503))
      .mockRejectedValueOnce(new Error("sensitive upstream URL"));

    await expect(
      lookupFoodReferenceByGtin("036000291452", { fetchImpl }),
    ).rejects.toMatchObject({
      code: "FOOD_REFERENCE_PROVIDER_UNAVAILABLE",
      status: 503,
      message: "Không thể tra cứu dữ liệu sản phẩm lúc này",
    });
  });
});
