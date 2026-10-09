import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { vector, selection } = vi.hoisted(() => ({ vector: vi.fn(), selection: vi.fn() }));
vi.mock("../embedding.service.js", () => ({ searchKnowledgeBase: vector }));
vi.mock("../deepseekKnowledgeSelection.service.js", () => ({ searchDeepseekKnowledgeBase: selection }));
import { searchAssistantKnowledgeBase } from "../knowledgeRetrieval.service.js";

const configureTrial = () => {
  const env = {
    APP_ENV: "staging", AI_PROVIDER: "deepseek", AI_STAGING_PROVIDER_TRIAL: "deepseek",
    AI_KB_RETRIEVAL_MODE: "llm_selection", DEEPSEEK_MODEL: "deepseek-flash",
    DEEPSEEK_API_KEY: "synthetic-" + "d".repeat(32),
    MONGO_URI: "mongodb://localhost/htcoaching_staging",
    CLIENT_URL: "https://staging--htcoachingweb.netlify.app",
    PUBLIC_API_ORIGIN: "https://htcoachingweb-staging.onrender.com",
    ALLOWED_ORIGINS: "https://staging--htcoachingweb.netlify.app",
    BACKGROUND_JOBS_ENABLED: "false", EMAIL_DELIVERY_MODE: "disabled", F1_RETENTION_ENFORCE: "false",
  };
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
};
beforeEach(() => {
  vi.stubEnv("AI_PROVIDER", "gemini"); vi.stubEnv("AI_STAGING_PROVIDER_TRIAL", "");
  vi.stubEnv("AI_KB_RETRIEVAL_MODE", "vector");
  vector.mockReset(); selection.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe("assistant retrieval facade", () => {
  it("uses bounded selection in the explicit production profile with no vector fallback", async () => {
    configureTrial();
    const env = {
      NODE_ENV: "production", APP_ENV: "production", AI_STAGING_PROVIDER_TRIAL: "",
      AI_PRODUCTION_PROVIDER_PROFILE: "vibi", DEEPSEEK_ENDPOINT_PROFILE: "vibi",
      DEEPSEEK_MODEL: "deepseek-v4.1-flash", MONGO_URI: "mongodb+srv://cluster.example/gym-app",
      CLIENT_URL: "https://app.example.com", PUBLIC_API_ORIGIN: "https://api.example.com",
      ALLOWED_ORIGINS: "https://app.example.com", AI_WEB_SEARCH_PROVIDER: "brave",
      BRAVE_SEARCH_API_KEY: "synthetic-" + "b".repeat(32),
    };
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
    const result = { results: [], retrieval: { method: "llm_selection" } };
    selection.mockResolvedValue(result);
    expect(await searchAssistantKnowledgeBase("Protein?")).toEqual(result);
    expect(vector).not.toHaveBeenCalled();
  });
  it("preserves vector options and results outside the trial", async () => {
    const results = [{ question: "Protein?", similarity: 0.8 }]; vector.mockResolvedValue(results);
    const options = { limit: 3, threshold: 0.75 };
    expect(await searchAssistantKnowledgeBase("Protein?", options)).toEqual({ results, retrieval: { method: "vector" } });
    expect(vector).toHaveBeenCalledWith("Protein?", options); expect(selection).not.toHaveBeenCalled();
  });
  it("dispatches only to selection with cancellation/deadline preserved", async () => {
    configureTrial(); const result = { results: [], retrieval: { method: "llm_selection", coverage: "full" } };
    selection.mockResolvedValue(result); const options = { signal: new AbortController().signal, deadlineAt: Date.now() + 1000 };
    expect(await searchAssistantKnowledgeBase("Protein?", options)).toEqual(result);
    expect(selection).toHaveBeenCalledWith("Protein?", options); expect(vector).not.toHaveBeenCalled();
  });
  it("surfaces corpus failure without vector fallback", async () => {
    configureTrial(); selection.mockRejectedValue(Object.assign(new Error("KB_TRIAL_CORPUS_LIMIT"), { code: "KB_TRIAL_CORPUS_LIMIT" }));
    await expect(searchAssistantKnowledgeBase("Protein?")).rejects.toMatchObject({ code: "KB_TRIAL_CORPUS_LIMIT" });
    expect(vector).not.toHaveBeenCalled();
  });
  it("rejects mixed configuration before either retrieval provider", async () => {
    configureTrial(); vi.stubEnv("APP_ENV", "production");
    await expect(searchAssistantKnowledgeBase("Protein?")).rejects.toMatchObject({ code: "DEEPSEEK_TRIAL_CONFIG_INVALID" });
    expect(vector).not.toHaveBeenCalled(); expect(selection).not.toHaveBeenCalled();
  });
});
