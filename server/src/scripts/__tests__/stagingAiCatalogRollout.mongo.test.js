import { describe, expect, it, vi } from "vitest";

import {
  STAGING_AI_CATALOG_ROLLOUT_KEY,
  STAGING_AI_CATALOG_ROLLOUT_VERSION,
  hashStagingAiCatalogPayload,
} from "../stagingAiCatalogRollout.contract.js";
import { applyStagingAiCatalogPlan } from "../stagingAiCatalogRollout.mongo.js";

const foodId = "000000000000000000000001";
const unreviewed = { reviewStatus: "unreviewed" };
const reviewed = {
  reviewStatus: "reviewed",
  contains: [],
  mayContain: [],
  reviewedScopes: [],
  specificContains: [],
  sourceType: "official_database",
  sourceUrl: "https://fdc.nal.usda.gov/food-search/?query=chicken",
  reviewedAt: new Date("2026-09-18T00:00:00.000Z"),
};
const fixture = { managed: true, key: "plan-043-public-test-catalog" };
const foodState = (overrides = {}) => ({
  _id: foodId,
  label: "Ức gà",
  protein: 31,
  carb: 0,
  fat: 3.6,
  calories: 165,
  allergenProfile: unreviewed,
  _testCatalogFixture: fixture,
  ...overrides,
});
const foodStateHash = (food) => hashStagingAiCatalogPayload({
  _id: String(food._id),
  label: food.label,
  protein: food.protein,
  carb: food.carb,
  fat: food.fat,
  calories: food.calories,
  allergenProfile: food.allergenProfile || null,
  testCatalogFixture: food._testCatalogFixture || null,
});

const session = () => ({
  withTransaction: vi.fn((callback) => callback()),
  endSession: vi.fn(),
});

const connectionFor = ({ food, reviewCount = 0 } = {}) => {
  const exerciseCollection = {
    findOne: vi.fn(),
    insertOne: vi.fn(),
    deleteOne: vi.fn(),
  };
  const foodCollection = {
    findOne: vi.fn().mockResolvedValue(food),
    updateOne: vi.fn().mockResolvedValue({
      acknowledged: true,
      matchedCount: 1,
      modifiedCount: 1,
    }),
  };
  const priceCollection = {
    findOne: vi.fn(),
    insertOne: vi.fn(),
    deleteOne: vi.fn(),
  };
  const reviewCollection = {
    countDocuments: vi.fn().mockResolvedValue(reviewCount),
  };
  const activeSession = session();
  const collections = {
    exercises: exerciseCollection,
    foods: foodCollection,
    foodpriceobservations: priceCollection,
    exercisereviews: reviewCollection,
  };
  return {
    collections,
    session: activeSession,
    connection: {
      startSession: vi.fn().mockResolvedValue(activeSession),
      collection: vi.fn((name) => collections[name]),
    },
  };
};

