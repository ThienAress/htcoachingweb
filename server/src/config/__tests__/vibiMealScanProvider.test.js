import { describe, expect, it } from "vitest";
import { resolveMealScanProvider } from "../mealScanProvider.js";

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
  MONGO_URI: "mongodb+srv://cluster.example/gym-app",
  CLIENT_URL: "https://app.example.com",
  PUBLIC_API_ORIGIN: "https://api.example.com",
  ALLOWED_ORIGINS: "https://app.example.com",
  MEAL_SCAN_PROVIDER: "gemini",
});

describe("production Vibi chat with Gemini Meal Scan", () => {
  it("retains the explicitly selected Gemini image provider", () => {
    expect(resolveMealScanProvider(production())).toBe("gemini");
  });
  it.each([
    { MEAL_SCAN_PROVIDER: "mock" },
    { MEAL_SCAN_PROVIDER: "" },
    { AI_PRODUCTION_PROVIDER_PROFILE: "" },
    { BRAVE_SEARCH_API_KEY: "" },
  ])("does not enable Gemini through an invalid/missing profile or image selector %j", (change) => {
    expect(resolveMealScanProvider({ ...production(), ...change })).toBe("deepseek");
  });
});
