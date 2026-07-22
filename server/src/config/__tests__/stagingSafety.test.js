import { describe, expect, it } from "vitest";
import {
  assertStagingEnvironment,
  validateStagingEnvironment,
} from "../stagingSafety.js";

const validEnvironment = () => ({
  APP_ENV: "staging",
  MONGO_URI:
    "mongodb+srv://cluster.example/htcoaching_staging?retryWrites=true",
  CLIENT_URL: "https://staging--htcoachingweb.netlify.app",
  PUBLIC_API_ORIGIN: "https://htcoachingweb-staging.onrender.com",
  ALLOWED_ORIGINS: "https://staging--htcoachingweb.netlify.app",
  BACKGROUND_JOBS_ENABLED: "false",
  EMAIL_DELIVERY_MODE: "disabled",
  F1_RETENTION_ENFORCE: "false",
});

describe("staging environment safety", () => {
  it("accepts an isolated staging profile", () => {
    expect(validateStagingEnvironment(validEnvironment())).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("rejects production data, origins and side effects", () => {
    const env = validEnvironment();
    env.MONGO_URI =
      "mongodb+srv://cluster.example/htcoaching?retryWrites=true";
    env.CLIENT_URL = "https://htcoachingweb.io.vn";
    env.PUBLIC_API_ORIGIN = "https://htcoachingweb.onrender.com";
    env.ALLOWED_ORIGINS = "https://htcoachingweb.io.vn";
    env.BACKGROUND_JOBS_ENABLED = "true";
    env.EMAIL_DELIVERY_MODE = "live";
    env.F1_RETENTION_ENFORCE = "true";
    env.NETLIFY_BUILD_HOOK_URL = "https://api.netlify.com/build_hooks/example";

    const result = validateStagingEnvironment(env);
    const codes = result.errors.map((finding) => finding.code);

    expect(codes).toEqual(
      expect.arrayContaining([
        "STAGING_DATABASE_REQUIRED",
        "STAGING_BACKGROUND_JOBS_FORBIDDEN",
        "STAGING_EMAIL_DELIVERY_FORBIDDEN",
        "STAGING_CLIENT_ORIGIN_REQUIRED",
        "STAGING_API_ORIGIN_REQUIRED",
        "STAGING_PRODUCTION_ORIGIN_FORBIDDEN",
        "STAGING_RETENTION_ENFORCEMENT_FORBIDDEN",
        "STAGING_BUILD_HOOK_FORBIDDEN",
      ]),
    );
  });

  it("throws only finding codes", () => {
    const env = validEnvironment();
    env.MONGO_URI = "mongodb+srv://cluster.example/production";

    expect(() => assertStagingEnvironment(env)).toThrowError(
      /STAGING_DATABASE_REQUIRED/,
    );
  });
});
