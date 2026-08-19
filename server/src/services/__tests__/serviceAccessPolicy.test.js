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
import {
  SERVICE_ACCESS_TIERS,
  getServiceAccessPolicy,
} from "../../constants/serviceAccessPolicies.js";
import Order from "../../models/Order.js";
import TrainerSubscription from "../../models/TrainerSubscription.js";
import FitnessSubscription from "../../models/FitnessSubscription.js";
import {
  resolveRequestServicePolicy,
  resolveServiceAccessTier,
} from "../serviceAccessPolicy.service.js";

beforeAll(setupTestDB);
afterEach(clearCollections);
afterAll(teardownTestDB);

describe("service access policy registry", () => {
  it("keeps the approved Meal Scan and AI Chat limits in one registry", () => {
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
      aiChat: {
        guest: limits("ai_chat", "guest"),
        user: limits("ai_chat", "user"),
        coaching: limits("ai_chat", "coaching_customer"),
        trainer: limits("ai_chat", "trainer"),
        essential: limits("ai_chat", "fitness_plus_essential"),
        smart: limits("ai_chat", "fitness_plus_smart"),
        max: limits("ai_chat", "fitness_plus_max"),
      },
    }).toEqual({
      mealScan: {
        guest: [["lifetime", 1]],
        user: [["lifetime", 1]],
        coaching: [["daily", 10], ["monthly", 300]],
        trainer: [["daily", 20], ["monthly", 600]],
        essential: [["daily", 5], ["monthly", 120]],
        smart: [["daily", 10], ["monthly", 210]],
        max: [["daily", 15], ["monthly", 300]],
      },
      aiChat: {
        guest: [["rolling_24_hours", 5]],
        user: [["daily", 15], ["monthly", 60]],
        coaching: [["burst", 30], ["monthly", 600]],
        trainer: [["burst", 30], ["monthly", 1200]],
        essential: [["burst", 20], ["monthly", 120]],
        smart: [["burst", 40], ["monthly", 300]],
        max: [["burst", 60], ["monthly", 600]],
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

  it("resolves active subscription and trainer roles as trainer tier", async () => {
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
    ).toBe(SERVICE_ACCESS_TIERS.TRAINER);
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
      "ai_chat",
    );
    const meal = await resolveRequestServicePolicy(
      { user: { id: user._id, role: "user" } },
      "meal_scan",
    );

    expect({ ai: ai.tier, meal: meal.tier }).toEqual({
      ai: SERVICE_ACCESS_TIERS.FITNESS_PLUS_MAX,
      meal: SERVICE_ACCESS_TIERS.FITNESS_PLUS_MAX,
    });
  });

  it("uses an entitlement snapshot as a no-downgrade floor", async () => {
    const { user } = await createTestUser({ email: "tier-floor@example.com" });
    const snapshot = {
      ai_chat: {
        ...getServiceAccessPolicy("ai_chat", SERVICE_ACCESS_TIERS.FITNESS_PLUS_ESSENTIAL),
        windows: [
          { key: "burst", limit: 25, period: "rolling_hour", periodLabel: "giờ", windowMs: 3600000 },
          { key: "monthly", limit: 240, period: "rolling_30_days", periodLabel: "30 ngày", windowMs: 2592000000 },
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
      "ai_chat",
    );

    expect(resolved.policy.windows.map(({ key, limit }) => [key, limit])).toEqual([
      ["burst", 25],
      ["monthly", 240],
    ]);
  });
});
