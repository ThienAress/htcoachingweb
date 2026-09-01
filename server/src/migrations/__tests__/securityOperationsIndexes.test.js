import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { setupTestDB, teardownTestDB } from "../../__tests__/setup.js";
import AccountDeletionMediaJob from "../../models/AccountDeletionMediaJob.js";
import AccountDeletionRecord from "../../models/AccountDeletionRecord.js";
import PracticeEmailDelivery from "../../models/PracticeEmailDelivery.js";
import TrainerTransfer from "../../models/TrainerTransfer.js";
import {
  applySecurityOperationsIndexes,
  authorizeSecurityOperationsIndexTarget,
  getSecurityOperationsIndexContracts,
  inspectSecurityOperationsIndexes,
} from "../20260828-security-operations-indexes.js";

const MODELS = [
  TrainerTransfer,
  AccountDeletionRecord,
  AccountDeletionMediaJob,
  PracticeEmailDelivery,
];

describe("Security operations index migration", () => {
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

  afterAll(async () => {
    await teardownTestDB();
  });

  test("derives every required index from model schemas", () => {
    expect(
      getSecurityOperationsIndexContracts().map(({ name }) => name).sort(),
    ).toEqual([
      "account_deletion_actor_created",
      "account_deletion_media_status_retry",
      "practice_email_delivery_claim",
      "trainer_transfer_client_created",
      "trainer_transfer_from_created",
      "trainer_transfer_to_created",
      "uniq_account_deletion_media_asset",
      "uniq_account_deletion_record",
      "uniq_practice_email_delivery_request",
      "uniq_trainer_transfer_request",
    ]);
  });

  test("creates missing indexes and remains idempotent", async () => {
    await Promise.all(MODELS.map((model) => model.collection.deleteMany({})));
    await Promise.all(MODELS.map((model) => model.collection.dropIndexes()));

    const first = await inspectSecurityOperationsIndexes();
    const created = await applySecurityOperationsIndexes(first);
    const second = await inspectSecurityOperationsIndexes();
    const rerun = await applySecurityOperationsIndexes(second);

    expect(created.filter(({ status }) => status === "created")).toHaveLength(10);
    expect(second.every(({ status }) => status === "present")).toBe(true);
    expect(rerun.filter(({ status }) => status === "unchanged")).toHaveLength(10);
  });

  test("detects duplicate transfer request ids and blocks apply", async () => {
    await TrainerTransfer.collection.deleteMany({});
    await TrainerTransfer.collection.dropIndexes();
    const now = new Date();
    const id = new mongoose.Types.ObjectId();
    const base = {
      requestId: "duplicate-request",
      clientId: id,
      fromTrainerId: new mongoose.Types.ObjectId(),
      toTrainerId: new mongoose.Types.ObjectId(),
      requestedBy: new mongoose.Types.ObjectId(),
      reason: "capacity rebalance",
      previewToken: "a".repeat(64),
      affected: {},
      retained: {},
      completedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    await TrainerTransfer.collection.insertMany([base, { ...base }]);

    const reports = await inspectSecurityOperationsIndexes();
    const requestIndex = reports.find(
      ({ contract }) => contract.name === "uniq_trainer_transfer_request",
    );
    expect(requestIndex.duplicateGroupCount).toBe(1);
    await expect(applySecurityOperationsIndexes(reports)).rejects.toThrow(
      "blocked by preflight findings",
    );
  });

  test("requires target lock and explicit apply confirmation", () => {
    const env = {
      APP_ENV: "staging",
      MONGO_URI: "mongodb://127.0.0.1:27017/htcoaching_staging",
      MIGRATION_TARGET_DATABASE: "htcoaching_staging",
      CONFIRM_SECURITY_OPERATIONS_INDEX_MIGRATION: "yes",
    };

    expect(() =>
      authorizeSecurityOperationsIndexTarget({
        args: new Set(["--target=staging", "--apply"]),
        apply: true,
        env,
      }),
    ).toThrow("Apply requires --confirm-security-operations-indexes");

    expect(
      authorizeSecurityOperationsIndexTarget({
        args: new Set([
          "--target=staging",
          "--apply",
          "--confirm-security-operations-indexes",
        ]),
        apply: true,
        env,
      }),
    ).toMatchObject({ valid: true, targetDatabase: "htcoaching_staging" });
  });
});
