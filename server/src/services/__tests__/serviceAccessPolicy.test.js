import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";
import mongoose from "mongoose";

import {
  clearCollections,
  createTestUser,
  setupTestDB,
  teardownTestDB,
} from "../../__tests__/setup.js";
import {
  SERVICE_ACCESS_TIERS,
  getServiceAccessPolicy,
} from "../../constants/serviceAccessPolicies.js";
import Order from "../../models/Order.js";
import TrainerSubscription from "../../models/TrainerSubscription.js";
import FitnessSubscription from "../../models/FitnessSubscription.js";
import {
  resolveRequestServicePolicy,
  resolveServiceAccessCandidates,
  resolveServiceAccessTier,
  getAdminServiceAccessPolicyMatrix,
} from "../serviceAccessPolicy.service.js";

beforeAll(setupTestDB);
afterEach(clearCollections);
afterAll(teardownTestDB);

describe("service access policy registry", () => {
  it("keeps separate canonical Practice Center quotas for trainers and admins", () => {
    const windows = (tier) =>
      getServiceAccessPolicy("practice_email", tier).windows.map((window) => [
        window.key,
        window.limit,
      ]);

    expect({ trainer: windows("trainer"), admin: windows("admin") }).toEqual({
      trainer: [["rolling_24_hours", 2]],
      admin: [["rolling_24_hours", 10]],
    });
  });

  it("exposes the Practice Center admin tier in the canonical Admin matrix", () => {
    const matrix = getAdminServiceAccessPolicyMatrix();
    const paidColumn = matrix.columns.find(({ id }) => id === "paid");
    const practice = matrix.services.find(
      ({ serviceKey }) => serviceKey === "practice_email",
    );

    expect({
      paidTiers: paidColumn.tiers.map(({ key }) => key),
      trainerLimit: practice.policies.trainer.limit,
      adminLimit: practice.policies.admin.limit,
      unavailableTiers: [
        "guest",
        "user",
        "coaching_customer",
        "fitness_plus_essential",
        "fitness_plus_smart",
        "fitness_plus_max",
      ].filter((tier) => practice.policies[tier].mode === "unavailable"),
    }).toEqual({
      paidTiers: ["coaching_customer", "trainer", "admin"],
      trainerLimit: 2,
      adminLimit: 10,
      unavailableTiers: [
        "guest",
        "user",
        "coaching_customer",
        "fitness_plus_essential",
        "fitness_plus_smart",
        "fitness_plus_max",
      ],
    });
  });

  it("resolves admins to their own tier without changing trainer policy semantics", async () => {
    const admin = await createTestUser({
      email: "service-policy-admin-tier@example.com",
      role: "admin",
    });
    const trainer = await createTestUser({
      email: "service-policy-trainer-tier@example.com",
      role: "trainer",
    });

    const [adminTier, trainerTier] = await Promise.all([
      resolveServiceAccessTier(admin.user),
      resolveServiceAccessTier(trainer.user),
    ]);

    expect({ adminTier, trainerTier }).toEqual({
      adminTier: "admin",
      trainerTier: "trainer",
    });
    expect(
      ["meal_scan", "ai_credits", "meal_plan", "tdee"].every(
        (serviceKey) =>
          JSON.stringify(getServiceAccessPolicy(serviceKey, adminTier)) ===
          JSON.stringify(getServiceAccessPolicy(serviceKey, trainerTier)),
      ),
    ).toBe(true);
  });

  it("keeps the approved Meal Scan and AI credit limits in one registry", () => {
    const limits = (serviceKey, tier) =>
      getServiceAccessPolicy(serviceKey, tier).windows.map((window) => [
        window.key,
        window.limit,
      ]);

    expect({
      mealScan: {
        guest: limits("meal_scan", "guest"),
        user: limits("meal_scan", "user"),
        coaching: limits("meal_scan", "coaching_customer"),
        trainer: limits("meal_scan", "trainer"),
        essential: limits("meal_scan", "fitness_plus_essential"),
        smart: limits("meal_scan", "fitness_plus_smart"),
        max: limits("meal_scan", "fitness_plus_max"),
      },
      aiCredits: {
        guest: limits("ai_credits", "guest"),
        user: limits("ai_credits", "user"),
        coaching: limits("ai_credits", "coaching_customer"),
        trainer: limits("ai_credits", "trainer"),
        essential: limits("ai_credits", "fitness_plus_essential"),
        smart: limits("ai_credits", "fitness_plus_smart"),
        max: limits("ai_credits", "fitness_plus_max"),
      },
    }).toEqual({
      mealScan: {
        guest: [["lifetime", 2]],
        user: [["lifetime", 2]],
        coaching: [],
        trainer: [],
        essential: [],
        smart: [],
        max: [],
      },
      aiCredits: {
        guest: [["rolling_24_hours", 5]],
        user: [["daily", 20], ["monthly", 80]],
        coaching: [["burst", 40], ["monthly", 1200]],
        trainer: [["burst", 40], ["monthly", 2400]],
        essential: [["burst", 30], ["monthly", 360]],
        smart: [["burst", 50], ["monthly", 720]],
        max: [["burst", 80], ["monthly", 1200]],
      },
    });
  });

  it("keeps Meal Plan and TDEE access in the same matrix", () => {
    expect(getServiceAccessPolicy("meal_plan", "guest")).toMatchObject({
      mode: "quota",
      limit: 1,
      period: "session",
    });
    expect(getServiceAccessPolicy("meal_plan", "user")).toMatchObject({
      mode: "quota",
      limit: 1,
      period: "lifetime",
    });
    expect(
      getServiceAccessPolicy("meal_plan", "coaching_customer").mode,
    ).toBe("unlimited");
    expect(getServiceAccessPolicy("tdee", "guest").mode).toBe("unlimited");
  });
});
describe("resolveServiceAccessTier", () => {
  it("resolves guest and regular user without trusting client input", async () => {
    expect(await resolveServiceAccessTier(null)).toBe(SERVICE_ACCESS_TIERS.GUEST);

    const { user } = await createTestUser({ email: "tier-user@example.com" });
    expect(
      await resolveServiceAccessTier({ id: user._id, role: "user" }),
    ).toBe(SERVICE_ACCESS_TIERS.USER);
  });

  it("resolves a coaching customer only while an approved order has sessions", async () => {
    const { user } = await createTestUser({ email: "tier-coaching@example.com" });
    await Order.create({
      userId: user._id,
      status: "approved",
      sessions: 4,
      totalSessions: 8,
    });

    expect(
      await resolveServiceAccessTier({ id: user._id, role: "user" }),
    ).toBe(SERVICE_ACCESS_TIERS.COACHING_CUSTOMER);

    await Order.updateOne({ userId: user._id }, { $set: { sessions: 0 } });
    expect(
      await resolveServiceAccessTier({ id: user._id, role: "user" }),
    ).toBe(SERVICE_ACCESS_TIERS.USER);
  });

  it("resolves active subscription, trainer and admin roles to their canonical tiers", async () => {
    const { user } = await createTestUser({ email: "tier-trainer@example.com" });
    await TrainerSubscription.create({
      userId: user._id,
      planTitle: "Test",
      billingCycle: "month",
      amount: 0,
      startDate: new Date(Date.now() - 60_000),
      endDate: new Date(Date.now() + 86_400_000),
      status: "active",
      isActive: true,
    });

    expect(
      await resolveServiceAccessTier({ id: user._id, role: "user" }),
    ).toBe(SERVICE_ACCESS_TIERS.TRAINER);
    expect(
      await resolveServiceAccessTier({ id: user._id, role: "trainer" }),
    ).toBe(SERVICE_ACCESS_TIERS.TRAINER);
    expect(
      await resolveServiceAccessTier({ id: user._id, role: "admin" }),
    ).toBe(SERVICE_ACCESS_TIERS.ADMIN);
  });

  it("resolves the active HT Fitness+ plan without changing coaching precedence", async () => {
    const { user } = await createTestUser({ email: "tier-fitness-plus@example.com" });
    await FitnessSubscription.create({
      userId: user._id,
      planCode: SERVICE_ACCESS_TIERS.FITNESS_PLUS_SMART,
      planTitle: "Tăng tốc",
      billingCycle: "month",
      amount: 199000,
      startDate: new Date(Date.now() - 60_000),
      endDate: new Date(Date.now() + 86_400_000),
      status: "active",
      isActive: true,
    });

    expect(
      await resolveServiceAccessTier({ id: user._id, role: "user" }),
    ).toBe(SERVICE_ACCESS_TIERS.FITNESS_PLUS_SMART);

    await Order.create({
      userId: user._id,
      status: "approved",
      sessions: 1,
      totalSessions: 1,
    });
    expect(
      await resolveServiceAccessTier({ id: user._id, role: "user" }),
    ).toBe(SERVICE_ACCESS_TIERS.COACHING_CUSTOMER);
  });

  it("resolves entitlement safely when it is the first operation in a transaction", async () => {
    const { user } = await createTestUser({
      email: "tier-transaction-safe@example.com",
    });
    await FitnessSubscription.create({
      userId: user._id,
      planCode: SERVICE_ACCESS_TIERS.FITNESS_PLUS_SMART,
      planTitle: "Tăng tốc",
      billingCycle: "month",
      amount: 199000,
      startDate: new Date(Date.now() - 60_000),
      endDate: new Date(Date.now() + 86_400_000),
      status: "active",
      isActive: true,
    });
    const session = await mongoose.startSession();
    let candidates;
    try {
      await session.withTransaction(async () => {
        candidates = await resolveServiceAccessCandidates(
          { id: user._id, role: "user" },
          { session },
        );
      });
    } finally {
      await session.endSession();
    }

    expect(candidates.map(({ tier }) => tier)).toContain(
      SERVICE_ACCESS_TIERS.FITNESS_PLUS_SMART,
    );
  });

  it("selects the strongest active entitlement for each service", async () => {
    const { user } = await createTestUser({ email: "tier-strongest@example.com" });
    await Order.create({
      userId: user._id,
      status: "approved",
      sessions: 2,
      totalSessions: 2,
    });
    await FitnessSubscription.create({
      userId: user._id,
      planCode: SERVICE_ACCESS_TIERS.FITNESS_PLUS_MAX,
      planTitle: "Toàn diện",
      billingCycle: "month",
      amount: 299000,
      startDate: new Date(Date.now() - 60_000),
      endDate: new Date(Date.now() + 86_400_000),
      status: "active",
      isActive: true,
    });

    const ai = await resolveRequestServicePolicy(
      { user: { id: user._id, role: "user" } },
      "ai_credits",
    );
    const meal = await resolveRequestServicePolicy(
      { user: { id: user._id, role: "user" } },
      "meal_scan",
    );

    expect({ ai: ai.tier, mealMode: meal.policy.mode }).toEqual({
      ai: SERVICE_ACCESS_TIERS.FITNESS_PLUS_MAX,
      // Meal Scan của người đã có gói chỉ trừ credit, không còn cổng lượt riêng.
      mealMode: "unlimited",
    });
  });

  it("uses an entitlement snapshot as a no-downgrade floor", async () => {
    const { user } = await createTestUser({ email: "tier-floor@example.com" });
    const snapshot = {
      ai_credits: {
        ...getServiceAccessPolicy("ai_credits", SERVICE_ACCESS_TIERS.FITNESS_PLUS_ESSENTIAL),
        windows: [
          { key: "burst", limit: 35, period: "rolling_hour", periodLabel: "giờ", windowMs: 3600000 },
          { key: "monthly", limit: 400, period: "rolling_30_days", periodLabel: "30 ngày", windowMs: 2592000000 },
        ],
      },
    };
    await FitnessSubscription.create({
      userId: user._id,
      planCode: SERVICE_ACCESS_TIERS.FITNESS_PLUS_ESSENTIAL,
      planTitle: "Nền tảng",
      billingCycle: "month",
      amount: 99000,
      startDate: new Date(Date.now() - 60_000),
      endDate: new Date(Date.now() + 86_400_000),
      status: "active",
      isActive: true,
      entitlementPolicyVersion: "legacy-test",
      entitlementPolicySnapshot: snapshot,
    });

    const resolved = await resolveRequestServicePolicy(
      { user: { id: user._id, role: "user" } },
      "ai_credits",
    );

    expect(resolved.policy.windows.map(({ key, limit }) => [key, limit])).toEqual([
      ["burst", 35],
      ["monthly", 400],
    ]);
  });

  it("chỉ mở Đánh giá bản thân cho ba gói HT Fitness+", () => {
    const modes = Object.fromEntries(
      Object.values(SERVICE_ACCESS_TIERS).map((tier) => [
        tier,
        getServiceAccessPolicy("self_assessment", tier).mode,
      ]),
    );

    expect(modes).toEqual({
      guest: "unavailable",
      user: "unavailable",
      coaching_customer: "unavailable",
      trainer: "unavailable",
      admin: "unavailable",
      fitness_plus_essential: "unlimited",
      fitness_plus_smart: "unlimited",
      fitness_plus_max: "unlimited",
    });
  });
});
