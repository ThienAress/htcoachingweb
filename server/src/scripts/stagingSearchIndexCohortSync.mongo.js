import mongoose from "mongoose";

import Exercise from "../models/Exercise.js";
import ExerciseReview from "../models/ExerciseReview.js";
import {
  PLAN_043_FIXTURE_KEY,
  STAGING_SEARCH_COHORT_FIXTURE_KEY,
  STAGING_SEARCH_COHORT_FIXTURE_VERSION,
  STAGING_SEARCH_INDEX_EXERCISES,
  exercisePayloadHash,
  stagingSearchCohortError,
} from "./stagingSearchIndexCohortSync.contract.js";

const objectIds = () =>
  STAGING_SEARCH_INDEX_EXERCISES.map(
    ({ id }) => new mongoose.Types.ObjectId(id),
  );

const assertExerciseNameUniqueIndex = async (collection) => {
  const indexes = await collection.indexes();
  const hasUniqueNameIndex = indexes.some(
    (index) =>
      index.unique === true &&
      index.key?.name === 1 &&
      Object.keys(index.key).length === 1,
  );
  if (!hasUniqueNameIndex) {
    throw stagingSearchCohortError(
      "STAGING_SEARCH_COHORT_UNIQUE_NAME_INDEX_REQUIRED",
    );
  }
};

export const loadStagingSearchIndexCohortState = async ({
  connection = mongoose.connection,
} = {}) => {
  const exercises = connection.collection(Exercise.collection.name);
  await assertExerciseNameUniqueIndex(exercises);
  const ids = objectIds();
  const names = STAGING_SEARCH_INDEX_EXERCISES.map(({ name }) => name);
  const targetExercises = await exercises
    .find({
      $or: [
        { _id: { $in: ids } },
        { name: { $in: names } },
        {
          "_stagingSearchIndexCohortFixture.key":
            STAGING_SEARCH_COHORT_FIXTURE_KEY,
        },
        {
          "_stagingSearchIndexCohortDisplaced.key":
            STAGING_SEARCH_COHORT_FIXTURE_KEY,
        },
        { name: { $regex: /^__plan079_displaced__/ } },
      ],
    })
    .toArray();
  const reviewRows = await connection
    .collection(ExerciseReview.collection.name)
    .aggregate([
      { $match: { exerciseId: { $in: ids } } },
      { $group: { _id: "$exerciseId", count: { $sum: 1 } } },
    ])
    .toArray();
  return {
    targetExercises,
    reviewCounts: Object.fromEntries(
      reviewRows.map(({ _id, count }) => [String(_id), count]),
    ),
  };
};

const withoutId = (document) => {
  const { _id: _ignored, ...fields } = document;
  return fields;
};

const assertUpdate = (result, code) => {
  if (
    result.acknowledged !== true ||
    result.matchedCount !== 1 ||
    result.modifiedCount !== 1
  ) {
    throw stagingSearchCohortError(code);
  }
};

const hasExpectedPayload = (exercise, expectedHash) => {
  try {
    return exercisePayloadHash(exercise) === expectedHash;
  } catch {
    return false;
  }
};

