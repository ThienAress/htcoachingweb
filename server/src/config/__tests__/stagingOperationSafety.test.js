import { describe, expect, it } from "vitest";
import {
  assertStagingOperation,
  validateStagingOperation,
} from "../stagingOperationSafety.js";

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
  CONFIRM_STAGING_SEED: "yes",
});

describe("staging operation safety", () => {
  it("accepts an explicitly confirmed isolated staging operation", () => {
    expect(
      validateStagingOperation({
        env: validEnvironment(),
        confirmationVariable: "CONFIRM_STAGING_SEED",
      }),
    ).toEqual({ valid: true, errors: [] });
  });

  it("rejects production, missing confirmations and non-staging profiles", () => {
    const env = validEnvironment();
    env.APP_ENV = "production";
    env.MONGO_URI = "mongodb+srv://cluster.example/htcoaching";
    delete env.CONFIRM_STAGING_SEED;

    const result = validateStagingOperation({
      env,
      confirmationVariable: "CONFIRM_STAGING_SEED",
    });

    expect(result.errors).toEqual(
      expect.arrayContaining([
        "STAGING_OPERATION_ENV_REQUIRED",
        "STAGING_OPERATION_DATABASE_REQUIRED",
        "STAGING_OPERATION_CONFIRMATION_REQUIRED",
      ]),
    );
  });

  it("throws finding codes without secret values", () => {
    const env = validEnvironment();
    delete env.CONFIRM_STAGING_SEED;

    expect(() =>
      assertStagingOperation({
        env,
        confirmationVariable: "CONFIRM_STAGING_SEED",
      }),
    ).toThrowError(/STAGING_OPERATION_CONFIRMATION_REQUIRED/);
  });
});
