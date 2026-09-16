import { describe, expect, it, vi } from "vitest";
import { runWithRequestContext } from "../requestContext.js";
import { safeLog, sanitizeForLog } from "../safeLogger.js";

describe("sanitizeForLog", () => {
  it("redacts case-insensitive sensitive keys at every nesting level", () => {
    const sanitized = sanitizeForLog({
      accessToken: "access-secret",
      profile: {
        NewPassword: "password-secret",
        email: "client@example.com",
      },
      sessions: [
        {
          refreshToken: "refresh-secret",
          csrfToken: "csrf-secret",
          status: "active",
        },
      ],
    });

    expect(sanitized).toEqual({
      accessToken: "[REDACTED]",
      profile: {
        NewPassword: "[REDACTED]",
        email: "[REDACTED]",
      },
      sessions: [
        {
          refreshToken: "[REDACTED]",
          csrfToken: "[REDACTED]",
          status: "active",
        },
      ],
    });
  });

  it("redacts PII and signed query strings from primitive messages", () => {
    const sanitized = sanitizeForLog({
      errorMessage:
        "Mail to client@example.com and 0912345678 failed at https://cdn.test/body.webp?token=secret",
      signedUrl: "https://cdn.test/private?token=secret",
    });

    expect(sanitized.errorMessage).not.toContain("client@example.com");
    expect(sanitized.errorMessage).not.toContain("0912345678");
    expect(sanitized.errorMessage).not.toContain("token=secret");
    expect(sanitized.signedUrl).toBe("[REDACTED]");
  });
});

it("preserves request correlation when a context exists", () => {
  const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  try {
    expect(() => runWithRequestContext(
      { requestId: "internal-request", traceId: "internal-trace" },
      () => safeLog.info("http.request"),
    )).not.toThrow();
    expect(JSON.parse(logSpy.mock.calls[0][0])).toMatchObject({
      requestId: "internal-request",
      traceId: "internal-trace",
      event: "http.request",
    });
  } finally {
    logSpy.mockRestore();
  }
});

it("logs safely when no request context exists", () => {
  const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  try {
    expect(() => safeLog.info("server.startup")).not.toThrow();
    expect(JSON.parse(logSpy.mock.calls[0][0])).not.toHaveProperty("requestId");
  } finally {
    logSpy.mockRestore();
  }
});

it("redacts phone-shaped correlation values before writing logs", () => {
  const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  try {
    runWithRequestContext(
      { requestId: "0912345678", traceId: "internal-trace" },
      () => safeLog.info("http.request"),
    );
    const entry = JSON.parse(logSpy.mock.calls[0][0]);
    expect(entry.requestId).toBe("[REDACTED_PHONE]");
    expect(entry.traceId).toBe("internal-trace");
  } finally {
    logSpy.mockRestore();
  }
});
