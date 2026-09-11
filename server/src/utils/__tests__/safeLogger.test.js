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

it("preserves request correlation without crashing startup logging", () => {
  const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  try {
    expect(() => runWithRequestContext(
      { requestId: "drill-request", traceId: "drill-trace" },
      () => safeLog.info("server.startup"),
    )).not.toThrow();
    expect(JSON.parse(logSpy.mock.calls[0][0])).toMatchObject({
      requestId: "drill-request",
      traceId: "drill-trace",
      event: "server.startup",
    });
  } finally {
    logSpy.mockRestore();
  }
});
