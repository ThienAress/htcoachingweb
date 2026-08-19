import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { setupTestDB, teardownTestDB } from "../../__tests__/setup.js";
import FitnessPlusQuotaUsage from "../../models/FitnessPlusQuotaUsage.js";
import FitnessSubscription from "../../models/FitnessSubscription.js";
import {
  applyFitnessPlusIndexes,
  authorizeFitnessPlusIndexTarget,
  getFitnessPlusIndexContracts,
  inspectFitnessPlusIndexes,
} from "../20260817-fitness-plus-subscription-indexes.js";

describe("HT Fitness+ subscription index migration", () => {
  beforeAll(async () => {
    await setupTestDB();
    await Promise.all(
      [FitnessSubscription, FitnessPlusQuotaUsage].map((model) =>
        model.createCollection().catch((error) => {
          if (error?.codeName !== "NamespaceExists") throw error;
        }),
      ),
    );
    // Wait for Mongoose's automatic index build before tests intentionally
    // drop indexes, otherwise a slower runner can recreate one mid-test.
    await Promise.all(
      [FitnessSubscription, FitnessPlusQuotaUsage].map((model) => model.init()),
    );
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  test("derives every required index from the model schema", () => {
    expect(getFitnessPlusIndexContracts().map(({ name }) => name).sort()).toEqual(
      [
        "fitness_plus_quota_usage_ttl",
        "fitness_subscription_end_status",
        "fitness_subscription_user_status",
        "uniq_active_fitness_plus_subscription",
        "uniq_fitness_plus_purchase_request",
        "uniq_fitness_plus_quota_usage",
      ],
    );
  });

  test("creates missing indexes and is idempotent", async () => {
    await FitnessSubscription.collection.deleteMany({});
    await FitnessPlusQuotaUsage.collection.deleteMany({});
    await Promise.all(
      [FitnessSubscription, FitnessPlusQuotaUsage].map((model) =>
        model.collection.dropIndexes(),
      ),
    );

    const first = await inspectFitnessPlusIndexes();
    const created = await applyFitnessPlusIndexes(first);
    const second = await inspectFitnessPlusIndexes();
    const rerun = await applyFitnessPlusIndexes(second);

    expect(created.filter(({ status }) => status === "created")).toHaveLength(6);
    expect(second.every(({ status }) => status === "present")).toBe(true);
    expect(rerun.filter(({ status }) => status === "unchanged")).toHaveLength(6);
  });

  test("detects duplicate active subscriptions and blocks apply", async () => {
    await FitnessSubscription.collection.deleteMany({});
    await FitnessSubscription.collection.dropIndexes();
    const userId = new mongoose.Types.ObjectId();
    const now = new Date();
    const base = {
      userId,
      planCode: "fitness_plus_essential",
      planTitle: "Nền tảng",
      billingCycle: "month",
      source: "self_purchase",
      amount: 99_000,
      startDate: now,
      endDate: new Date(now.getTime() + 86_400_000),
      status: "active",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    await FitnessSubscription.collection.insertMany([base, { ...base }]);

    const reports = await inspectFitnessPlusIndexes();
    const activeIndex = reports.find(
      ({ contract }) =>
        contract.name === "uniq_active_fitness_plus_subscription",
    );
    expect(activeIndex.duplicateGroupCount).toBe(1);
    await expect(applyFitnessPlusIndexes(reports)).rejects.toThrow(
      "blocked by preflight findings",
    );
  });

  test("requires target lock and explicit apply confirmation", () => {
    const env = {
      APP_ENV: "staging",
      MONGO_URI: "mongodb://127.0.0.1:27017/htcoaching_staging",
      MIGRATION_TARGET_DATABASE: "htcoaching_staging",
      CONFIRM_FITNESS_PLUS_INDEX_MIGRATION: "yes",
    };

    expect(() =>
      authorizeFitnessPlusIndexTarget({
        args: new Set(["--target=staging", "--apply"]),
        apply: true,
        env,
      }),
    ).toThrow("Apply requires --confirm-fitness-plus-indexes");

    expect(
      authorizeFitnessPlusIndexTarget({
        args: new Set([
          "--target=staging",
          "--apply",
          "--confirm-fitness-plus-indexes",
        ]),
        apply: true,
        env,
      }),
    ).toMatchObject({ valid: true, targetDatabase: "htcoaching_staging" });

    expect(() =>
      authorizeFitnessPlusIndexTarget({
        args: new Set(["--target=staging"]),
        apply: false,
        env: { ...env, MIGRATION_TARGET_DATABASE: "wrong_database" },
      }),
    ).toThrow("database target lock failed");
  });
});
