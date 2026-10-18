import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../utils/safeLogger.js", () => ({ safeLog: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("../../observability/metrics.js", () => ({ incrementMetric: vi.fn() }));

import { errorHandler } from "../errorHandler.js";

const appThatThrows = (error) => {
  const app = express();
  app.get("/boom", (_req, _res, next) => next(error));
  app.use(errorHandler);
  return app;
};

const TECHNICAL = /server|token|\bapi\b|mongo|e11000|index|stack|undefined|\b5\d\d\b/i;

describe("errorHandler", () => {
  it("answers an unknown failure with a friendly message and a code, never the raw error", async () => {
    const res = await request(appThatThrows(new Error("connect ECONNREFUSED 10.0.0.5:27017"))).get("/boom");

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      code: "INTERNAL_ERROR",
      message: "Hệ thống đang bận. Bạn vui lòng thử lại sau ít phút.",
    });
    expect(JSON.stringify(res.body)).not.toMatch(/ECONNREFUSED|10\.0\.0\.5/);
  });

  it("does not leak the database field name on a duplicate key", async () => {
    const res = await request(appThatThrows(Object.assign(new Error("E11000"), { code: 11000, keyPattern: { email: 1 } }))).get("/boom");

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("DUPLICATE_VALUE");
    expect(JSON.stringify(res.body)).not.toMatch(/email|E11000/);
  });

  it("describes an invalid session without the word token", async () => {
    const res = await request(appThatThrows(Object.assign(new Error("jwt malformed"), { name: "JsonWebTokenError" }))).get("/boom");

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("SESSION_INVALID");
    expect(res.body.message).not.toMatch(TECHNICAL);
  });

  it("does not echo library validation messages", async () => {
    const error = Object.assign(new Error("User validation failed: email: Path `email` is required."), {
      name: "ValidationError",
      errors: { email: { message: "Path `email` is required." } },
    });
    const res = await request(appThatThrows(error)).get("/boom");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_FAILED");
    expect(res.body.message).not.toContain("Path");
  });

  it("keeps a controlled 4xx message and code when the error is marked expose", async () => {
    const error = Object.assign(new Error("Đơn này đã được duyệt"), { status: 409, code: "ORDER_ALREADY_APPROVED", expose: true });
    const res = await request(appThatThrows(error)).get("/boom");

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: "ORDER_ALREADY_APPROVED", message: "Đơn này đã được duyệt" });
  });

  it("hides an unmarked 4xx message behind the status default", async () => {
    const res = await request(appThatThrows(Object.assign(new Error("Unexpected token } in JSON at position 4"), { status: 400 }))).get("/boom");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("BAD_REQUEST");
    expect(res.body.message).not.toMatch(/JSON|token/i);
  });
});
