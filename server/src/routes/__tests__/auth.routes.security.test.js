import { beforeAll, describe, expect, it } from "vitest";
import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import authRoutes from "../auth.routes.js";

let app;

beforeAll(() => {
  app = express();
  app.use(cookieParser());
  app.use("/api/auth", authRoutes);
});

describe("auth route security guards", () => {
  it("rejects OAuth callbacks without browser-bound state before Passport", async () => {
    const response = await request(app).get(
      "/api/auth/google/callback?code=attacker-code",
    );

    expect(response.status).toBe(302);
    expect(response.headers.location).toContain("invalid_oauth_state");
  });

  it("does not register dev-login without explicit development opt-in", async () => {
    const response = await request(app).get(
      "/api/auth/dev-login?email=someone@example.com",
    );

    expect(response.status).toBe(404);
  });
});
