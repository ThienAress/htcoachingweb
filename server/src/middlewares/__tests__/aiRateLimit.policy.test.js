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
import { aiChatLimiter, aiGuestChatLimiter } from "../aiRateLimit.js";
import { serializeRequestQuota } from "../../services/serviceAccessPolicy.service.js";

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
    "/user/:id",
    (req, _res, next) => {
      req.user = { id: req.params.id, role: req.get("X-Test-Role") || "user" };
      next();
    },
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
});
