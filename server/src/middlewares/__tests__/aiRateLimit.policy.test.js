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

import { createTestApp, createTestUser, setupTestDB, teardownTestDB, clearCollections } from "../../__tests__/setup.js";
import {
  AI_CHAT_ABUSE_LIMIT,
  aiChatLimiter,
  aiGuestChatLimiter,
  fitnessPlusAiChatLimiter,
  fitnessPlusMealScanLimiter,
  mealScanAnonymousLimiter,
  mealScanLimiter,
  MEAL_SCAN_ABUSE_LIMIT,
} from "../aiRateLimit.js";
import { serializeRequestQuota } from "../../services/serviceAccessPolicy.service.js";
import FitnessSubscription from "../../models/FitnessSubscription.js";
import { resolveServiceAccessTierMiddleware } from "../resolveServiceAccessTier.js";
import { enforceSharedServiceUsage } from "../serviceUsageLedger.js";

let app;

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.set("trust proxy", 1);
  app.post("/abuse-guest", aiGuestChatLimiter, (_req, res) => res.json({ success: true }));
  app.post(
    "/abuse-meal/:id",
    (req, _res, next) => {
      req.user = { id: req.params.id, role: "user" };
      next();
    },
    mealScanLimiter,
    (_req, res) => res.json({ success: true }),
  );
  app.post(
    "/abuse-user/:id",
    (req, _res, next) => {
      req.user = { id: req.params.id, role: "user" };
      next();
    },
    aiChatLimiter,
    (_req, res) => res.json({ success: true }),
  );
  app.post(
    "/guest",
    aiGuestChatLimiter,
    enforceSharedServiceUsage("ai_chat"),
    (req, res) => res.json({ quota: serializeRequestQuota(req, "ai_chat") }),
  );
  app.post(
    "/fitness-meal/:id",
    (req, _res, next) => {
      req.user = { id: req.params.id, role: "user" };
      if (req.get("X-Test-Tier")) req.serviceAccessTier = req.get("X-Test-Tier");
      next();
    },
    resolveServiceAccessTierMiddleware,
    fitnessPlusMealScanLimiter,
    mealScanLimiter,
    enforceSharedServiceUsage("meal_scan"),
    (req, res) => res.json({ quota: serializeRequestQuota(req, "meal_scan") }),
  );
  app.post(
    "/user/:id",
    (req, _res, next) => {
      req.user = { id: req.params.id, role: req.get("X-Test-Role") || "user" };
      if (req.get("X-Test-Tier")) req.serviceAccessTier = req.get("X-Test-Tier");
      next();
    },
    resolveServiceAccessTierMiddleware,
    fitnessPlusAiChatLimiter,
    aiChatLimiter,
    enforceSharedServiceUsage("ai_chat"),
    (req, res) => res.json({ quota: serializeRequestQuota(req, "ai_chat") }),
  );
});

afterEach(clearCollections);
afterAll(teardownTestDB);

describe("AI operational abuse limiters", () => {
  it("keeps guest flood protection separate from commercial quota", async () => {
    const statuses = [];
    let limited;
    for (let attempt = 1; attempt <= AI_CHAT_ABUSE_LIMIT + 1; attempt += 1) {
      const response = await request(app)
        .post("/abuse-guest")
        .set("X-Forwarded-For", "198.51.100.201");
      statuses.push(response.status);
      if (attempt === AI_CHAT_ABUSE_LIMIT + 1) limited = response;
    }
    expect(statuses).toEqual([...Array(AI_CHAT_ABUSE_LIMIT).fill(200), 429]);
    expect(limited.body).toMatchObject({ code: "AI_GUEST_ABUSE_RATE_LIMITED" });
  });

  it("applies the authenticated flood ceiling", async () => {
    const userId = new mongoose.Types.ObjectId();
    const statuses = [];
    for (let attempt = 1; attempt <= AI_CHAT_ABUSE_LIMIT + 1; attempt += 1) {
      statuses.push((await request(app).post(`/abuse-user/${userId}`)).status);
    }
    expect(statuses).toEqual([...Array(AI_CHAT_ABUSE_LIMIT).fill(200), 429]);
  });

  it("keeps the Meal Scan abuse ceiling separate", async () => {
    const userId = new mongoose.Types.ObjectId();
    const statuses = [];
    for (let attempt = 1; attempt <= MEAL_SCAN_ABUSE_LIMIT + 1; attempt += 1) {
      statuses.push((await request(app).post(`/abuse-meal/${userId}`)).status);
    }
    expect(statuses.at(-1)).toBe(429);
  });
});

describe("commercial quota ledger and Fitness+ quota", () => {
  it("limits a guest to five AI messages and returns metadata", async () => {
    const responses = [];
    for (let attempt = 1; attempt <= 6; attempt += 1) {
      responses.push(
        await request(app).post("/guest").set("X-Forwarded-For", "198.51.100.203"),
      );
    }
    expect(responses.slice(0, 5).map((response) => response.status)).toEqual([200, 200, 200, 200, 200]);
    expect(responses[4].body.quota).toMatchObject({ limit: 5, remaining: 0 });
    expect(responses[5].body).toMatchObject({ code: "AI_GUEST_RATE_LIMITED" });
  });

  it("limits regular users to fifteen AI messages and trainers to thirty", async () => {
    const regularId = new mongoose.Types.ObjectId();
    const regular = [];
    for (let attempt = 1; attempt <= 16; attempt += 1) {
      regular.push((await request(app).post(`/user/${regularId}`)).status);
    }
    expect(regular).toEqual([...Array(15).fill(200), 429]);

    const trainerId = new mongoose.Types.ObjectId();
    const trainer = [];
    for (let attempt = 1; attempt <= 31; attempt += 1) {
      trainer.push((await request(app).post(`/user/${trainerId}`).set("X-Test-Role", "trainer")).status);
    }
    expect(trainer).toEqual([...Array(30).fill(200), 429]);
  });

  it("uses the Fitness+ plan tier for AI Chat and Meal Scan", async () => {
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

    const ai = [];
    for (let attempt = 1; attempt <= 21; attempt += 1) {
      ai.push((await request(app).post(`/user/${user._id}`)).status);
    }
    expect(ai).toEqual([...Array(20).fill(200), 429]);

    const meal = [];
    for (let attempt = 1; attempt <= 16; attempt += 1) {
      meal.push((await request(app).post(`/fitness-meal/${user._id}`)).status);
    }
    expect(meal).toEqual([...Array(15).fill(200), 429]);
  });

  it.each([
    { tier: "fitness_plus_smart", aiLimit: 40, mealLimit: 30 },
    { tier: "fitness_plus_max", aiLimit: 60, mealLimit: 60 },
  ])("enforces $tier boundaries from the registry", async ({ tier, aiLimit, mealLimit }) => {
    const userId = new mongoose.Types.ObjectId();
    const ai = [];
    for (let attempt = 1; attempt <= aiLimit + 1; attempt += 1) {
      ai.push((await request(app).post(`/user/${userId}`).set("X-Test-Tier", tier)).status);
    }
    expect(ai).toEqual([...Array(aiLimit).fill(200), 429]);

    const meal = [];
    for (let attempt = 1; attempt <= mealLimit + 1; attempt += 1) {
      meal.push((await request(app).post(`/fitness-meal/${userId}`).set("X-Test-Tier", tier)).status);
    }
    expect(meal).toEqual([...Array(mealLimit).fill(200), 429]);
  });
});
