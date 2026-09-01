import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";

import {
  clearCollections,
  createTestApp,
  createTestUser,
  setupTestDB,
  teardownTestDB,
  withAuth,
} from "../../__tests__/setup.js";
import fitnessPlusSubscriptionRoutes from "../../routes/fitnessPlusSubscription.routes.js";
import FitnessSubscription from "../../models/FitnessSubscription.js";
import Wallet from "../../models/Wallet.js";
import WalletTransaction from "../../models/WalletTransaction.js";
import {
  getFitnessPlusCatalogMeta,
  getFitnessPlusPlanAmount,
} from "../../services/fitnessPlusCatalog.service.js";

let app;

const postAs = (path, token, body = {}) =>
  withAuth(request(app).post(path).send(body), token);

const confirmedPurchaseBody = (planCode, billingCycle, requestId) => {
  const { catalogFingerprint, protocolVersion } = getFitnessPlusCatalogMeta();
  return {
    planCode,
    billingCycle,
    requestId,
    expectedAmount: getFitnessPlusPlanAmount(planCode, billingCycle),
    catalogFingerprint,
    protocolVersion,
  };
};

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/fitness-plus-subscriptions", fitnessPlusSubscriptionRoutes);
  await FitnessSubscription.init();
});

afterEach(clearCollections);
afterAll(teardownTestDB);

