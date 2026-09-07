import { readFileSync } from "node:fs";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";

import { getMetricsSnapshot, resetMetricsForTests } from "../../observability/metrics.js";
import authRoutes from "../auth.routes.js";

let app;

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/auth", authRoutes);
});

beforeEach(() => {
  delete process.env.AUTH_CUTOVER_MAINTENANCE;
  delete process.env.RENDER_GIT_COMMIT;
  resetMetricsForTests();
});

afterEach(() => {
  delete process.env.AUTH_CUTOVER_MAINTENANCE;
  delete process.env.RENDER_GIT_COMMIT;
});

describe("Auth cutover boundary", () => {
  it("is mounted after the global limiter but before Passport, the Auth limiter and CSRF issuance", () => {
    const serverSource = readFileSync(
      new URL("../../../server.js", import.meta.url),
      "utf8",
    );
    const boundaryIndex = serverSource.indexOf(
      'app.use("/api/auth", requireAuthCutoverOpen);',
    );
    const authLimiterIndex = serverSource.indexOf(
      'app.use("/api/auth", authLimiter);',
    );
    const globalLimiterIndex = serverSource.indexOf(
      'app.use("/api", globalLimiter);',
    );
    const passportIndex = serverSource.indexOf("app.use(passport.initialize());");
    const csrfCookieHelperIndex = serverSource.indexOf(
      "// ================= CSRF COOKIE HELPER",
    );

    expect({
      boundaryMounted: boundaryIndex >= 0,
      globalLimiterMounted: globalLimiterIndex >= 0,
      afterGlobalLimiter: globalLimiterIndex < boundaryIndex,
      beforePassport: boundaryIndex < passportIndex,
      beforeAuthLimiter: boundaryIndex < authLimiterIndex,
      beforeCsrfCookieHelper: boundaryIndex < csrfCookieHelperIndex,
    }).toEqual({
      boundaryMounted: true,
      globalLimiterMounted: true,
      afterGlobalLimiter: true,
      beforePassport: true,
      beforeAuthLimiter: true,
      beforeCsrfCookieHelper: true,
    });
  });

  it("blocks OAuth before it creates state and exposes only the validated release SHA", async () => {
    process.env.AUTH_CUTOVER_MAINTENANCE = "true";
    process.env.RENDER_GIT_COMMIT = "a".repeat(40);

    const response = await request(app)
      .get("/api/auth/google?client_url=https://app.example.com")
      .redirects(0);

    expect({
      status: response.status,
      body: response.body,
      retryAfter: response.headers["retry-after"],
      cacheControl: response.headers["cache-control"],
      releaseSha: response.headers["x-ht-release-sha"],
      location: response.headers.location,
      setCookie: response.headers["set-cookie"],
    }).toEqual({
      status: 503,
      body: {
        success: false,
        code: "AUTH_CUTOVER_MAINTENANCE",
        message: "Đăng nhập đang được bảo trì ngắn. Vui lòng thử lại sau.",
      },
      retryAfter: "60",
      cacheControl: "no-store",
      releaseSha: "a".repeat(40),
      location: undefined,
      setCookie: undefined,
    });
  });

  it("blocks refresh before CSRF/session handling without clearing credentials", async () => {
    process.env.AUTH_CUTOVER_MAINTENANCE = "true";

    const response = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", ["refreshToken=must-not-be-read"])
      .send({});

    expect({
      status: response.status,
      code: response.body.code,
      setCookie: response.headers["set-cookie"],
      blocked: getMetricsSnapshot().counters["auth.cutover_blocked"],
    }).toEqual({
      status: 503,
      code: "AUTH_CUTOVER_MAINTENANCE",
      setCookie: undefined,
      blocked: 1,
    });
  });

  it("drops arbitrary release metadata from blocked responses", async () => {
    process.env.AUTH_CUTOVER_MAINTENANCE = "true";
    process.env.RENDER_GIT_COMMIT = "not-a-public-sha\r\nx-injected: value";

    const response = await request(app).post("/api/auth/logout").send({});

    expect(response.headers["x-ht-release-sha"]).toBeUndefined();
  });

  it("preserves existing routing when the boundary is missing or false", async () => {
    const missing = await request(app).get(
      "/api/auth/google/callback?code=attacker-code",
    );
    process.env.AUTH_CUTOVER_MAINTENANCE = "false";
    const disabled = await request(app).get(
      "/api/auth/google/callback?code=attacker-code",
    );

    expect([missing.status, disabled.status]).toEqual([302, 302]);
  });
});