const applyOperation = async ({
  operation,
  exerciseCollection,
  reviewCollection,
  session,
}) => {
  const id = new mongoose.Types.ObjectId(operation.id);
  if (operation.type === "displace") {
    const result = await exerciseCollection.updateOne(
      {
        _id: id,
        name: operation.expectedName,
        "_testCatalogFixture.managed": true,
        "_testCatalogFixture.key": PLAN_043_FIXTURE_KEY,
        _stagingSearchIndexCohortDisplaced: { $exists: false },
      },
      {
        $set: {
          name: operation.displacedName,
          _stagingSearchIndexCohortDisplaced: operation.marker,
        },
        $unset: { _testCatalogFixture: "" },
      },
      { session },
    );
    return assertUpdate(result, "STAGING_SEARCH_COHORT_DISPLACE_STALE");
  }
  if (operation.type === "insert") {
    const result = await exerciseCollection.insertOne(
      { ...operation.document, _id: id },
      { session },
    );
    if (
      result.acknowledged !== true ||
      String(result.insertedId) !== operation.id
    ) {
      throw stagingSearchCohortError(
        "STAGING_SEARCH_COHORT_INSERT_FAILED",
      );
    }
    return;
  }
  if (operation.type === "update") {
    const fixtureFilter = {
      _id: id,
      "_stagingSearchIndexCohortFixture.managed": true,
      "_stagingSearchIndexCohortFixture.key":
        STAGING_SEARCH_COHORT_FIXTURE_KEY,
      "_stagingSearchIndexCohortFixture.sourceHash":
        operation.expectedSourceHash,
    };
    const current = await exerciseCollection.findOne(fixtureFilter, { session });
    if (!current || !hasExpectedPayload(current, operation.expectedSourceHash)) {
      throw stagingSearchCohortError(
        "STAGING_SEARCH_COHORT_TARGET_CONTENT_DRIFT",
      );
    }
    const result = await exerciseCollection.updateOne(
      fixtureFilter,
      { $set: withoutId(operation.document) },
      { session },
    );
    return assertUpdate(result, "STAGING_SEARCH_COHORT_UPDATE_STALE");
  }
  if (operation.type === "delete") {
    const fixtureFilter = {
      _id: id,
      "_stagingSearchIndexCohortFixture.managed": true,
      "_stagingSearchIndexCohortFixture.key":
        STAGING_SEARCH_COHORT_FIXTURE_KEY,
      "_stagingSearchIndexCohortFixture.sourceHash":
        operation.expectedSourceHash,
    };
    const reviewCount = await reviewCollection.countDocuments(
      { exerciseId: id },
      { session },
    );
    if (reviewCount > 0) {
      throw stagingSearchCohortError(
        "STAGING_SEARCH_COHORT_ROLLBACK_REVIEWS_EXIST",
      );
    }
    const current = await exerciseCollection.findOne(fixtureFilter, {
      session,
    });
    if (!current || !hasExpectedPayload(current, operation.expectedSourceHash)) {
      throw stagingSearchCohortError(
        "STAGING_SEARCH_COHORT_ROLLBACK_CONTENT_DRIFT",
      );
    }
    const result = await exerciseCollection.deleteOne(
      fixtureFilter,
      { session },
    );
    if (result.acknowledged !== true || result.deletedCount !== 1) {
      throw stagingSearchCohortError(
        "STAGING_SEARCH_COHORT_DELETE_STALE",
      );
    }
    return;
  }
  if (operation.type === "restore") {
    const setFields = { name: operation.originalName };
    if (operation.originalTestCatalogFixture) {
      setFields._testCatalogFixture = operation.originalTestCatalogFixture;
    }
    const unsetFields = { _stagingSearchIndexCohortDisplaced: "" };
    if (!operation.originalTestCatalogFixture) {
      unsetFields._testCatalogFixture = "";
    }
    const result = await exerciseCollection.updateOne(
      {
        _id: id,
        name: operation.displacedName,
        "_stagingSearchIndexCohortDisplaced.managed": true,
        "_stagingSearchIndexCohortDisplaced.key":
          STAGING_SEARCH_COHORT_FIXTURE_KEY,
        "_stagingSearchIndexCohortDisplaced.version":
          STAGING_SEARCH_COHORT_FIXTURE_VERSION,
        "_stagingSearchIndexCohortDisplaced.replacementId":
          operation.replacementId,
        "_stagingSearchIndexCohortDisplaced.originalName":
          operation.originalName,
        "_stagingSearchIndexCohortDisplaced.displacedName":
          operation.displacedName,
      },
      { $set: setFields, $unset: unsetFields },
      { session },
    );
    return assertUpdate(result, "STAGING_SEARCH_COHORT_RESTORE_STALE");
  }
  throw stagingSearchCohortError(
    "STAGING_SEARCH_COHORT_WRITE_OPERATION_INVALID",
  );
};

export const applyStagingSearchIndexCohortPlan = async ({
  plan,
  connection = mongoose.connection,
  startSession = () => connection.startSession(),
} = {}) => {
  const session = await startSession();
  try {
    await session.withTransaction(async () => {
      const exerciseCollection = connection.collection(
        Exercise.collection.name,
      );
      const reviewCollection = connection.collection(
        ExerciseReview.collection.name,
      );
      for (const operation of plan.operations) {
        await applyOperation({
          operation,
          exerciseCollection,
          reviewCollection,
          session,
        });
      }
    });
  } finally {
    await session.endSession();
  }
  return { appliedOperationCount: plan.operations.length };
};