describe("HT Fitness+ subscription lifecycle", () => {
  it("serves the localized catalog without authentication", async () => {
    const response = await request(app).get(
      "/api/fitness-plus-subscriptions/catalog",
    );

    expect(response.status).toBe(200);
    expect(response.body.data.map((plan) => plan.title)).toEqual([
      "Nền tảng",
      "Tăng tốc",
      "Toàn diện",
    ]);
    expect(response.body.meta).toEqual({
      currency: "VND",
      catalogFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      protocolVersion: 1,
    });
  });

  it("charges the wallet atomically and exposes the active subscription", async () => {
    const actor = await createTestUser({ email: "fitness-plus-purchase@example.com" });
    await Wallet.create({ userId: actor.user._id, balance: 250000, version: 0 });

    const requestId = "22222222-2222-4222-8222-222222222222";
    const response = await postAs(
      "/api/fitness-plus-subscriptions/purchase",
      actor.accessToken,
      confirmedPurchaseBody("fitness_plus_smart", "month", requestId),
    );

    expect(response.status).toBe(201);
    expect(response.body.data.planCode).toBe("fitness_plus_smart");
    expect(response.body.data.newBalance).toBe(51000);
    expect(await FitnessSubscription.countDocuments({ userId: actor.user._id })).toBe(1);
    const stored = await FitnessSubscription.findOne({ userId: actor.user._id })
      .select("+entitlementPolicyVersion +entitlementPolicySnapshot")
      .lean();
    expect(stored).toMatchObject({
      entitlementPolicyVersion: "2026-08-28.1",
      entitlementPolicySnapshot: {
        meal_scan: expect.objectContaining({
          windows: [
            expect.objectContaining({ key: "daily", limit: 10 }),
            expect.objectContaining({ key: "monthly", limit: 210 }),
          ],
        }),
      },
    });
    expect(
      await WalletTransaction.countDocuments({
        userId: actor.user._id,
        referenceType: "fitness_subscription",
      }),
    ).toBe(1);

    const current = await withAuth(
      request(app).get("/api/fitness-plus-subscriptions/my"),
      actor.accessToken,
    );
    expect(current.status).toBe(200);
    expect(current.body.data).toMatchObject({
      planCode: "fitness_plus_smart",
      entitlements: { digitalTracking: true },
    });
    expect(current.body.data).not.toHaveProperty("purchaseRequestId");
    expect(current.body.data).not.toHaveProperty("entitlementPolicySnapshot");
  });

  it("replays a duplicate request without debiting the wallet twice", async () => {
    const actor = await createTestUser({ email: "fitness-plus-idempotency@example.com" });
    await Wallet.create({ userId: actor.user._id, balance: 150000, version: 0 });
    const body = confirmedPurchaseBody(
      "fitness_plus_essential",
      "month",
      "33333333-3333-4333-8333-333333333333",
    );

    const first = await postAs(
      "/api/fitness-plus-subscriptions/purchase",
      actor.accessToken,
      body,
    );
    const second = await postAs(
      "/api/fitness-plus-subscriptions/purchase",
      actor.accessToken,
      body,
    );

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.skipped).toBe(true);
    expect((await Wallet.findOne({ userId: actor.user._id })).balance).toBe(51000);
    expect(await FitnessSubscription.countDocuments({ userId: actor.user._id })).toBe(1);
  });

  it("fails closed on stale catalog or insufficient wallet before a new subscription is kept", async () => {
    const actor = await createTestUser({ email: "fitness-plus-failure@example.com" });
    await Wallet.create({ userId: actor.user._id, balance: 1000, version: 0 });
    const body = confirmedPurchaseBody(
      "fitness_plus_max",
      "month",
      "44444444-4444-4444-8444-444444444444",
    );

    body.catalogFingerprint = "a".repeat(64);
    const stale = await postAs(
      "/api/fitness-plus-subscriptions/purchase",
      actor.accessToken,
      body,
    );
    expect(stale.status).toBe(409);
    expect(await FitnessSubscription.countDocuments({ userId: actor.user._id })).toBe(0);

    const insufficient = await postAs(
      "/api/fitness-plus-subscriptions/purchase",
      actor.accessToken,
      confirmedPurchaseBody(
        "fitness_plus_max",
        "month",
        "55555555-5555-4555-8555-555555555555",
      ),
    );
    expect(insufficient.status).toBe(409);
    expect(insufficient.body.code).toBe("INSUFFICIENT_WALLET_BALANCE");
    expect(await FitnessSubscription.countDocuments({ userId: actor.user._id })).toBe(0);
  });

  it("supersedes the prior plan and rejects repurchasing the active plan", async () => {
    const actor = await createTestUser({ email: "fitness-plus-upgrade@example.com" });
    await Wallet.create({ userId: actor.user._id, balance: 500000, version: 0 });

    const first = await postAs(
      "/api/fitness-plus-subscriptions/purchase",
      actor.accessToken,
      confirmedPurchaseBody(
        "fitness_plus_essential",
        "month",
        "66666666-6666-4666-8666-666666666666",
      ),
    );
    const second = await postAs(
      "/api/fitness-plus-subscriptions/purchase",
      actor.accessToken,
      confirmedPurchaseBody(
        "fitness_plus_smart",
        "month",
        "77777777-7777-4777-8777-777777777777",
      ),
    );
    const repeatedPlan = await postAs(
      "/api/fitness-plus-subscriptions/purchase",
      actor.accessToken,
      confirmedPurchaseBody(
        "fitness_plus_smart",
        "month",
        "88888888-8888-4888-8888-888888888888",
      ),
    );

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(repeatedPlan).toMatchObject({
      status: 409,
      body: { code: "FITNESS_PLUS_PLAN_ALREADY_ACTIVE" },
    });
    const subscriptions = await FitnessSubscription.find({
      userId: actor.user._id,
    }).sort({ createdAt: 1 });
    expect(subscriptions).toHaveLength(2);
    expect(subscriptions[0]).toMatchObject({
      status: "superseded",
      isActive: false,
      supersededBy: subscriptions[1]._id,
    });
    expect(subscriptions[1]).toMatchObject({
      status: "active",
      isActive: true,
      previousSubscriptionId: subscriptions[0]._id,
    });
    expect((await Wallet.findOne({ userId: actor.user._id })).balance).toBe(
      202000,
    );
  });

  it("requires authentication and CSRF for checkout", async () => {
    const actor = await createTestUser({ email: "fitness-plus-csrf@example.com" });
    const body = confirmedPurchaseBody(
      "fitness_plus_essential",
      "month",
      "99999999-9999-4999-8999-999999999999",
    );

    const anonymous = await request(app)
      .post("/api/fitness-plus-subscriptions/purchase")
      .send(body);
    const missingCsrf = await request(app)
      .post("/api/fitness-plus-subscriptions/purchase")
      .set("Cookie", [`accessToken=${actor.accessToken}`])
      .send(body);

    expect(anonymous.status).toBe(401);
    expect(missingCsrf.status).toBe(403);
    expect(await FitnessSubscription.countDocuments({ userId: actor.user._id })).toBe(0);
  });

  it("renews the same plan after endDate even when expiry cron has not run", async () => {
    const actor = await createTestUser({ email: "fitness-plus-renew@example.com" });
    await Wallet.create({ userId: actor.user._id, balance: 200000, version: 0 });
    const expired = await FitnessSubscription.create({
      userId: actor.user._id,
      planCode: "fitness_plus_essential",
      planTitle: "Nền tảng",
      billingCycle: "month",
      amount: 99_000,
      startDate: new Date(Date.now() - 32 * 24 * 60 * 60_000),
      endDate: new Date(Date.now() - 24 * 60 * 60_000),
      status: "active",
      isActive: true,
      purchaseRequestId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });

    const response = await postAs(
      "/api/fitness-plus-subscriptions/purchase",
      actor.accessToken,
      confirmedPurchaseBody(
        "fitness_plus_essential",
        "month",
        "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      ),
    );

    expect(response.status).toBe(201);
    expect(await FitnessSubscription.findById(expired._id)).toMatchObject({
      status: "expired",
      isActive: false,
    });
    expect(
      await FitnessSubscription.countDocuments({
        userId: actor.user._id,
        status: "active",
        isActive: true,
      }),
    ).toBe(1);
    expect((await Wallet.findOne({ userId: actor.user._id })).balance).toBe(
      101000,
    );
  });
});
