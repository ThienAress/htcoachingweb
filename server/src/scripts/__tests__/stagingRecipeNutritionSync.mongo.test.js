import mongoose from "mongoose";
import { describe, expect, it, vi } from "vitest";

import {
  applyStagingRecipeNutritionPlan,
} from "../stagingRecipeNutritionSync.js";
import { recipeNutritionTargetHash } from "../stagingRecipeNutritionSync.contract.js";

const currentTarget = () => ({
  _id: new mongoose.Types.ObjectId("000000000000000000000001"),
  slug: "vietnamese-style-veggie-hotpot",
  name: "Vietnamese Style Veggie Hotpot",
  nutrition: null,
  isPublished: true,
  _recipeCatalogFixture: {
    managed: true,
    key: "plan-058a-public-recipe-catalog",
  },
  updatedAt: new Date("2026-09-03T01:00:00.000Z"),
});

const nutrition = {
  scope: "whole_recipe",
  source: "admin_manual",
  calories: 520,
  protein: 42,
  fat: 18,
  carb: 48,
  sugars: 7,
  salt: 1.4,
  additional: [{ label: "Kali", unit: "g", value: 0.92 }],
};

const planFor = (target) => ({
  operations: [
    {
      id: String(target._id),
      slug: target.slug,
      expectedTargetHash: recipeNutritionTargetHash(target),
      nutrition,
    },
  ],
});

const harness = (target) => {
  const collection = {
    findOne: vi.fn().mockResolvedValue(target),
    updateOne: vi.fn().mockResolvedValue({
      acknowledged: true,
      matchedCount: 1,
      modifiedCount: 1,
    }),
  };
  const session = {
    withTransaction: vi.fn((callback) => callback()),
    endSession: vi.fn(),
  };
  const connection = {
    collection: vi.fn().mockReturnValue(collection),
    startSession: vi.fn().mockResolvedValue(session),
  };
  return { collection, session, connection };
};

describe("staging Recipe nutrition Mongo adapter", () => {
  it("updates only nutrition and updatedAt inside a transaction", async () => {
    const target = currentTarget();
    const { collection, session, connection } = harness(target);

    await applyStagingRecipeNutritionPlan({
      plan: planFor(target),
      connection,
    });

    const update = collection.updateOne.mock.calls[0][1];
    expect({
      setKeys: Object.keys(update.$set).sort(),
      nutrition: update.$set.nutrition,
      transactions: session.withTransaction.mock.calls.length,
      ended: session.endSession.mock.calls.length,
    }).toEqual({
      setKeys: ["nutrition", "updatedAt"],
      nutrition,
      transactions: 1,
      ended: 1,
    });
  });

  it("rejects target drift before update", async () => {
    const target = currentTarget();
    const { collection, connection } = harness({
      ...target,
      name: "Changed after preflight",
    });

    await expect(
      applyStagingRecipeNutritionPlan({
        plan: planFor(target),
        connection,
      }),
    ).rejects.toThrowError(/STAGING_RECIPE_NUTRITION_TARGET_DRIFT/);
    expect(collection.updateOne).not.toHaveBeenCalled();
  });
});
