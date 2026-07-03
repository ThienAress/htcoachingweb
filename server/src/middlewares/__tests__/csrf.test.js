import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";

import { csrfProtection, generateCsrfToken } from "../csrf.js";

// =============================================================================
// Integration Test: CSRF Middleware
// Không cần DB — test pure middleware behavior
// =============================================================================

let app;

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use(cookieParser());

  // Route GET (safe method — bypass CSRF)
  app.get("/test/data", csrfProtection, (req, res) => {
    res.json({ success: true, method: "GET" });
  });

  // Route POST (mutating — cần CSRF)
  app.post("/test/action", csrfProtection, (req, res) => {
    res.json({ success: true, method: "POST" });
  });

  // Route PUT
  app.put("/test/update", csrfProtection, (req, res) => {
    res.json({ success: true, method: "PUT" });
  });

  // Route DELETE
  app.delete("/test/delete", csrfProtection, (req, res) => {
    res.json({ success: true, method: "DELETE" });
  });
});

describe("csrfProtection middleware", () => {
  // --- Safe methods (bypass) ---
  it("GET request bypass CSRF — không cần token", async () => {
    const res = await request(app).get("/test/data");
    expect(res.status).toBe(200);
    expect(res.body.method).toBe("GET");
  });

  // --- Mutating methods (cần CSRF) ---
  it("POST với valid CSRF token → cho phép", async () => {
    const csrfToken = generateCsrfToken();

    const res = await request(app)
      .post("/test/action")
      .set("Cookie", [`csrfToken=${csrfToken}`])
      .set("X-CSRF-Token", csrfToken)
      .send({ data: "test" });

    expect(res.status).toBe(200);
    expect(res.body.method).toBe("POST");
  });

  it("PUT với valid CSRF token → cho phép", async () => {
    const csrfToken = generateCsrfToken();

    const res = await request(app)
      .put("/test/update")
      .set("Cookie", [`csrfToken=${csrfToken}`])
      .set("X-CSRF-Token", csrfToken)
      .send({ data: "test" });

    expect(res.status).toBe(200);
  });

  it("DELETE với valid CSRF token → cho phép", async () => {
    const csrfToken = generateCsrfToken();

    const res = await request(app)
      .delete("/test/delete")
      .set("Cookie", [`csrfToken=${csrfToken}`])
      .set("X-CSRF-Token", csrfToken);

    expect(res.status).toBe(200);
  });

  // --- Missing CSRF ---
  it("POST không có CSRF cookie → 403", async () => {
    const res = await request(app)
      .post("/test/action")
      .set("X-CSRF-Token", "some-token")
      .send({ data: "test" });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("CSRF token missing");
  });

  it("POST không có CSRF header → 403", async () => {
    const res = await request(app)
      .post("/test/action")
      .set("Cookie", ["csrfToken=some-token"])
      .send({ data: "test" });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("CSRF token missing");
  });

  it("POST không có cả cookie lẫn header → 403", async () => {
    const res = await request(app)
      .post("/test/action")
      .send({ data: "test" });

    expect(res.status).toBe(403);
  });

  // --- Mismatched CSRF ---
  it("POST với CSRF cookie ≠ CSRF header → 403 Invalid", async () => {
    const res = await request(app)
      .post("/test/action")
      .set("Cookie", ["csrfToken=token-from-cookie"])
      .set("X-CSRF-Token", "different-token-from-header")
      .send({ data: "test" });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Invalid CSRF token");
  });
});

describe("generateCsrfToken", () => {
  it("tạo token dạng hex string", () => {
    const token = generateCsrfToken();
    expect(token).toMatch(/^[a-f0-9]+$/);
  });

  it("token có độ dài 64 ký tự (32 bytes hex)", () => {
    const token = generateCsrfToken();
    expect(token.length).toBe(64);
  });

  it("mỗi lần gọi tạo token khác nhau", () => {
    const t1 = generateCsrfToken();
    const t2 = generateCsrfToken();
    expect(t1).not.toBe(t2);
  });
});
