import mongoose from "mongoose";

import Exercise from "../models/Exercise.js";
import ExerciseReview from "../models/ExerciseReview.js";
import Food from "../models/Food.js";
import FoodPriceObservation from "../models/FoodPriceObservation.js";
import {
  PLAN_043_FIXTURE_KEY,
  STAGING_AI_CATALOG_EXERCISES,
  STAGING_AI_CATALOG_FOODS,
  STAGING_AI_CATALOG_ROLLOUT_KEY,
  hashStagingAiCatalogPayload,
  stagingAiCatalogError,
} from "./stagingAiCatalogRollout.contract.js";
import { stagingAiCatalogHashes } from "./stagingAiCatalogRollout.integrity.js";

const objectId = (value) => new mongoose.Types.ObjectId(String(value));
const markerHash = (document) =>
  hashStagingAiCatalogPayload(document?._stagingAiCatalogRollout || null);

const assertUniqueIndex = async (collection, field, code) => {
  const indexes = await collection.indexes();
  if (!indexes.some((index) =>
    index.unique === true &&
    index.key?.[field] === 1 &&
    Object.keys(index.key).length === 1)) {
    throw stagingAiCatalogError(code);
  }
};

const assertPriceIdentityIndex = async (collection) => {
  const indexes = await collection.indexes();
  if (!indexes.some((index) =>
    index.unique === true &&
    index.key?.foodId === 1 &&
    index.key?.sourceKey === 1 &&
    index.key?.observedAt === 1 &&
    Object.keys(index.key).length === 3)) {
    throw stagingAiCatalogError("STAGING_AI_CATALOG_PRICE_UNIQUE_INDEX_REQUIRED");
  }
};

export const loadStagingAiCatalogState = async ({
  connection = mongoose.connection,
} = {}) => {
  const exercises = connection.collection(Exercise.collection.name);
  const foods = connection.collection(Food.collection.name);
  const prices = connection.collection(FoodPriceObservation.collection.name);
  await Promise.all([
    assertUniqueIndex(exercises, "name", "STAGING_AI_CATALOG_EXERCISE_UNIQUE_INDEX_REQUIRED"),
    assertUniqueIndex(foods, "label", "STAGING_AI_CATALOG_FOOD_UNIQUE_INDEX_REQUIRED"),
    assertPriceIdentityIndex(prices),
  ]);
  const exerciseIds = STAGING_AI_CATALOG_EXERCISES.map(({ id }) => objectId(id));
  const exerciseNames = STAGING_AI_CATALOG_EXERCISES.map(({ name }) => name);
  const foodLabels = STAGING_AI_CATALOG_FOODS.map(({ label }) => label);
  const [targetExercises, targetFoods] = await Promise.all([
    exercises.find({
      $or: [
        { _id: { $in: exerciseIds } },
        { name: { $in: exerciseNames } },
        { "_stagingAiCatalogRollout.key": STAGING_AI_CATALOG_ROLLOUT_KEY },
      ],
    }).toArray(),
    foods.find({
      $or: [
        { label: { $in: foodLabels } },
        { "_stagingAiCatalogRollout.key": STAGING_AI_CATALOG_ROLLOUT_KEY },
      ],
    }).toArray(),
  ]);
  const foodIds = targetFoods.map(({ _id }) => _id);
  const [priceObservations, reviewRows] = await Promise.all([
    prices.find({
      $or: [
        { foodId: { $in: foodIds } },
        { "_stagingAiCatalogRollout.key": STAGING_AI_CATALOG_ROLLOUT_KEY },
      ],
    }).toArray(),
    connection.collection(ExerciseReview.collection.name).aggregate([
      { $match: { exerciseId: { $in: exerciseIds } } },
      { $group: { _id: "$exerciseId", count: { $sum: 1 } } },
    ]).toArray(),
  ]);
  return {
    exercises: targetExercises,
    foods: targetFoods,
    priceObservations,
    exerciseReviewCounts: Object.fromEntries(
      reviewRows.map(({ _id, count }) => [String(_id), count]),
    ),
  };
};

const assertChanged = (result, code) => {
  if (result?.acknowledged !== true || result.matchedCount !== 1 ||
    result.modifiedCount !== 1) {
    throw stagingAiCatalogError(code);
  }
};

const assertDeleted = (result, code) => {
  if (result?.acknowledged !== true || result.deletedCount !== 1) {
    throw stagingAiCatalogError(code);
  }
};

const applyInsertExercise = async ({ operation, collection, session }) => {
  const _id = objectId(operation.id);
  const collision = await collection.findOne({
    $or: [{ _id }, { name: operation.document.name }],
  }, { session });
  if (collision) throw stagingAiCatalogError("STAGING_AI_CATALOG_EXERCISE_APPLY_COLLISION");
  const result = await collection.insertOne(
    { ...operation.document, _id },
    { session },
  );
  if (result?.acknowledged !== true || String(result.insertedId) !== operation.id) {
    throw stagingAiCatalogError("STAGING_AI_CATALOG_EXERCISE_INSERT_FAILED");
  }
};

const applyFoodUpdate = async ({ operation, collection, session }) => {
  const filter = {
    _id: objectId(operation.id),
    "_testCatalogFixture.managed": true,
    "_testCatalogFixture.key": PLAN_043_FIXTURE_KEY,
    _stagingAiCatalogRollout: { $exists: false },
  };
  const current = await collection.findOne(filter, { session });
  if (!current ||
    stagingAiCatalogHashes.foodState(current) !== operation.expectedStateHash ||
    hashStagingAiCatalogPayload(current.allergenProfile || null) !==
      operation.expectedProfileHash) {
    throw stagingAiCatalogError("STAGING_AI_CATALOG_FOOD_APPLY_DRIFT");
  }
  const result = await collection.updateOne(
    filter,
    { $set: {
      allergenProfile: operation.allergenProfile,
      _stagingAiCatalogRollout: operation.marker,
    } },
    { session },
  );
  assertChanged(result, "STAGING_AI_CATALOG_FOOD_UPDATE_STALE");
};

