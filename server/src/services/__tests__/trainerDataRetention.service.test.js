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
  createTestUser,
  setupTestDB,
  teardownTestDB,
} from "../../__tests__/setup.js";
import TrainerSubscription from "../../models/TrainerSubscription.js";
import { buildTrainerRetentionDryRun } from "../trainerDataRetention.service.js";

beforeAll(async () => {
  await setupTestDB();
  await TrainerSubscription.init();
});

afterEach(async () => {
  await clearCollections();
});

afterAll(async () => {
  await teardownTestDB();
});

describe("trainer data retention candidates", () => {
  it("waits for the latest inactive subscription deadline", async () => {
    const actor = await createTestUser({
      email: "retention-window@example.com",
    });
    const now = new Date("2026-07-28T00:00:00.000Z");
    const past = new Date("2026-07-27T00:00:00.000Z");
    const future = new Date("2026-08-28T00:00:00.000Z");
    const base = {
      userId: actor.user._id,
      normalizedEmail: actor.user.email,
      planCode: "standard",
      planTitle: "Tiêu chuẩn",
      billingCycle: "month",
      amount: 200000,
      startDate: new Date("2025-01-01T00:00:00.000Z"),
      endDate: new Date("2025-02-01T00:00:00.000Z"),
      status: "expired",
      isActive: false,
      source: "legacy",
    };
    await TrainerSubscription.create([
      {
        ...base,
        mediaRetentionExpiresAt: past,
        structuredRetentionExpiresAt: past,
      },
      {
        ...base,
        mediaRetentionExpiresAt: future,
        structuredRetentionExpiresAt: future,
      },
    ]);

    const beforeLatestDeadline = await buildTrainerRetentionDryRun({ now });
    expect(beforeLatestDeadline.media.trainerIds).toEqual([]);
    expect(beforeLatestDeadline.structured.trainerIds).toEqual([]);

    await TrainerSubscription.updateMany(
      { userId: actor.user._id },
      {
        $set: {
          mediaRetentionExpiresAt: past,
          structuredRetentionExpiresAt: past,
        },
      },
    );
    const afterLatestDeadline = await buildTrainerRetentionDryRun({ now });
    expect(afterLatestDeadline.media.trainerIds).toEqual([
      actor.user._id.toString(),
    ]);
    expect(afterLatestDeadline.structured.trainerIds).toEqual([
      actor.user._id.toString(),
    ]);
  });

  it("fails closed when an inactive subscription has no deadline", async () => {
    const actor = await createTestUser({
      email: "retention-missing-deadline@example.com",
    });
    const now = new Date("2026-07-28T00:00:00.000Z");
    const past = new Date("2026-07-27T00:00:00.000Z");
    const base = {
      userId: actor.user._id,
      normalizedEmail: actor.user.email,
      planCode: "standard",
      planTitle: "Tiêu chuẩn",
      billingCycle: "month",
      amount: 200000,
      startDate: new Date("2025-01-01T00:00:00.000Z"),
      endDate: new Date("2025-02-01T00:00:00.000Z"),
      status: "expired",
      isActive: false,
      source: "legacy",
    };
    await TrainerSubscription.create([
      {
        ...base,
        mediaRetentionExpiresAt: past,
        structuredRetentionExpiresAt: past,
      },
      base,
    ]);

    const result = await buildTrainerRetentionDryRun({ now });
    expect(result.media.trainerIds).toEqual([]);
    expect(result.structured.trainerIds).toEqual([]);
  });
});
