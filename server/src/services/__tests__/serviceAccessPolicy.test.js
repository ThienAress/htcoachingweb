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
import { resolveServiceAccessTier } from "../serviceAccessPolicy.service.js";

beforeAll(setupTestDB);
afterEach(clearCollections);
afterAll(teardownTestDB);

describe("service access policy registry", () => {
  it("keeps the approved Meal Scan and AI Chat limits in one registry", () => {
    expect(getServiceAccessPolicy("meal_scan", "guest").limit).toBe(2);
    expect(getServiceAccessPolicy("meal_scan", "user").limit).toBe(3);
    expect(
      getServiceAccessPolicy("meal_scan", "coaching_customer").limit,
    ).toBe(10);
    expect(getServiceAccessPolicy("meal_scan", "trainer").limit).toBe(10);

    expect(getServiceAccessPolicy("ai_chat", "guest").limit).toBe(5);
    expect(getServiceAccessPolicy("ai_chat", "user").limit).toBe(15);
    expect(
      getServiceAccessPolicy("ai_chat", "coaching_customer").limit,
    ).toBe(30);
    expect(getServiceAccessPolicy("ai_chat", "trainer").limit).toBe(30);
    expect(
      getServiceAccessPolicy("meal_scan", "fitness_plus_essential"),
    ).toMatchObject({ limit: 15, period: "rolling_30_days" });
    expect(getServiceAccessPolicy("meal_scan", "fitness_plus_smart").limit).toBe(30);
    expect(getServiceAccessPolicy("meal_scan", "fitness_plus_max").limit).toBe(60);
    expect(getServiceAccessPolicy("ai_chat", "fitness_plus_essential").limit).toBe(20);
    expect(getServiceAccessPolicy("ai_chat", "fitness_plus_smart").limit).toBe(40);
    expect(getServiceAccessPolicy("ai_chat", "fitness_plus_max").limit).toBe(60);
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
});
