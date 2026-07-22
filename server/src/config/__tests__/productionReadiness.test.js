import { describe, expect, it } from "vitest";
import {
  assertProductionEnvironment,
  validateProductionEnvironment,
} from "../productionReadiness.js";
import { generateStageImagesWithAI } from "../../services/aiImageGenerator.service.js";

const validEnvironment = () => ({
  NODE_ENV: "production",
  MONGO_URI:
    "mongodb+srv://" +
    "app:password@cluster.example/htcoaching?retryWrites=true&w=majority",
  JWT_SECRET: "jwt-" + "a".repeat(64),
  REFRESH_SECRET: "refresh-" + "b".repeat(64),
  LOG_HASH_SECRET: "log-" + "c".repeat(64),
  CLIENT_URL: "https://app.example.com",
  ALLOWED_ORIGINS: "https://app.example.com",
  PREVIEW_ORIGINS: "https://preview.example.com",
  PUBLIC_API_ORIGIN: "https://api.example.com",
  GOOGLE_CALLBACK_URL: "https://api.example.com/api/auth/google/callback",
  GOOGLE_CLIENT_ID: "google-client-id",
  GOOGLE_CLIENT_SECRET: "google-secret-" + "d".repeat(32),
  F1_MEDIA_STORAGE_PROVIDER: "cloudinary",
  CLOUDINARY_CLOUD_NAME: "htcoaching",
  CLOUDINARY_API_KEY: "1234567890",
  CLOUDINARY_API_SECRET: "cloudinary-" + "e".repeat(32),
  OPS_METRICS_TOKEN: "ops-" + "f".repeat(32),
  RESEND_API_KEY: "resend-" + "g".repeat(32),
  AI_PROVIDER: "gemini",
  GEMINI_API_KEY: "gemini-" + "h".repeat(32),
  AI_IMAGE_PROVIDER: "openai",
  OPENAI_API_KEY: "openai-" + "i".repeat(32),
  BANK_NAME: "Production Bank",
  BANK_CODE: "BANK",
  BANK_ACCOUNT: "123456789",
  BANK_HOLDER: "HT COACHING",
  F1_CONSENT_VERSION: "2026-07",
  ADMIN_EMAIL: "admin@htcoachingweb.io.vn",
  TRUST_PROXY_HOPS: "1",
  BACKGROUND_JOBS_ENABLED: "true",
  CSP_ENFORCE: "true",
  F1_RETENTION_ENFORCE: "false",
  SERVER_HEADERS_TIMEOUT_MS: "15000",
  SERVER_REQUEST_TIMEOUT_MS: "120000",
  SERVER_KEEP_ALIVE_TIMEOUT_MS: "65000",
  SERVER_SHUTDOWN_TIMEOUT_MS: "15000",
});

describe("production readiness configuration", () => {
  it("accepts a complete explicit production profile", () => {
    const result = validateProductionEnvironment(validEnvironment(), {
      strict: true,
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.summary).toEqual(
      expect.objectContaining({
        allowedOriginCount: 1,
        hasExplicitTrustProxy: true,
        backgroundJobsExplicit: true,
        cspEnforced: true,
      }),
    );
  });

  it("rejects weak secrets, insecure origins, local MongoDB and mock providers", () => {
    const env = validEnvironment();
    env.MONGO_URI = "mongodb://localhost:27017/production";
    env.JWT_SECRET = "replace-me";
    env.REFRESH_SECRET = "replace-me";
    env.CLIENT_URL = "http://app.example.com/path";
    env.ALLOWED_ORIGINS = "*";
    env.AI_PROVIDER = "mock";
    env.AI_IMAGE_PROVIDER = "mock";

    const result = validateProductionEnvironment(env, { strict: true });
    const codes = result.errors.map((finding) => finding.code);

    expect(result.valid).toBe(false);
    expect(codes).toEqual(
      expect.arrayContaining([
        "MONGO_URI_LOCALHOST",
        "MONGO_URI_TLS_REQUIRED",
        "JWT_SECRET_WEAK",
        "JWT_SECRET_PLACEHOLDER",
        "AUTH_SECRETS_NOT_DISTINCT",
        "CLIENT_URL_HTTPS_REQUIRED",
        "CLIENT_URL_ORIGIN_REQUIRED",
        "ALLOWED_ORIGINS_WILDCARD_FORBIDDEN",
        "AI_PROVIDER_NOT_PRODUCTION",
        "AI_IMAGE_PROVIDER_NOT_PRODUCTION",
      ]),
    );
  });

  it("keeps optional operational integrations as startup warnings", () => {
    const env = validEnvironment();
    delete env.LOG_HASH_SECRET;
    delete env.OPS_METRICS_TOKEN;
    delete env.RESEND_API_KEY;
    delete env.PUBLIC_API_ORIGIN;
    delete env.TRUST_PROXY_HOPS;
    delete env.BACKGROUND_JOBS_ENABLED;
    env.CSP_ENFORCE = "false";

    const result = validateProductionEnvironment(env, { strict: false });

    expect(result.errors).toEqual([]);
    expect(result.warnings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining([
        "LOG_HASH_SECRET_MISSING",
        "OPS_METRICS_TOKEN_MISSING",
        "TRUST_PROXY_HOPS_NOT_EXPLICIT",
        "BACKGROUND_JOBS_ENABLED_NOT_EXPLICIT",
        "CSP_REPORT_ONLY",
      ]),
    );
  });

  it("throws only safe finding codes and never includes secret values", () => {
    const env = validEnvironment();
    const leakedValue = "replace-me-private-value";
    env.JWT_SECRET = leakedValue;

    expect(() =>
      assertProductionEnvironment(env, { strict: true }),
    ).toThrowError(/JWT_SECRET_/);

    try {
      assertProductionEnvironment(env, { strict: true });
    } catch (error) {
      expect(error.message).not.toContain(leakedValue);
      expect(JSON.stringify(error.findings)).not.toContain(leakedValue);
    }
  });

  it("forbids the deterministic image mock in production", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalProvider = process.env.AI_IMAGE_PROVIDER;
    process.env.NODE_ENV = "production";
    process.env.AI_IMAGE_PROVIDER = "mock";
    try {
      await expect(
        generateStageImagesWithAI({
          beforeImages: {},
          prompts: {},
          context: {},
          phaseKey: "phase1",
        }),
      ).rejects.toMatchObject({
        code: "AI_IMAGE_PROVIDER_NOT_CONFIGURED",
        status: 503,
      });
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      process.env.AI_IMAGE_PROVIDER = originalProvider;
    }
  });
});
