import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

import { createTestApp } from "../../__tests__/setup.js";
import {
  AI_CHAT_ABUSE_LIMIT,
  aiChatLimiter,
  aiGuestChatLimiter,
} from "../aiRateLimit.js";

let app;

beforeAll(() => {
  app = createTestApp();
  app.set("trust proxy", 1);
  app.post(
    "/guest",
    aiGuestChatLimiter,
    (_req, res) => res.json({ success: true }),
  );
  app.post(
    "/user/:id",
    (req, _res, next) => {
      req.user = { id: req.params.id, role: req.get("X-Test-Role") || "user" };
      next();
    },
    aiChatLimiter,
    (_req, res) => res.json({ success: true }),
  );
});

describe("AI Chat operational abuse limiter", () => {
  it("keeps a higher per-process ceiling separate from commercial quota", async () => {
    const statuses = [];
    let limited;
    for (let attempt = 1; attempt <= AI_CHAT_ABUSE_LIMIT + 1; attempt += 1) {
      const response = await request(app)
        .post("/guest")
        .set("X-Forwarded-For", "198.51.100.201");
      statuses.push(response.status);
      if (attempt === AI_CHAT_ABUSE_LIMIT + 1) limited = response;
    }

    expect(statuses).toEqual([
      ...Array(AI_CHAT_ABUSE_LIMIT).fill(200),
      429,
    ]);
    expect(limited.body).toMatchObject({
      success: false,
      code: "AI_GUEST_ABUSE_RATE_LIMITED",
    });
    expect(limited.body).not.toHaveProperty("meta.quota");
  });

  it("applies the same flood ceiling to authenticated actor keys", async () => {
    const userId = "507f1f77bcf86cd799439011";
    const statuses = [];
    let limited;
    for (let attempt = 1; attempt <= AI_CHAT_ABUSE_LIMIT + 1; attempt += 1) {
      const response = await request(app).post(`/user/${userId}`);
      statuses.push(response.status);
      if (attempt === AI_CHAT_ABUSE_LIMIT + 1) limited = response;
    }

    expect(statuses).toEqual([...Array(AI_CHAT_ABUSE_LIMIT).fill(200), 429]);
    expect(limited.body).toMatchObject({
      success: false,
      code: "AI_CHAT_ABUSE_RATE_LIMITED",
    });
  });
});
