import { describe, expect, it } from "vitest";
import { assertDeepseekTrialEnvironment, isDeepseekStagingTrial, validateDeepseekTrialEnvironment } from "../deepseekTrial.js";

const trial = () => ({
  NODE_ENV: "production", APP_ENV: "staging", AI_PROVIDER: "deepseek",
  AI_STAGING_PROVIDER_TRIAL: "deepseek", AI_KB_RETRIEVAL_MODE: "llm_selection",
  DEEPSEEK_MODEL: "deepseek-flash", DEEPSEEK_API_KEY: "d".repeat(32),
  MONGO_URI: "mongodb+srv://cluster.example/htcoaching_staging",
  CLIENT_URL: "https://staging--htcoachingweb.netlify.app",
  PUBLIC_API_ORIGIN: "https://htcoachingweb-staging.onrender.com",
  ALLOWED_ORIGINS: "https://staging--htcoachingweb.netlify.app",
  BACKGROUND_JOBS_ENABLED: "false", EMAIL_DELIVERY_MODE: "disabled",
  F1_RETENTION_ENFORCE: "false",
});

describe("explicit isolated DeepSeek trial", () => {
  it("accepts only the complete staging profile", () => {
    expect(validateDeepseekTrialEnvironment(trial())).toEqual({ valid: true, active: true, errors: [] });
  });
  it("does not alter the Gemini profile", () => {
    expect(validateDeepseekTrialEnvironment({ AI_PROVIDER: "gemini" })).toEqual({ valid: true, active: false, errors: [] });
  });
  it("accepts the verified Vibi model only within the full staging profile", () => {
    const env = {
      ...trial(),
      DEEPSEEK_ENDPOINT_PROFILE: "vibi",
      DEEPSEEK_MODEL: "deepseek-v4.1-flash",
    };
    expect(isDeepseekStagingTrial(env)).toBe(true);
    expect(isDeepseekStagingTrial({ ...env, APP_ENV: "production" })).toBe(false);
    expect(isDeepseekStagingTrial({ ...env, DEEPSEEK_MODEL: "deepseek-flash" })).toBe(false);
  });
  it("does not treat a gateway-only configuration as the default Gemini profile", () => {
    expect(validateDeepseekTrialEnvironment({
      AI_PROVIDER: "gemini",
      DEEPSEEK_ENDPOINT_PROFILE: "vibi",
    }).valid).toBe(false);
  });
  it.each([
    ["APP_ENV", "production"], ["APP_ENV", ""], ["AI_PROVIDER", "gemini"],
    ["AI_STAGING_PROVIDER_TRIAL", ""], ["AI_KB_RETRIEVAL_MODE", "vector"],
    ["DEEPSEEK_MODEL", "deepseek-flash?key=private"], ["DEEPSEEK_API_KEY", ""],
    ["DEEPSEEK_API_KEY", "tiny"], ["MONGO_URI", "mongodb+srv://cluster.example/htcoaching"],
    ["CLIENT_URL", "https://staging.evil.example"], ["PUBLIC_API_ORIGIN", "https://staging.evil.example"],
    ["ALLOWED_ORIGINS", "https://staging--htcoachingweb.netlify.app,https://staging.evil.example"],
    ["CLIENT_URL", "https://staging--htcoachingweb.netlify.app/path"],
    ["BACKGROUND_JOBS_ENABLED", "true"], ["EMAIL_DELIVERY_MODE", "live"],
  ])("rejects unsafe %s without exposing its value", (key, value) => {
    const env = { ...trial(), [key]: value };
    expect(isDeepseekStagingTrial(env)).toBe(false);
    expect(() => assertDeepseekTrialEnvironment(env)).toThrow(/DEEPSEEK_TRIAL_CONFIG_INVALID/);
    expect(JSON.stringify(validateDeepseekTrialEnvironment(env))).not.toContain("?key=private");
  });
});
