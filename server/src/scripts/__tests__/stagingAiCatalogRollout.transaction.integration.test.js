import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import Exercise from "../../models/Exercise.js";
import ExerciseReview from "../../models/ExerciseReview.js";
import Food from "../../models/Food.js";
import FoodPriceObservation from "../../models/FoodPriceObservation.js";
import { findReviewableExercise } from "../../services/exerciseReview.service.js";
import {
  PLAN_043_FIXTURE_KEY,
  STAGING_AI_CATALOG_EXERCISES,
  STAGING_AI_CATALOG_FOODS,
} from "../stagingAiCatalogRollout.contract.js";
import { createStagingAiCatalogSource } from "../stagingAiCatalogRollout.sourceContract.js";
import {
  applyStagingAiCatalogPlan,
  loadStagingAiCatalogState,
} from "../stagingAiCatalogRollout.mongo.js";
import { buildStagingAiCatalogPlan } from "../stagingAiCatalogRollout.plan.js";

const NOW = new Date("2026-09-18T08:00:00.000Z");
const foodId = (index) => new mongoose.Types.ObjectId(
  (index + 1).toString(16).padStart(24, "0"),
);
const unreviewedProfile = () => ({
  reviewStatus: "unreviewed",
  contains: [],
  mayContain: [],
  reviewedScopes: [],
  specificContains: [],
  sourceType: null,
  sourceUrl: "",
  reviewedAt: null,
});
const sourceExercises = () => STAGING_AI_CATALOG_EXERCISES.map(({ id, name }) => ({
  _id: id,
  name,
  muscleGroup: "Cơ ngực",
  description: "Bodyweight push-up không cần dụng cụ, phù hợp cho người mới bắt đầu.",
  videoUrl: "",
  imageUrl: "",
  instructions: [{
    title: "Chuẩn bị",
    description: "Giữ thân người thẳng và siết cơ trung tâm.",
  }],
  technicalDifficulty: {
    coordination: 0,
    stability: 0,
    mobility: 0,
    setup: 0,
    errorConsequence: 0,
    rationale: "Beginner bodyweight movement",
  },
}));
const sourceFoods = () => STAGING_AI_CATALOG_FOODS.map((entry, index) => ({
  _id: foodId(index + 10),
  label: entry.label,
  protein: entry.macroGroup === "protein" ? 31 : 2,
  carb: entry.macroGroup === "carb" ? 17 : 8,
  fat: entry.macroGroup === "fat" ? 15 : 1,
  calories: 100,
}));
const source = () => createStagingAiCatalogSource({
  exercises: sourceExercises(),
  foods: sourceFoods(),
});