describe("staging AI catalog rollout Mongo adapter", () => {
  it("updates a Plan 043 food only inside one transaction", async () => {
    const food = foodState();
    const runtime = connectionFor({ food });
    await expect(applyStagingAiCatalogPlan({
      plan: {
        operations: [{
          type: "update_food",
          id: foodId,
          expectedStateHash: foodStateHash(food),
          expectedProfileHash: hashStagingAiCatalogPayload(unreviewed),
          allergenProfile: reviewed,
          marker: { managed: true, key: "plan-092-staging-ai-catalog" },
        }],
      },
      connection: runtime.connection,
    })).resolves.toEqual({ appliedOperationCount: 1 });

    expect(runtime.session.withTransaction).toHaveBeenCalledOnce();
    expect(runtime.collections.foods.updateOne).toHaveBeenCalledOnce();
    expect(runtime.session.endSession).toHaveBeenCalledOnce();
  });

  it("rejects food drift before issuing an update", async () => {
    const runtime = connectionFor({
      food: {
        _id: foodId,
        allergenProfile: { reviewStatus: "reviewed" },
        _testCatalogFixture: { managed: true, key: "plan-043-public-test-catalog" },
      },
    });
    await expect(applyStagingAiCatalogPlan({
      plan: {
        operations: [{
          type: "update_food",
          id: foodId,
          expectedProfileHash: hashStagingAiCatalogPayload(unreviewed),
          allergenProfile: reviewed,
          marker: { managed: true },
        }],
      },
      connection: runtime.connection,
    })).rejects.toThrowError(/STAGING_AI_CATALOG_FOOD_APPLY_DRIFT/);
    expect(runtime.collections.foods.updateOne).not.toHaveBeenCalled();
    expect(runtime.session.endSession).toHaveBeenCalledOnce();
  });

  it("rejects food identity drift even when the allergen profile is unchanged", async () => {
    const before = foodState();
    const runtime = connectionFor({
      food: foodState({ label: "Khoai tây bị đổi sau digest" }),
    });

    await expect(applyStagingAiCatalogPlan({
      plan: {
        operations: [{
          type: "update_food",
          id: foodId,
          expectedStateHash: foodStateHash(before),
          expectedProfileHash: hashStagingAiCatalogPayload(unreviewed),
          allergenProfile: reviewed,
          marker: { managed: true },
        }],
      },
      connection: runtime.connection,
    })).rejects.toThrowError(/STAGING_AI_CATALOG_FOOD_APPLY_DRIFT/);
    expect(runtime.collections.foods.updateOne).not.toHaveBeenCalled();
  });

  it("blocks exercise rollback when a review appears after preflight", async () => {
    const runtime = connectionFor({ reviewCount: 1 });
    runtime.collections.exercises.findOne.mockResolvedValue({
      _id: "6a4b4c41a5de82055378b184",
      _stagingAiCatalogRollout: {
        managed: true,
        key: "plan-092-staging-ai-catalog",
      },
    });
    await expect(applyStagingAiCatalogPlan({
      plan: {
        operations: [{
          type: "delete_exercise",
          id: "6a4b4c41a5de82055378b184",
          expectedHash: "a".repeat(64),
        }],
      },
      connection: runtime.connection,
    })).rejects.toThrowError(/STAGING_AI_CATALOG_EXERCISE_ROLLBACK_REFERENCED/);
    expect(runtime.collections.exercises.deleteOne).not.toHaveBeenCalled();
  });

  it("blocks rollback when an owned marker changes after the reviewed digest", async () => {
    const marker = {
      managed: true,
      key: STAGING_AI_CATALOG_ROLLOUT_KEY,
      version: STAGING_AI_CATALOG_ROLLOUT_VERSION,
      kind: "exercise",
      sourceKey: "6a4b4c41a5de82055378b184",
      sourceHash: "a".repeat(64),
      appliedHash: "a".repeat(64),
      priorState: { mode: "inserted" },
      priorStateHash: hashStagingAiCatalogPayload({ mode: "inserted" }),
      syncedAt: new Date("2026-09-18T00:00:00.000Z"),
    };
    const runtime = connectionFor({ reviewCount: 0 });
    runtime.collections.exercises.findOne.mockResolvedValue({
      _id: "6a4b4c41a5de82055378b184",
      name: "tampered",
      _stagingAiCatalogRollout: { ...marker, sourceKey: "tampered" },
    });

    await expect(applyStagingAiCatalogPlan({
      plan: {
        operations: [{
          type: "delete_exercise",
          id: "6a4b4c41a5de82055378b184",
          expectedHash: "a".repeat(64),
          expectedMarkerHash: hashStagingAiCatalogPayload(marker),
        }],
      },
      connection: runtime.connection,
    })).rejects.toThrowError(/STAGING_AI_CATALOG_EXERCISE_ROLLBACK_DRIFT/);
    expect(runtime.collections.exercises.deleteOne).not.toHaveBeenCalled();
  });
});
