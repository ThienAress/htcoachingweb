import mongoose from "mongoose";
import request from "supertest";
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
  createTestApp,
  createTestUser,
  setupTestDB,
  teardownTestDB,
} from "../../__tests__/setup.js";
import {
  aiChatLimiter,
  aiGuestChatLimiter,
  fitnessPlusAiChatLimiter,
  fitnessPlusMealScanLimiter,
} from "../aiRateLimit.js";
import { serializeRequestQuota } from "../../services/serviceAccessPolicy.service.js";
import FitnessSubscription from "../../models/FitnessSubscription.js";
import { resolveServiceAccessTierMiddleware } from "../resolveServiceAccessTier.js";

let app;

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.set("trust proxy", 1);
  app.post(
    "/guest",
    aiGuestChatLimiter,
    (req, res) => res.json({ quota: serializeRequestQuota(req, "ai_chat") }),
  );
  app.post(
    "/fitness-meal/:id",
    (req, _res, next) => {
      req.user = { id: req.params.id, role: "user" };
      if (req.get("X-Test-Tier")) {
        req.serviceAccessTier = req.get("X-Test-Tier");
      }
      next();
    },
    resolveServiceAccessTierMiddleware,
    fitnessPlusMealScanLimiter,
    (req, res) => res.json({ quota: serializeRequestQuota(req, "meal_scan") }),
  );
  app.post(
    "/user/:id",
    (req, _res, next) => {
      req.user = { id: req.params.id, role: req.get("X-Test-Role") || "user" };
      if (req.get("X-Test-Tier")) {
        req.serviceAccessTier = req.get("X-Test-Tier");
      }
      next();
    },
    fitnessPlusAiChatLimiter,
    aiChatLimiter,
    (req, res) => res.json({ quota: serializeRequestQuota(req, "ai_chat") }),
  );
});
afterEach(clearCollections);
afterAll(teardownTestDB);

describe("AI Chat policy limiter", () => {
  it("limits a guest to five messages per hour and returns quota metadata", async () => {
    const statuses = [];
    let fifth;
    let limited;
    for (let attempt = 1; attempt <= 6; attempt += 1) {
      const response = await request(app)
        .post("/guest")
        .set("X-Forwarded-For", "198.51.100.201");
      statuses.push(response.status);
      if (attempt === 5) fifth = response;
      if (attempt === 6) limited = response;
    }

    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
    expect(fifth.body.quota).toMatchObject({ limit: 5, remaining: 0 });
    expect(fifth.body.quota.resetAt).toBeTruthy();
    expect(limited.body).toMatchObject({
      success: false,
      code: "AI_GUEST_RATE_LIMITED",
      meta: { quota: { limit: 5, remaining: 0 } },
    });
  });

  it("limits a regular user to fifteen messages per hour", async () => {
    const { user } = await createTestUser({ email: "ai-limit-user@example.com" });
    const statuses = [];
    let limited;
    for (let attempt = 1; attempt <= 16; attempt += 1) {
      const response = await request(app).post(`/user/${user._id}`);
      statuses.push(response.status);
      if (attempt === 16) limited = response;
    }

    expect(statuses).toEqual([...Array(15).fill(200), 429]);
    expect(limited.body).toMatchObject({
      success: false,
      code: "AI_RATE_LIMITED",
      meta: { quota: { tier: "user", limit: 15, remaining: 0 } },
    });
  });

  it("uses the thirty-message trainer policy", async () => {
    const trainerId = new mongoose.Types.ObjectId();
    const statuses = [];
    for (let attempt = 1; attempt <= 31; attempt += 1) {
      const response = await request(app)
        .post(`/user/${trainerId}`)
        .set("X-Test-Role", "trainer");
      statuses.push(response.status);
    }

    expect(statuses).toEqual([...Array(30).fill(200), 429]);
  });

  it("uses the Fitness+ plan tier for AI Chat and its 30-day Meal Scan window", async () => {
    const { user } = await createTestUser({ email: "ai-limit-fitness-plus@example.com" });
    await FitnessSubscription.create({
      userId: user._id,
      planCode: "fitness_plus_essential",
      planTitle: "Nền tảng",
      billingCycle: "month",
      amount: 99000,
      startDate: new Date(Date.now() - 60_000),
      endDate: new Date(Date.now() + 86_400_000),
      status: "active",
      isActive: true,
    });

    const aiStatuses = [];
    let aiLimited;
    for (let attempt = 1; attempt <= 21; attempt += 1) {
      const response = await request(app).post(`/user/${user._id}`);
      aiStatuses.push(response.status);
      if (attempt === 21) aiLimited = response;
    }
    expect(aiStatuses).toEqual([...Array(20).fill(200), 429]);
    expect(aiLimited.body).toMatchObject({
      code: "AI_RATE_LIMITED",
      meta: {
        quota: {
          tier: "fitness_plus_essential",
          limit: 20,
          remaining: 0,
        },
      },
    });

    const mealStatuses = [];
    let mealLimited;
    for (let attempt = 1; attempt <= 16; attempt += 1) {
      const response = await request(app).post(`/fitness-meal/${user._id}`);
      mealStatuses.push(response.status);
      if (attempt === 16) mealLimited = response;
    }
    expect(mealStatuses).toEqual([...Array(15).fill(200), 429]);
    expect(mealLimited.body).toMatchObject({
      code: "MEAL_SCAN_RATE_LIMITED",
      meta: {
        quota: {
          tier: "fitness_plus_essential",
          limit: 15,
          remaining: 0,
        },
      },
    });
  });

  it.each([
    {
      tier: "fitness_plus_smart",
      aiLimit: 40,
      mealScanLimit: 30,
    },
    {
      tier: "fitness_plus_max",
      aiLimit: 60,
      mealScanLimit: 60,
    },
  ])(
    "enforces the $tier boundaries from the policy registry",
    async ({ tier, aiLimit, mealScanLimit }) => {
      const userId = new mongoose.Types.ObjectId();
      const aiStatuses = [];
      for (let attempt = 1; attempt <= aiLimit + 1; attempt += 1) {
        const response = await request(app)
          .post(`/user/${userId}`)
          .set("X-Test-Tier", tier);
        aiStatuses.push(response.status);
      }

      const mealStatuses = [];
      for (let attempt = 1; attempt <= mealScanLimit + 1; attempt += 1) {
        const response = await request(app)
          .post(`/fitness-meal/${userId}`)
          .set("X-Test-Tier", tier);
        mealStatuses.push(response.status);
      }

      expect(aiStatuses).toEqual([...Array(aiLimit).fill(200), 429]);
      expect(mealStatuses).toEqual([
        ...Array(mealScanLimit).fill(200),
        429,
      ]);
    },
  );
});
