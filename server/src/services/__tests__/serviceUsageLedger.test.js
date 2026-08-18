import { randomBytes } from "node:crypto";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  clearCollections,
  createTestUser,
  setupTestDB,
  teardownTestDB,
} from "../../__tests__/setup.js";
import { getServiceAccessPolicy } from "../../constants/serviceAccessPolicies.js";
import ServiceUsageBucket from "../../models/ServiceUsageBucket.js";
import {
  consumeServiceUsage,
  refundServiceUsage,
} from "../serviceUsageLedger.service.js";

beforeAll(setupTestDB);
afterEach(clearCollections);
afterAll(teardownTestDB);

const dualWindowPolicy = {
  mode: "quota",
  unitLabel: "lượt",
  windows: [
    {
      key: "daily",
      limit: 2,
      period: "rolling_day",
      periodLabel: "ngày",
      windowMs: 24 * 60 * 60 * 1000,
    },
    {
      key: "monthly",
      limit: 3,
      period: "rolling_30_days",
      periodLabel: "30 ngày",
      windowMs: 30 * 24 * 60 * 60 * 1000,
    },
  ],
};

describe("shared service usage ledger", () => {
  it("allows exactly one regular-user Meal Scan trial under concurrency", async () => {
    const { user } = await createTestUser({ email: "usage-race@example.com" });
    const policy = getServiceAccessPolicy("meal_scan", "user");
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        consumeServiceUsage({
          serviceKey: "meal_scan",
          tier: "user",
          policy,
          actor: { kind: "user", userId: user._id },
          operationKey: `scan-${index}`,
        }),
      ),
    );

    expect(results.filter((result) => result.allowed)).toHaveLength(1);
    const bucket = await ServiceUsageBucket.findOne()
      .select("+usageEvents +operationHashes")
      .lean();
    expect({ count: bucket.count, events: bucket.usageEvents.length }).toEqual({
      count: 1,
      events: 1,
    });
  });

  it("requires capacity in both daily and monthly windows", async () => {
    const { user } = await createTestUser({ email: "dual-window@example.com" });
    const actor = { kind: "user", userId: user._id };
    const startedAt = new Date("2026-08-01T00:00:00.000Z");
    const consume = (operationKey, now) =>
      consumeServiceUsage({
        serviceKey: "meal_scan",
        tier: "coaching_customer",
        policy: dualWindowPolicy,
        actor,
        operationKey,
        now,
      });

    const first = await consume("first", startedAt);
    const second = await consume("second", startedAt);
    const dailyDenied = await consume("daily-denied", startedAt);
    const nextDay = new Date(startedAt.getTime() + 24 * 60 * 60 * 1000 + 1);
    const third = await consume("third", nextDay);
    const monthlyDenied = await consume("monthly-denied", nextDay);

    expect([
      first.allowed,
      second.allowed,
      dailyDenied.allowed,
      third.allowed,
      monthlyDenied.allowed,
    ]).toEqual([true, true, false, true, false]);
    expect(monthlyDenied.quota).toMatchObject({
      limit: 3,
      remaining: 0,
      windows: [
        expect.objectContaining({ key: "daily", remaining: 1 }),
        expect.objectContaining({ key: "monthly", remaining: 0 }),
      ],
    });
  });

  it("does not consume an AI request twice when its requestId is replayed", async () => {
    const policy = getServiceAccessPolicy("ai_chat", "guest");
    const guestKey = randomBytes(32).toString("hex");
    const first = await consumeServiceUsage({
      serviceKey: "ai_chat",
      tier: "guest",
      policy,
      actor: { kind: "guest", guestKey },
      operationKey: "same-request-id",
    });
    const replay = await consumeServiceUsage({
      serviceKey: "ai_chat",
      tier: "guest",
      policy,
      actor: { kind: "guest", guestKey },
      operationKey: "same-request-id",
    });

    expect({
      remaining: [first.quota.remaining, replay.quota.remaining],
      consumed: [first.consumed, replay.consumed],
    }).toEqual({ remaining: [4, 4], consumed: [true, false] });
  });

  it("refunds one reservation idempotently after an upstream failure", async () => {
    const { user } = await createTestUser({ email: "usage-refund@example.com" });
    const policy = getServiceAccessPolicy("meal_scan", "user");
    const consumed = await consumeServiceUsage({
      serviceKey: "meal_scan",
      tier: "user",
      policy,
      actor: { kind: "user", userId: user._id },
      operationKey: "provider-timeout",
    });

    const firstRefund = await refundServiceUsage({
      reservation: consumed.reservation,
    });
    const secondRefund = await refundServiceUsage({
      reservation: consumed.reservation,
    });

    expect([firstRefund.remaining, secondRefund.remaining]).toEqual([1, 1]);
    expect((await ServiceUsageBucket.findOne().select("+usageEvents").lean()).usageEvents).toHaveLength(0);
  });

  it("does not reset a lifetime trial when time advances", async () => {
    const policy = getServiceAccessPolicy("meal_scan", "guest");
    const guestKey = randomBytes(32).toString("hex");
    const startedAt = new Date("2026-08-01T00:00:00.000Z");
    const first = await consumeServiceUsage({
      serviceKey: "meal_scan",
      tier: "guest",
      policy,
      actor: { kind: "guest", guestKey },
      operationKey: "first",
      now: startedAt,
    });
    const later = await consumeServiceUsage({
      serviceKey: "meal_scan",
      tier: "guest",
      policy,
      actor: { kind: "guest", guestKey },
      operationKey: "later",
      now: new Date("2027-08-01T00:00:00.000Z"),
    });

    expect([first.allowed, later.allowed, later.quota.resetAt]).toEqual([
      true,
      false,
      null,
    ]);
  });

  it("keeps deterministic uniqueness and TTL cleanup for finite windows", () => {
    const indexes = ServiceUsageBucket.schema.indexes();

    expect(indexes).toEqual(
      expect.arrayContaining([
        [
          { resetAt: 1 },
          expect.objectContaining({
            expireAfterSeconds: 0,
            name: "service_usage_expiry_ttl",
          }),
        ],
      ]),
    );
    expect(ServiceUsageBucket.schema.path("_id").instance).toBe("String");
    expect(ServiceUsageBucket.schema.path("usageEvents").instance).toBe("Array");
  });
});
