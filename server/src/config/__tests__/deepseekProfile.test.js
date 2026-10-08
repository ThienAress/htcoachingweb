import { describe, expect, it } from "vitest";
import { validateDeepseekProfile } from "../deepseekProfile.js";
import { validateDeepseekTrialEnvironment } from "../deepseekTrial.js";

const production = () => ({
  NODE_ENV: "production",
  APP_ENV: "production",
  AI_PROVIDER: "deepseek",
  AI_PRODUCTION_PROVIDER_PROFILE: "vibi",
  AI_KB_RETRIEVAL_MODE: "llm_selection",
  DEEPSEEK_ENDPOINT_PROFILE: "vibi",
  DEEPSEEK_MODEL: "deepseek-v4.1-flash",
  DEEPSEEK_API_KEY: "synthetic-" + "d".repeat(32),
  AI_WEB_SEARCH_PROVIDER: "brave",
  BRAVE_SEARCH_API_KEY: "synthetic-" + "b".repeat(32),
  MONGO_URI: "mongodb+srv://cluster.example/gym-app?retryWrites=true",
  CLIENT_URL: "https://app.example.com",
  PUBLIC_API_ORIGIN: "https://api.example.com",
  ALLOWED_ORIGINS: "https://app.example.com,https://alternate.example.com",
});

describe("explicit Vibi production profile", () => {
  it("accepts production opt-in without treating it as a staging trial", () => {
    expect(validateDeepseekProfile(production())).toMatchObject({ valid: true, active: true, profile: "production" });
    expect(validateDeepseekTrialEnvironment(production()).valid).toBe(false);
  });

  it.each([
    ["APP_ENV", "staging"],
    ["NODE_ENV", "development"],
    ["AI_PROVIDER", "gemini"],
    ["AI_PRODUCTION_PROVIDER_PROFILE", "official"],
    ["AI_PRODUCTION_PROVIDER_PROFILE", ""],
    ["AI_STAGING_PROVIDER_TRIAL", "deepseek"],
    ["AI_KB_RETRIEVAL_MODE", "vector"],
    ["DEEPSEEK_ENDPOINT_PROFILE", "official"],
    ["DEEPSEEK_MODEL", "deepseek-flash"],
    ["DEEPSEEK_API_KEY", ""],
    ["AI_WEB_SEARCH_PROVIDER", "gemini"],
    ["BRAVE_SEARCH_API_KEY", ""],
    ["MONGO_URI", "mongodb+srv://cluster.example/htcoaching_staging"],
    ["MONGO_URI", "mongodb+srv://cluster.example/another-production"],
    ["CLIENT_URL", "http://localhost"],
    ["CLIENT_URL", "https://staging--htcoachingweb.netlify.app"],
    ["PUBLIC_API_ORIGIN", "https://api.example.com/path"],
    ["ALLOWED_ORIGINS", "https://staging--htcoachingweb.netlify.app"],
    ["ALLOWED_ORIGINS", "https://app.example.com,*"],
  ])("rejects unsafe %s", (key, value) => {
    const env = { ...production(), [key]: value };
    const result = validateDeepseekProfile(env);
    expect(result.valid).toBe(false);
    expect(result.active).toBe(false);
    if (env.DEEPSEEK_API_KEY) expect(JSON.stringify(result.errors)).not.toContain(env.DEEPSEEK_API_KEY);
  });

  it("keeps Gemini inactive without a production opt-in", () => {
    expect(validateDeepseekProfile({ AI_PROVIDER: "gemini" })).toMatchObject({ valid: true, active: false });
  });
});
