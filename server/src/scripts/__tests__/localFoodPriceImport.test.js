import { describe, expect, it } from "vitest";

import {
  LOCAL_FOOD_PRICE_OBSERVATIONS,
  LOCAL_PRICE_DATABASE,
  LOCAL_PRICE_MONGO_URI,
  classifyExistingObservation,
  validateLocalPriceTarget,
  validatePriceManifest,
} from "../localFoodPriceImport.js";

describe("local Food price manifest", () => {
  it("contains one supported retailer for every priced Food", () => {
    expect(() => validatePriceManifest()).not.toThrow();

    const sourcesByFood = new Map();
    for (const observation of LOCAL_FOOD_PRICE_OBSERVATIONS) {
      if (!sourcesByFood.has(observation.foodLabel)) {
        sourcesByFood.set(observation.foodLabel, new Set());
      }
      sourcesByFood.get(observation.foodLabel).add(observation.sourceKey);
    }

    expect(sourcesByFood.size).toBe(9);
    expect(
      [...sourcesByFood.values()].every((sources) => sources.size === 1),
    ).toBe(true);
  });

  it("uses positive integer grams/prices, valid promotions and one identity per Food/source/date", () => {
    const identities = LOCAL_FOOD_PRICE_OBSERVATIONS.map(
      ({ foodLabel, sourceKey, observedAt }) =>
        `${foodLabel}|${sourceKey}|${observedAt}`,
    );

    expect(new Set(identities).size).toBe(identities.length);
    for (const observation of LOCAL_FOOD_PRICE_OBSERVATIONS) {
      expect(Number.isInteger(observation.packGrams)).toBe(true);
      expect(observation.packGrams).toBeGreaterThan(0);
      expect(Number.isInteger(observation.regularPriceVnd)).toBe(true);
      expect(observation.regularPriceVnd).toBeGreaterThan(0);
      if (observation.promotionalPriceVnd !== null) {
        expect(Number.isInteger(observation.promotionalPriceVnd)).toBe(true);
        expect(observation.promotionalPriceVnd).toBeGreaterThan(0);
        expect(observation.promotionalPriceVnd).toBeLessThanOrEqual(
          observation.regularPriceVnd,
        );
      }
    }
  });

  it("rejects unsupported source hosts", () => {
    const invalid = LOCAL_FOOD_PRICE_OBSERVATIONS.map((item, index) =>
      index === 0
        ? { ...item, sourceUrl: "https://example.com/uc-ga-500g" }
        : item,
    );

    expect(() => validatePriceManifest(invalid)).toThrowError(
      expect.objectContaining({ code: "LOCAL_FOOD_PRICE_MANIFEST_INVALID" }),
    );
  });
});

describe("local Food price target guard", () => {
  it("accepts only localhost with the exact local database", () => {
    expect(LOCAL_PRICE_DATABASE).toBe("htcoaching_local");
    expect(validateLocalPriceTarget(LOCAL_PRICE_MONGO_URI)).toEqual({
      valid: true,
      errors: [],
    });
    expect(
      validateLocalPriceTarget(
        "mongodb://cluster.example/htcoaching_local?replicaSet=rs0",
      ).errors,
    ).toContain("LOCAL_FOOD_PRICE_HOST_REQUIRED");
    expect(
      validateLocalPriceTarget(
        "mongodb://127.0.0.1:27017/htcoaching_staging?replicaSet=rs0",
      ).errors,
    ).toContain("LOCAL_FOOD_PRICE_DATABASE_REQUIRED");
  });
});

describe("local Food price idempotency policy", () => {
  it("inserts missing observations, skips exact matches and rejects history drift", () => {
    const expected = LOCAL_FOOD_PRICE_OBSERVATIONS[0];
    expect(classifyExistingObservation(null, expected)).toBe("insert");
    expect(
      classifyExistingObservation(
        {
          packGrams: expected.packGrams,
          regularPriceVnd: expected.regularPriceVnd,
          promotionalPriceVnd: expected.promotionalPriceVnd,
          sourceUrl: expected.sourceUrl,
        },
        expected,
      ),
    ).toBe("skip");
    expect(() =>
      classifyExistingObservation(
        { ...expected, regularPriceVnd: expected.regularPriceVnd + 1 },
        expected,
      ),
    ).toThrowError(
      expect.objectContaining({ code: "LOCAL_FOOD_PRICE_HISTORY_DRIFT" }),
    );
  });
});
