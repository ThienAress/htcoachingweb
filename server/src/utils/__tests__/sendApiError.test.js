import { describe, expect, it, vi } from "vitest";

vi.mock("../safeLogger.js", () => ({ safeLog: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import { safeLog } from "../safeLogger.js";
import { sendApiError } from "../sendApiError.js";
import { codeForStatus, isErrorCode, messageForStatus, normalizeErrorStatus } from "../errorMessages.js";

const fakeRes = () => {
  const res = { statusCode: null, body: null };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
};

describe("sendApiError", () => {
  it("hides technical details of a server failure and logs them instead", () => {
    const res = fakeRes();
    sendApiError(res, new Error("E11000 duplicate key collection: users index: email_1"), "test.failed");

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({
      success: false,
      code: "INTERNAL_ERROR",
      message: "Hệ thống đang bận. Bạn vui lòng thử lại sau ít phút.",
    });
    expect(safeLog.error).toHaveBeenCalledWith("test.failed", expect.any(Error));
  });

  it("returns the thrown message for a 4xx only when the error is marked as exposable", () => {
    const exposed = Object.assign(new Error("Số buổi còn lại không đủ"), {
      status: 409,
      code: "SESSIONS_EXHAUSTED",
      expose: true,
    });
    const plain = Object.assign(new Error("duplicate key"), { status: 409 });

    const a = fakeRes();
    const b = fakeRes();
    sendApiError(a, exposed, "e");
    sendApiError(b, plain, "e");

    expect(a.body).toEqual({ success: false, code: "SESSIONS_EXHAUSTED", message: "Số buổi còn lại không đủ" });
    expect(b.body.message).toBe(messageForStatus(409));
    expect(b.body.code).toBe("CONFLICT");
  });

  it("lets a controller vouch for its own Vietnamese 4xx messages", () => {
    const res = fakeRes();
    sendApiError(res, Object.assign(new Error("Ngày không hợp lệ"), { statusCode: 400 }), "e", {
      exposeClientMessage: true,
    });

    expect(res.body.message).toBe("Ngày không hợp lệ");
  });

  it("never exposes the message of a 5xx, even with expose or exposeClientMessage", () => {
    const res = fakeRes();
    sendApiError(res, Object.assign(new Error("mongo down at 10.0.0.5"), { status: 503, expose: true }), "e", {
      exposeClientMessage: true,
    });

    expect(res.statusCode).toBe(503);
    expect(res.body.message).not.toContain("10.0.0.5");
    expect(res.body.code).toBe("SERVICE_UNAVAILABLE");
  });

  it("ignores driver numeric codes and free text codes", () => {
    const res = fakeRes();
    sendApiError(res, Object.assign(new Error("x"), { status: 400, code: 11000 }), "e");
    expect(res.body.code).toBe("BAD_REQUEST");
    expect(isErrorCode("some text")).toBe(false);
    expect(isErrorCode("ORDER_ALREADY_PAID")).toBe(true);
  });

  it("falls back to 500 for statuses that are not errors", () => {
    expect(normalizeErrorStatus(302)).toBe(500);
    expect(normalizeErrorStatus(undefined)).toBe(500);
    expect(normalizeErrorStatus(404)).toBe(404);
    expect(codeForStatus(418)).toBe("INTERNAL_ERROR");
  });

  it("uses plain Vietnamese with no technical words in every default message", () => {
    for (const status of [400, 401, 403, 404, 409, 413, 422, 429, 500, 503]) {
      expect(messageForStatus(status)).not.toMatch(/server|token|api|\b5\d\d\b|lỗi hệ thống|undefined/i);
    }
  });
});