const applyInsertPrice = async ({ operation, collection, session }) => {
  const document = {
    ...operation.document,
    foodId: objectId(operation.document.foodId),
    observedAt: new Date(operation.document.observedAt),
  };
  const existing = await collection.findOne({
    foodId: document.foodId,
    sourceKey: document.sourceKey,
    observedAt: document.observedAt,
  }, { session });
  if (existing) throw stagingAiCatalogError("STAGING_AI_CATALOG_PRICE_APPLY_COLLISION");
  const timestamp = new Date(operation.document._stagingAiCatalogRollout.syncedAt);
  const result = await collection.insertOne({
    ...document,
    createdAt: timestamp,
    updatedAt: timestamp,
  }, { session });
  if (result?.acknowledged !== true) {
    throw stagingAiCatalogError("STAGING_AI_CATALOG_PRICE_INSERT_FAILED");
  }
};

const applyDeleteExercise = async ({ operation, exercise, review, session }) => {
  const _id = objectId(operation.id);
  if (await review.countDocuments({ exerciseId: _id }, { session }) > 0) {
    throw stagingAiCatalogError("STAGING_AI_CATALOG_EXERCISE_ROLLBACK_REFERENCED");
  }
  const filter = {
    _id,
    "_stagingAiCatalogRollout.managed": true,
    "_stagingAiCatalogRollout.key": STAGING_AI_CATALOG_ROLLOUT_KEY,
  };
  const current = await exercise.findOne(filter, { session });
  if (!current ||
    stagingAiCatalogHashes.exercise(current) !== operation.expectedHash ||
    markerHash(current) !== operation.expectedMarkerHash) {
    throw stagingAiCatalogError("STAGING_AI_CATALOG_EXERCISE_ROLLBACK_DRIFT");
  }
  assertDeleted(
    await exercise.deleteOne(filter, { session }),
    "STAGING_AI_CATALOG_EXERCISE_DELETE_STALE",
  );
};

const applyRestoreFood = async ({ operation, collection, session }) => {
  const filter = {
    _id: objectId(operation.id),
    "_stagingAiCatalogRollout.managed": true,
    "_stagingAiCatalogRollout.key": STAGING_AI_CATALOG_ROLLOUT_KEY,
  };
  const current = await collection.findOne(filter, { session });
  if (!current || stagingAiCatalogHashes.foodProfile(current) !==
    operation.expectedProfileHash ||
    markerHash(current) !== operation.expectedMarkerHash) {
    throw stagingAiCatalogError("STAGING_AI_CATALOG_FOOD_ROLLBACK_DRIFT");
  }
  assertChanged(
    await collection.updateOne(
      filter,
      {
        $set: { allergenProfile: operation.allergenProfile },
        $unset: { _stagingAiCatalogRollout: "" },
      },
      { session },
    ),
    "STAGING_AI_CATALOG_FOOD_RESTORE_STALE",
  );
};

const applyDeletePrice = async ({ operation, collection, session }) => {
  const filter = {
    _id: objectId(operation.id),
    "_stagingAiCatalogRollout.managed": true,
    "_stagingAiCatalogRollout.key": STAGING_AI_CATALOG_ROLLOUT_KEY,
  };
  const current = await collection.findOne(filter, { session });
  if (!current ||
    stagingAiCatalogHashes.price(current) !== operation.expectedHash ||
    markerHash(current) !== operation.expectedMarkerHash) {
    throw stagingAiCatalogError("STAGING_AI_CATALOG_PRICE_ROLLBACK_DRIFT");
  }
  assertDeleted(
    await collection.deleteOne(filter, { session }),
    "STAGING_AI_CATALOG_PRICE_DELETE_STALE",
  );
};

export const applyStagingAiCatalogPlan = async ({
  plan,
  connection = mongoose.connection,
  startSession = () => connection.startSession(),
} = {}) => {
  const session = await startSession();
  try {
    await session.withTransaction(async () => {
      const exercise = connection.collection(Exercise.collection.name);
      const food = connection.collection(Food.collection.name);
      const price = connection.collection(FoodPriceObservation.collection.name);
      const review = connection.collection(ExerciseReview.collection.name);
      for (const operation of plan.operations) {
        const context = { operation, session };
        if (operation.type === "insert_exercise") {
          await applyInsertExercise({ ...context, collection: exercise });
        } else if (operation.type === "update_food") {
          await applyFoodUpdate({ ...context, collection: food });
        } else if (operation.type === "insert_price") {
          await applyInsertPrice({ ...context, collection: price });
        } else if (operation.type === "delete_exercise") {
          await applyDeleteExercise({ ...context, exercise, review });
        } else if (operation.type === "restore_food") {
          await applyRestoreFood({ ...context, collection: food });
        } else if (operation.type === "delete_price") {
          await applyDeletePrice({ ...context, collection: price });
        } else {
          throw stagingAiCatalogError("STAGING_AI_CATALOG_WRITE_OPERATION_INVALID");
        }
      }
    });
  } finally {
    await session.endSession();
  }
  return { appliedOperationCount: plan.operations.length };
};
