import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import request from "supertest";

vi.mock("../../utils/sendMail.js", () => ({
  sendTrainerSubscriptionActivatedMail: vi.fn().mockResolvedValue(undefined),
}));

import {
  clearCollections,
  createTestApp,
  createTestUser,
  setupTestDB,
  teardownTestDB,
  withAuth,
} from "../../__tests__/setup.js";
import trainerSubscriptionRoutes from "../../routes/trainerSubscription.routes.js";
import TrainerSubscription from "../../models/TrainerSubscription.js";
import TrainerTrialClaim from "../../models/TrainerTrialClaim.js";
import Wallet from "../../models/Wallet.js";
import Order from "../../models/Order.js";
import { sendTrainerSubscriptionActivatedMail } from "../../utils/sendMail.js";
import {
  getTrainerPlanAmount,
  getTrainerPlanCatalogMeta,
} from "../../services/trainerPlanCatalog.service.js";

let app;

const postAs = (path, token, body = {}) =>
  withAuth(request(app).post(path).send(body), token);

const confirmedPurchaseBody = (planCode, billingCycle, requestId) => {
  const { catalogFingerprint, protocolVersion } = getTrainerPlanCatalogMeta();
  return {
    planCode,
    billingCycle,
    requestId,
    expectedAmount: getTrainerPlanAmount(planCode, billingCycle),
    catalogFingerprint,
    protocolVersion,
  };
};

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/trainer-subscriptions", trainerSubscriptionRoutes);
  await Promise.all([
    TrainerSubscription.init(),
    TrainerTrialClaim.init(),
  ]);
});

afterEach(async () => {
  vi.clearAllMocks();
  await clearCollections();
});

afterAll(async () => {
  await teardownTestDB();
});

