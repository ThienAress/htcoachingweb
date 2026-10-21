import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { setupTestDB, teardownTestDB } from "../../__tests__/setup.js";
import FitnessSelfAssessment from "../../models/FitnessSelfAssessment.js";
import {
  applyFitnessSelfAssessmentIndexes,
  authorizeFitnessSelfAssessmentIndexTarget,
  getFitnessSelfAssessmentIndexContracts,
  inspectFitnessSelfAssessmentIndexes,
} from "../20261021-fitness-self-assessment-indexes.js";

describe("Fitness self-assessment index migration", () => {
  beforeAll(async () => {
    await setupTestDB();
    await FitnessSelfAssessment.createCollection().catch((error) => {
      if (error?.codeName !== "NamespaceExists") throw error;
    });
    // Chờ Mongoose dựng index tự động trước khi test cố ý xóa index.
    await FitnessSelfAssessment.init();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  test("derives every required index from the model schema", () => {
    expect(getFitnessSelfAssessmentIndexContracts().map(({ name }) => name).sort()).toEqual([
      "fitness_self_assessment_draft_unique",
      "fitness_self_assessment_user_status",
    ]);
  });

  test("creates missing indexes and is idempotent", async () => {
    await FitnessSelfAssessment.collection.deleteMany({});
    await FitnessSelfAssessment.collection.dropIndexes();

    const first = await inspectFitnessSelfAssessmentIndexes();
    const created = await applyFitnessSelfAssessmentIndexes(first);
    const second = await inspectFitnessSelfAssessmentIndexes();
    const rerun = await applyFitnessSelfAssessmentIndexes(second);

    expect(created.filter(({ status }) => status === "created")).toHaveLength(2);
    expect(second.every(({ status }) => status === "present")).toBe(true);
    expect(rerun.filter(({ status }) => status === "unchanged")).toHaveLength(2);
  });

  test("detects duplicate open drafts and blocks apply", async () => {
    await FitnessSelfAssessment.collection.deleteMany({});
    await FitnessSelfAssessment.collection.dropIndexes();
    const userId = new mongoose.Types.ObjectId();
    const now = new Date();
    const base = { userId, status: "draft", draftStep: 1, createdAt: now, updatedAt: now };
    await FitnessSelfAssessment.collection.insertMany([base, { ...base }]);

    const reports = await inspectFitnessSelfAssessmentIndexes();
    const draftIndex = reports.find(({ contract }) => contract.name === "fitness_self_assessment_draft_unique");
    expect(draftIndex.duplicateGroupCount).toBe(1);
    await expect(applyFitnessSelfAssessmentIndexes(reports)).rejects.toThrow("blocked by preflight findings");
  });

  test("requires target lock and explicit apply confirmation", () => {
    const env = {
      APP_ENV: "staging",
      MONGO_URI: "mongodb://127.0.0.1:27017/htcoaching_staging",
      MIGRATION_TARGET_DATABASE: "htcoaching_staging",
      CONFIRM_FITNESS_SELF_ASSESSMENT_INDEX_MIGRATION: "yes",
    };

    expect(() =>
      authorizeFitnessSelfAssessmentIndexTarget({
        args: new Set(["--target=staging", "--apply"]),
        apply: true,
        env,
      }),
    ).toThrow("Apply requires --confirm-fitness-self-assessment-indexes");

    expect(
      authorizeFitnessSelfAssessmentIndexTarget({
        args: new Set(["--target=staging", "--apply", "--confirm-fitness-self-assessment-indexes"]),
        apply: true,
        env,
      }),
    ).toMatchObject({ valid: true, targetDatabase: "htcoaching_staging" });

    expect(() =>
      authorizeFitnessSelfAssessmentIndexTarget({
        args: new Set(["--target=staging"]),
        apply: false,
        env: { ...env, MIGRATION_TARGET_DATABASE: "wrong_database" },
      }),
    ).toThrow("database target lock failed");
  });
});