describe("staging AI catalog real transaction", () => {
  let replSet;

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: "wiredTiger" },
    });
    await mongoose.connect(replSet.getUri("catalog_transaction"), {
      autoIndex: false,
      autoCreate: false,
    });
    for (const name of [
      Exercise.collection.name,
      ExerciseReview.collection.name,
      Food.collection.name,
      FoodPriceObservation.collection.name,
    ]) {
      await mongoose.connection.db.createCollection(name);
    }
    await Promise.all([
      mongoose.connection.collection(Exercise.collection.name)
        .createIndex({ name: 1 }, { unique: true }),
      mongoose.connection.collection(Food.collection.name)
        .createIndex({ label: 1 }, { unique: true }),
      mongoose.connection.collection(FoodPriceObservation.collection.name)
        .createIndex(
          { foodId: 1, sourceKey: 1, observedAt: 1 },
          { unique: true },
        ),
    ]);
  }, 120_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await replSet?.stop();
  });

  beforeEach(async () => {
    await Promise.all([
      Exercise.collection.deleteMany({}),
      ExerciseReview.collection.deleteMany({}),
      Food.collection.deleteMany({}),
      FoodPriceObservation.collection.deleteMany({}),
    ]);
    await Food.collection.insertMany(
      STAGING_AI_CATALOG_FOODS.map((entry, index) => ({
        _id: foodId(index),
        label: entry.label,
        protein: entry.macroGroup === "protein" ? 31 : 2,
        carb: entry.macroGroup === "carb" ? 17 : 8,
        fat: entry.macroGroup === "fat" ? 15 : 1,
        calories: 100,
        allergenProfile: unreviewedProfile(),
        _testCatalogFixture: {
          managed: true,
          key: PLAN_043_FIXTURE_KEY,
        },
      })),
    );
  });

  const syncPlan = async () => buildStagingAiCatalogPlan({
    operation: "sync",
    source: source(),
    target: await loadStagingAiCatalogState(),
    now: NOW,
  });

  it("commits and rolls back all six operation types atomically", async () => {
    const sync = await syncPlan();
    expect(sync.summary).toMatchObject({
      insertExercise: 5,
      updateFood: 3,
      insertPrice: 3,
    });
    await applyStagingAiCatalogPlan({ plan: sync });

    const rollback = buildStagingAiCatalogPlan({
      operation: "rollback",
      target: await loadStagingAiCatalogState(),
      now: NOW,
    });
    expect(rollback.summary).toMatchObject({
      deleteExercise: 5,
      restoreFood: 3,
      deletePrice: 3,
    });
    await applyStagingAiCatalogPlan({ plan: rollback });

    const [exerciseCount, foods, priceCount] = await Promise.all([
      Exercise.collection.countDocuments({}),
      Food.collection.find({}).toArray(),
      FoodPriceObservation.collection.countDocuments({}),
    ]);
    expect({
      exerciseCount,
      priceCount,
      restoredFoods: foods.filter((food) =>
        food.allergenProfile?.reviewStatus === "unreviewed" &&
        !food._stagingAiCatalogRollout).length,
    }).toEqual({ exerciseCount: 0, priceCount: 0, restoredFoods: 3 });
  });

  it("aborts every prior write when a later operation fails", async () => {
    const sync = await syncPlan();
    const operations = [
      ...sync.operations.slice(0, 7),
      { type: "synthetic_failure" },
    ];

    await expect(applyStagingAiCatalogPlan({
      plan: { ...sync, operations },
    })).rejects.toThrowError(/STAGING_AI_CATALOG_WRITE_OPERATION_INVALID/);

    const [exerciseCount, foods, priceCount] = await Promise.all([
      Exercise.collection.countDocuments({}),
      Food.collection.find({}).toArray(),
      FoodPriceObservation.collection.countDocuments({}),
    ]);
    expect({
      exerciseCount,
      priceCount,
      untouchedFoods: foods.filter((food) =>
        food.allergenProfile?.reviewStatus === "unreviewed" &&
        !food._stagingAiCatalogRollout).length,
    }).toEqual({ exerciseCount: 0, priceCount: 0, untouchedFoods: 3 });
  });

  it("does not create an orphan review while a managed exercise rolls back", async () => {
    await applyStagingAiCatalogPlan({ plan: await syncPlan() });
    const target = await loadStagingAiCatalogState();
    const rollback = buildStagingAiCatalogPlan({
      operation: "rollback",
      target,
      now: NOW,
    });
    const exerciseId = STAGING_AI_CATALOG_EXERCISES[0].id;
    const exerciseObjectId = new mongoose.Types.ObjectId(exerciseId);
    const userId = new mongoose.Types.ObjectId();

    const reviewAttempt = (async () => {
      if (await findReviewableExercise(exerciseId)) {
        await ExerciseReview.collection.insertOne({
          exerciseId: exerciseObjectId,
          userId,
          rating: 5,
          comment: "synthetic",
        });
      }
    })();
    await Promise.all([
      reviewAttempt,
      applyStagingAiCatalogPlan({ plan: rollback }),
    ]);

    expect(await ExerciseReview.collection.countDocuments({
      exerciseId: exerciseObjectId,
    }))
      .toBe(0);
  });
});
