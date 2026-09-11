import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { setupTestDB, teardownTestDB } from "../../__tests__/setup.js";
import BodyAssessment from "../../models/BodyAssessment.js";
import BodyAssessmentCommand from "../../models/BodyAssessmentCommand.js";
import BodyAssessmentRevision from "../../models/BodyAssessmentRevision.js";
import {
  applyBodyAssessmentIndexes,
  authorizeBodyAssessmentIndexTarget,
  getBodyAssessmentIndexContracts,
  inspectBodyAssessmentIndexes,
} from "../20260910-body-assessment-indexes.js";
import { inspectBodyAssessmentWriteIndexes } from "../../services/bodyAssessmentIndexReadiness.service.js";

const MODELS = [BodyAssessment, BodyAssessmentCommand, BodyAssessmentRevision];
const PERIOD_INDEX_NAME = "uniq_body_assessment_period";
const PERIOD_INDEX_KEYS = { clientId: 1, weekStartDateKey: 1 };

const dropIndexIfPresent = async (collection, name) => {
  try {
    await collection.dropIndex(name);
  } catch (error) {
    if (error?.code !== 27 && error?.codeName !== "IndexNotFound") throw error;
  }
};

const restorePeriodIndex = async (...extraNames) => {
  await Promise.all(
    [PERIOD_INDEX_NAME, ...extraNames].map((name) =>
      dropIndexIfPresent(BodyAssessment.collection, name),
    ),
  );
  await BodyAssessment.collection.createIndex(PERIOD_INDEX_KEYS, {
    unique: true,
    name: PERIOD_INDEX_NAME,
  });
};

describe("Body assessment index migration", () => {
  beforeAll(async () => {
    await setupTestDB();
    await Promise.all(
      MODELS.map((model) =>
        model.createCollection().catch((error) => {
          if (error?.codeName !== "NamespaceExists") throw error;
        }),
      ),
    );
    await Promise.all(MODELS.map((model) => model.init()));
  });

  afterAll(teardownTestDB);

  test("derives every required index from model schemas", () => {
    expect(getBodyAssessmentIndexContracts().map(({ name }) => name).sort()).toEqual([
      "body_assessment_client_history",
      "body_assessment_client_receipts",
      "body_assessment_published_history",
      "body_assessment_retention_candidates",
      "uniq_body_assessment_command",
      "uniq_body_assessment_period",
      "uniq_body_assessment_revision",
    ]);
  });

  test("creates missing indexes and remains idempotent", async () => {
    await Promise.all(MODELS.map((model) => model.collection.deleteMany({})));
    await Promise.all(MODELS.map((model) => model.collection.dropIndexes()));

    const first = await inspectBodyAssessmentIndexes();
    const created = await applyBodyAssessmentIndexes(first);
    const second = await inspectBodyAssessmentIndexes();
    const rerun = await applyBodyAssessmentIndexes(second);

    expect(created.filter(({ status }) => status === "created")).toHaveLength(7);
    expect(second.every(({ status }) => status === "present")).toBe(true);
    expect(rerun.filter(({ status }) => status === "unchanged")).toHaveLength(7);
  });

  test("accepts an equivalent unique index with a legacy name everywhere", async () => {
    const legacyName = "clientId_1_weekStartDateKey_1";
    await dropIndexIfPresent(BodyAssessment.collection, PERIOD_INDEX_NAME);
    await BodyAssessment.collection.createIndex(PERIOD_INDEX_KEYS, {
      unique: true,
      name: legacyName,
    });

    try {
      const migrationReport = (await inspectBodyAssessmentIndexes()).find(
        ({ contract }) => contract.name === PERIOD_INDEX_NAME,
      );
      const readinessReport = (await inspectBodyAssessmentWriteIndexes()).find(
        ({ name }) => name === PERIOD_INDEX_NAME,
      );

      expect(migrationReport.status).toBe("present");
      expect(readinessReport.ready).toBe(true);
    } finally {
      await restorePeriodIndex(legacyName);
    }
  });

  test.each([
    ["partial", { partialFilterExpression: { clientId: { $exists: true } } }],
    ["sparse", { sparse: true }],
  ])(
    "rejects a %s unique index with matching name and keys everywhere",
    async (_variant, incompatibleOptions) => {
      await dropIndexIfPresent(BodyAssessment.collection, PERIOD_INDEX_NAME);
      await BodyAssessment.collection.createIndex(PERIOD_INDEX_KEYS, {
        unique: true,
        name: PERIOD_INDEX_NAME,
        ...incompatibleOptions,
      });

      try {
        const migrationReport = (await inspectBodyAssessmentIndexes()).find(
          ({ contract }) => contract.name === PERIOD_INDEX_NAME,
        );
        const readinessReport = (await inspectBodyAssessmentWriteIndexes()).find(
          ({ name }) => name === PERIOD_INDEX_NAME,
        );

        expect(migrationReport.status).toBe("name_conflict");
        expect(readinessReport.ready).toBe(false);
      } finally {
        await restorePeriodIndex();
      }
    },
  );

  test("detects duplicate periods and blocks apply", async () => {
    await BodyAssessment.collection.deleteMany({});
    await BodyAssessment.collection.dropIndexes();
    const clientId = new mongoose.Types.ObjectId();
    const now = new Date();
    const base = {
      clientId,
      weekStartDateKey: "2026-09-07",
      revision: 1,
      draft: null,
      published: null,
      createdAt: now,
      updatedAt: now,
    };
    await BodyAssessment.collection.insertMany([base, { ...base }]);

    const reports = await inspectBodyAssessmentIndexes();
    const period = reports.find(
      ({ contract }) => contract.name === "uniq_body_assessment_period",
    );
    expect(period.duplicateGroupCount).toBe(1);
    await expect(applyBodyAssessmentIndexes(reports)).rejects.toThrow(
      "blocked by preflight findings",
    );
  });

  test("requires target lock and explicit apply confirmation", () => {
    const env = {
      APP_ENV: "staging",
      MONGO_URI: "mongodb://127.0.0.1:27017/htcoaching_staging",
      MIGRATION_TARGET_DATABASE: "htcoaching_staging",
      CONFIRM_BODY_ASSESSMENT_INDEX_MIGRATION: "yes",
    };

    expect(() =>
      authorizeBodyAssessmentIndexTarget({
        args: new Set(["--target=staging", "--apply"]),
        apply: true,
        env,
      }),
    ).toThrow("Apply requires --confirm-body-assessment-indexes");

    expect(
      authorizeBodyAssessmentIndexTarget({
        args: new Set([
          "--target=staging",
          "--apply",
          "--confirm-body-assessment-indexes",
        ]),
        apply: true,
        env,
      }),
    ).toMatchObject({ valid: true, targetDatabase: "htcoaching_staging" });
  });
});
