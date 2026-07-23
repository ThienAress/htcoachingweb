import { describe, expect, it } from "vitest";
import { getSecuritySmokeConfiguration } from "../securitySmoke.js";

describe("read-only security smoke configuration", () => {
  it("requires an explicit remote execution approval", () => {
    expect(() =>
      getSecuritySmokeConfiguration({
        SECURITY_SMOKE_BASE_URL: "https://api.example.com",
        SECURITY_SMOKE_ALLOWED_ORIGIN: "https://app.example.com",
      }),
    ).toThrow(/ALLOW_REMOTE_SECURITY_SMOKE/);
  });

  it("accepts HTTPS origins and bounded timeouts", () => {
    const result = getSecuritySmokeConfiguration({
      ALLOW_REMOTE_SECURITY_SMOKE: "true",
      SECURITY_SMOKE_BASE_URL: "https://api.example.com",
      SECURITY_SMOKE_ALLOWED_ORIGIN: "https://app.example.com",
      SECURITY_SMOKE_TIMEOUT_MS: "5000",
    });

    expect(result).toEqual({
      baseUrl: "https://api.example.com",
      allowedOrigin: "https://app.example.com",
      timeoutMs: 5000,
    });
  });

  it("rejects credentials, paths and non-local plain HTTP", () => {
    expect(() =>
      getSecuritySmokeConfiguration({
        ALLOW_REMOTE_SECURITY_SMOKE: "true",
        SECURITY_SMOKE_BASE_URL: "http://api.example.com",
        SECURITY_SMOKE_ALLOWED_ORIGIN: "https://app.example.com",
      }),
    ).toThrow(/HTTPS/);

    expect(() =>
      getSecuritySmokeConfiguration({
        ALLOW_REMOTE_SECURITY_SMOKE: "true",
        SECURITY_SMOKE_BASE_URL: "https://user:pass@api.example.com/path",
        SECURITY_SMOKE_ALLOWED_ORIGIN: "https://app.example.com",
      }),
    ).toThrow(/origin without credentials or path/);
  });

  it("allows localhost HTTP for isolated local verification only", () => {
    const result = getSecuritySmokeConfiguration({
      ALLOW_REMOTE_SECURITY_SMOKE: "true",
      SECURITY_SMOKE_BASE_URL: "http://127.0.0.1:5100",
      SECURITY_SMOKE_ALLOWED_ORIGIN: "http://localhost:4174",
    });

    expect(result.baseUrl).toBe("http://127.0.0.1:5100");
    expect(result.allowedOrigin).toBe("http://localhost:4174");
  });
});
