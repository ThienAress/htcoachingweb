import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { authLimiter, isAnonymousRefreshAttempt } from "../rateLimit.js";

const buildApp = () => {
  const app = express();
  app.set("trust proxy", true);
  app.use(cookieParser());
  app.use("/api/auth", authLimiter);
  app.post("/api/auth/refresh", (_req, res) => res.status(401).json({ success: false }));
  app.post("/api/auth/login", (_req, res) => res.status(401).json({ success: false }));
  return app;
};

// The limiter store is shared by the module, so every test uses its own client address.
const post = (app, path, ip, cookie) => {
  const call = request(app).post(path).set("X-Forwarded-For", ip);
  return cookie ? call.set("Cookie", cookie) : call;
};

describe("authLimiter and anonymous refresh attempts", () => {
  it("recognises only refresh requests without a refresh cookie", () => {
    expect(isAnonymousRefreshAttempt({ path: "/refresh", cookies: {} })).toBe(true);
    expect(isAnonymousRefreshAttempt({ path: "/refresh" })).toBe(true);
    expect(isAnonymousRefreshAttempt({ path: "/refresh", cookies: { refreshToken: "x" } })).toBe(false);
    expect(isAnonymousRefreshAttempt({ path: "/login", cookies: {} })).toBe(false);
  });

  it("does not let anonymous page loads exhaust the login budget", async () => {
    const app = buildApp();
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const response = await post(app, "/api/auth/refresh", "10.0.0.1");
      expect(response.status).toBe(401);
    }
    const login = await post(app, "/api/auth/login", "10.0.0.1");
    expect(login.status).toBe(401);
  });

  it("still limits repeated failed refreshes that carry a refresh cookie", async () => {
    const app = buildApp();
    const statuses = [];
    for (let attempt = 0; attempt < 7; attempt += 1) {
      const response = await post(app, "/api/auth/refresh", "10.0.0.2", "refreshToken=stale");
      statuses.push(response.status);
    }
    expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(statuses.slice(5)).toEqual([429, 429]);
  });
});
