import mongoose from "mongoose";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import {
  clearCollections,
  setupTestDB,
  teardownTestDB,
} from "../../__tests__/setup.js";
import FitnessPlusQuotaUsage from "../../models/FitnessPlusQuotaUsage.js";
import { FitnessPlusQuotaStore } from "../fitnessPlusQuotaStore.js";

beforeAll(async () => {
  await setupTestDB();
  await FitnessPlusQuotaUsage.init();
});
afterEach(clearCollections);
afterAll(teardownTestDB);

describe("FitnessPlusQuotaStore", () => {
  it("persists a rolling window across store instances", async () => {
    const userId = new mongoose.Types.ObjectId();
    let now = 1_000;
    const options = {
      serviceKey: "meal_scan",
      windowMs: 100,
      maxHits: 4,
      clock: () => now,
    };
    const firstStore = new FitnessPlusQuotaStore(options);
    const secondStore = new FitnessPlusQuotaStore(options);

    await firstStore.increment(userId);
    now = 1_050;
    await secondStore.increment(userId);
    now = 1_101;
    const result = await firstStore.increment(userId);

    expect(result).toEqual({
      totalHits: 2,
      resetTime: new Date(1_150),
    });
    const usage = await FitnessPlusQuotaUsage.findOne({ userId })
      .select("+timestamps +expiresAt")
      .lean();
    expect(usage.timestamps).toEqual([new Date(1_050), new Date(1_101)]);
    expect(usage.expiresAt).toEqual(new Date(1_201));
  });

  it("bounds blocked-request growth and supports reset operations", async () => {
    const userId = new mongoose.Types.ObjectId();
    const store = new FitnessPlusQuotaStore({
      serviceKey: "ai_chat",
      windowMs: 3_600_000,
      maxHits: 3,
      clock: () => 2_000,
    });

    await store.increment(userId);
    await store.increment(userId);
    await store.increment(userId);
    const capped = await store.increment(userId);
    expect(capped.totalHits).toBe(3);
    expect(
      await FitnessPlusQuotaUsage.findOne({ userId })
        .select("+timestamps")
        .then((usage) => usage.timestamps),
    ).toHaveLength(3);

    await store.decrement(userId);
    expect(
      await FitnessPlusQuotaUsage.findOne({ userId })
        .select("+timestamps")
        .then((usage) => usage.timestamps),
    ).toHaveLength(2);
    await store.resetKey(userId);
    expect(await FitnessPlusQuotaUsage.countDocuments({ userId })).toBe(0);
  });
});
