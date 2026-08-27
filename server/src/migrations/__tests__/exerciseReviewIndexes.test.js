import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { setupTestDB, teardownTestDB } from "../../__tests__/setup.js";
import ExerciseReview from "../../models/ExerciseReview.js";
import {
  applyExerciseReviewIndexes,
  authorizeExerciseReviewIndexTarget,
  getExerciseReviewIndexContracts,
  inspectExerciseReviewIndexes,
} from "../20260827-exercise-review-indexes.js";

describe("Exercise review index migration", () => {
  beforeAll(async () => {
    await setupTestDB();
    await ExerciseReview.createCollection().catch((error) => {
      if (error?.codeName !== "NamespaceExists") throw error;
    });
    await ExerciseReview.init();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  test("derives both required indexes from the model schema", () => {
    expect(
      getExerciseReviewIndexContracts().map(({ name }) => name).sort(),
    ).toEqual([
      "exercise_reviews_exercise_created",
      "uniq_exercise_review_user",
    ]);
  });

  test("creates missing indexes and remains idempotent", async () => {
    await ExerciseReview.collection.deleteMany({});
    await ExerciseReview.collection.dropIndexes();

    const first = await inspectExerciseReviewIndexes();
    const created = await applyExerciseReviewIndexes(first);
    const second = await inspectExerciseReviewIndexes();
    const rerun = await applyExerciseReviewIndexes(second);

    expect(created.filter(({ status }) => status === "created")).toHaveLength(2);
    expect(second.every(({ status }) => status === "present")).toBe(true);
    expect(rerun.filter(({ status }) => status === "unchanged")).toHaveLength(2);
  });

  test("detects duplicate review ownership and blocks unique index apply", async () => {
    await ExerciseReview.collection.deleteMany({});
    await ExerciseReview.collection.dropIndexes();
    const exerciseId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const now = new Date();
    const base = {
      exerciseId,
      userId,
      rating: 5,
      comment: "",
      createdAt: now,
      updatedAt: now,
    };
    await ExerciseReview.collection.insertMany([base, { ...base }]);

    const reports = await inspectExerciseReviewIndexes();
    const uniqueIndex = reports.find(
      ({ contract }) => contract.name === "uniq_exercise_review_user",
    );
    expect(uniqueIndex.duplicateGroupCount).toBe(1);
    await expect(applyExerciseReviewIndexes(reports)).rejects.toThrow(
      "blocked by preflight findings",
    );
  });

  test("requires target lock and explicit apply confirmation", () => {
    const env = {
      APP_ENV: "staging",
      MONGO_URI: "mongodb://127.0.0.1:27017/htcoaching_staging",
      MIGRATION_TARGET_DATABASE: "htcoaching_staging",
      CONFIRM_EXERCISE_REVIEW_INDEX_MIGRATION: "yes",
    };

    expect(() =>
      authorizeExerciseReviewIndexTarget({
        args: new Set(["--target=staging", "--apply"]),
        apply: true,
        env,
      }),
    ).toThrow("Apply requires --confirm-exercise-review-indexes");

    expect(
      authorizeExerciseReviewIndexTarget({
        args: new Set([
          "--target=staging",
          "--apply",
          "--confirm-exercise-review-indexes",
        ]),
        apply: true,
        env,
      }),
    ).toMatchObject({ valid: true, targetDatabase: "htcoaching_staging" });
  });
});