describe("trainer subscription lifecycle", () => {
  it("serves the authoritative plan catalog without authentication", async () => {
    const response = await request(app).get("/api/trainer-subscriptions/catalog");

    expect(response.status).toBe(200);
    expect(response.body.data.map((plan) => plan.prices)).toEqual([
      { trial: 0 },
      { month: 200000, year: 2000000 },
      { month: 250000, year: 2500000 },
      { month: 300000, year: 3000000 },
    ]);
    expect(response.body.benefits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "max_students" }),
        expect.objectContaining({ key: "crm_ai_analysis" }),
        expect.objectContaining({ key: "free_updates" }),
      ]),
    );
    expect(response.body.meta).toEqual({
      currency: "VND",
      catalogFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      protocolVersion: 1,
    });
  });
  it("rejects a purchase without catalog confirmation before any write", async () => {
    const actor = await createTestUser({ email: "stale-catalog@example.com" });

    const response = await postAs(
      "/api/trainer-subscriptions/purchase",
      actor.accessToken,
      {
        planCode: "free",
        billingCycle: "trial",
        requestId: "11111111-1111-4111-8111-111111111111",
      },
    );

    expect(response.status).toBe(400);
    expect(
      await TrainerSubscription.countDocuments({ userId: actor.user._id }),
    ).toBe(0);
  });

  it("rejects a stale catalog fingerprint without charging the wallet", async () => {
    const actor = await createTestUser({ email: "stale-paid-catalog@example.com" });
    await Wallet.create({
      userId: actor.user._id,
      balance: 200000,
      version: 0,
    });

    const body = confirmedPurchaseBody("standard", "month", "11111111-1111-4111-8111-111111111116");
    body.catalogFingerprint = "b".repeat(64);

    const response = await postAs(
      "/api/trainer-subscriptions/purchase",
      actor.accessToken,
      body,
    );

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("CATALOG_CHANGED");
    expect(
      await TrainerSubscription.countDocuments({ userId: actor.user._id }),
    ).toBe(0);
    expect(
      (await Wallet.findOne({ userId: actor.user._id })).balance,
    ).toBe(200000);
  });

  it("activates Free for 30 days once per normalized email", async () => {
    const actor = await createTestUser({ email: "Trial.User@Example.com" });

    const activated = await postAs(
      "/api/trainer-subscriptions/purchase",
      actor.accessToken,
      confirmedPurchaseBody("free", "trial", "11111111-1111-4111-8111-111111111112"),
    );

    const subscription = await TrainerSubscription.findOne({
      userId: actor.user._id,
    })
      .select("+entitlementPolicyVersion +entitlementPolicySnapshot")
      .lean();
    const durationDays =
      (subscription.endDate - subscription.startDate) / (24 * 60 * 60 * 1000);

    expect(activated.status).toBe(201);
    expect(subscription.planCode).toBe("free");
    expect(subscription.amount).toBe(0);
    expect(subscription).toMatchObject({
      entitlementPolicyVersion: "2026-08-28.1",
      entitlementPolicySnapshot: {
        ai_chat: expect.objectContaining({
          windows: [
            expect.objectContaining({ key: "burst", limit: 30 }),
            expect.objectContaining({ key: "monthly", limit: 1200 }),
          ],
        }),
      },
    });
    expect(durationDays).toBe(30);
    expect(
      await TrainerTrialClaim.countDocuments({
        normalizedEmail: "trial.user@example.com",
      }),
    ).toBe(1);
    expect(sendTrainerSubscriptionActivatedMail).toHaveBeenCalledTimes(1);

    await TrainerSubscription.updateOne(
      { _id: subscription._id },
      { $set: { status: "expired", isActive: false } },
    );
    const repeated = await postAs(
      "/api/trainer-subscriptions/purchase",
      actor.accessToken,
      confirmedPurchaseBody("free", "trial", "11111111-1111-4111-8111-111111111113"),
    );

    expect(repeated.status).toBe(409);
    expect(repeated.body.code).toBe("FREE_TRIAL_ALREADY_USED");
  });

  it("reports Free as used while preserving the existing my-subscription contract", async () => {
    const actor = await createTestUser({ email: "used-trial@example.com" });
    await TrainerTrialClaim.create({
      normalizedEmail: actor.user.email,
      userId: actor.user._id,
      claimedAt: new Date(),
      source: "free_trial",
    });

    const response = await withAuth(
      request(app).get("/api/trainer-subscriptions/my"),
      actor.accessToken,
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toBeNull();
    expect(response.body.freeTrial.status).toBe("used");
  });

  it("returns canonical entitlements with the active subscription", async () => {
    const actor = await createTestUser({ email: "free-entitlements@example.com" });
    await postAs(
      "/api/trainer-subscriptions/purchase",
      actor.accessToken,
      confirmedPurchaseBody(
        "free",
        "trial",
        "11111111-1111-4111-8111-111111111119",
      ),
    );

    const response = await withAuth(
      request(app).get("/api/trainer-subscriptions/my"),
      actor.accessToken,
    );

    expect(response.body.data.entitlements).toEqual({ f1CrmAi: false });
  });

  it("upgrades Free to paid without deleting trainer data", async () => {
    const actor = await createTestUser({ email: "upgrade@example.com" });
    await Wallet.create({
      userId: actor.user._id,
      balance: 200000,
      version: 0,
    });
    await postAs(
      "/api/trainer-subscriptions/purchase",
      actor.accessToken,
      confirmedPurchaseBody("free", "trial", "11111111-1111-4111-8111-111111111114"),
    );
    const retainedOrder = await Order.create({
      userId: actor.user._id,
      trainerId: actor.user._id,
      name: "Retained Client",
      email: "retained-client@example.com",
      sessions: 10,
      totalSessions: 10,
      status: "approved",
    });

    const upgraded = await postAs(
      "/api/trainer-subscriptions/purchase",
      actor.accessToken,
      confirmedPurchaseBody("standard", "month", "11111111-1111-4111-8111-111111111115"),
    );
    const subscriptions = await TrainerSubscription.find({
      userId: actor.user._id,
    }).sort({ createdAt: 1 });

    expect(upgraded.status).toBe(201);
    expect(subscriptions).toHaveLength(2);
    expect(subscriptions[0].status).toBe("superseded");
    expect(subscriptions[0].isActive).toBe(false);
    expect(subscriptions[1].planCode).toBe("standard");
    expect(subscriptions[1].previousSubscriptionId.toString()).toBe(
      subscriptions[0]._id.toString(),
    );
    expect(await Order.exists({ _id: retainedOrder._id })).toBeTruthy();
  });

  it("rejects Free when the student already has an Order", async () => {
    const actor = await createTestUser({ email: "ordered-student@example.com" });
    await Order.create({
      userId: actor.user._id,
      trainerId: actor.user._id,
      name: "Ordered Student",
      email: actor.user.email,
      sessions: 10,
      totalSessions: 10,
      status: "cancelled",
    });

    const response = await postAs(
      "/api/trainer-subscriptions/purchase",
      actor.accessToken,
      confirmedPurchaseBody(
        "free",
        "trial",
        "11111111-1111-4111-8111-111111111117",
      ),
    );

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("TRAINER_FREE_ORDER_EXISTS");
    expect(
      await TrainerSubscription.countDocuments({ userId: actor.user._id }),
    ).toBe(0);
    expect(
      await TrainerTrialClaim.countDocuments({ userId: actor.user._id }),
    ).toBe(0);
  });

  it("reports Free as ineligible and blocks legacy email-only Orders", async () => {
    const actor = await createTestUser({ email: "legacy-order@example.com" });
    await Order.create({
      name: "Legacy Student",
      email: actor.user.email,
      sessions: 8,
      totalSessions: 8,
      status: "completed",
    });

    const snapshot = await withAuth(
      request(app).get("/api/trainer-subscriptions/my"),
      actor.accessToken,
    );
    const purchase = await postAs(
      "/api/trainer-subscriptions/purchase",
      actor.accessToken,
      confirmedPurchaseBody(
        "free",
        "trial",
        "11111111-1111-4111-8111-111111111118",
      ),
    );

    expect(snapshot.status).toBe(200);
    expect(snapshot.body.freeTrial).toEqual({
      status: "ineligible",
      reason: "existing_order",
      claimedAt: null,
    });
    expect(purchase.status).toBe(409);
    expect(purchase.body.code).toBe("TRAINER_FREE_ORDER_EXISTS");
  });
});
