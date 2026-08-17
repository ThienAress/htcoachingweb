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
import { consumeServiceUsage } from "../serviceUsageLedger.service.js";

beforeAll(setupTestDB);
afterEach(clearCollections);
afterAll(teardownTestDB);

describe("shared service usage ledger", () => {
  it("allows exactly the canonical limit under concurrent consumption", async () => {
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

    expect(results.filter((result) => result.allowed)).toHaveLength(3);
    expect(await ServiceUsageBucket.countDocuments()).toBe(1);
    const bucket = await ServiceUsageBucket.findOne()
      .select("+operationHashes")
      .lean();
    expect(bucket.userId.toString()).toBe(user._id.toString());
    expect(bucket.count).toBe(3);
    expect(bucket.operationHashes).toHaveLength(3);
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

    expect([first.quota.remaining, replay.quota.remaining]).toEqual([4, 4]);
  });

  it("keeps an accepted AI request replayable after a later request is denied", async () => {
    const policy = getServiceAccessPolicy("ai_chat", "guest");
    const guestKey = randomBytes(32).toString("hex");
    const consume = (operationKey) =>
      consumeServiceUsage({
        serviceKey: "ai_chat",
        tier: "guest",
        policy,
        actor: { kind: "guest", guestKey },
        operationKey,
      });

    await consume("accepted-request");
    await Promise.all(
      Array.from({ length: policy.limit - 1 }, (_, index) =>
        consume(`fill-${index}`),
      ),
    );
    const denied = await consume("denied-request");
    const replay = await consume("accepted-request");

    expect([denied.allowed, replay.allowed]).toEqual([false, true]);
    expect(replay.quota.remaining).toBe(0);
    const bucket = await ServiceUsageBucket.findOne()
      .select("+operationHashes")
      .lean();
    expect(bucket.count).toBe(policy.limit);
    expect(bucket.operationHashes).toHaveLength(policy.limit);
  });

  it("starts a new bounded window after resetAt", async () => {
    const policy = getServiceAccessPolicy("meal_scan", "guest");
    const guestKey = randomBytes(32).toString("hex");
    const startedAt = new Date("2026-08-13T00:00:00.000Z");
    await consumeServiceUsage({
      serviceKey: "meal_scan",
      tier: "guest",
      policy,
      actor: { kind: "guest", guestKey },
      operationKey: "first-window",
      now: startedAt,
    });
    const nextWindow = await consumeServiceUsage({
      serviceKey: "meal_scan",
      tier: "guest",
      policy,
      actor: { kind: "guest", guestKey },
      operationKey: "next-window",
      now: new Date(startedAt.getTime() + policy.windowMs + 1),
    });

    expect(nextWindow).toMatchObject({
      allowed: true,
      quota: { limit: 2, remaining: 1 },
    });
  });

  it("declares TTL cleanup while deterministic _id provides uniqueness", () => {
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
  });
});
