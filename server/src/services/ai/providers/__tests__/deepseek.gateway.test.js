import { afterEach, describe, expect, it, vi } from "vitest";
import { deepseekLLMStream } from "../deepseek.provider.js";

vi.mock("../../../../observability/providerUsageMetrics.js", () => ({
  recordDeepSeekRequest: vi.fn(),
  recordDeepSeekResult: vi.fn(),
}));

const trial = {
  NODE_ENV: "production",
  APP_ENV: "staging",
  AI_PROVIDER: "deepseek",
  AI_STAGING_PROVIDER_TRIAL: "deepseek",
  AI_KB_RETRIEVAL_MODE: "llm_selection",
  DEEPSEEK_ENDPOINT_PROFILE: "vibi",
  DEEPSEEK_MODEL: "deepseek-v4.1-flash",
  DEEPSEEK_API_KEY: "synthetic".repeat(4),
  MONGO_URI: "mongodb+srv://cluster.example/htcoaching_staging",
  CLIENT_URL: "https://staging--htcoachingweb.netlify.app",
  PUBLIC_API_ORIGIN: "https://htcoachingweb-staging.onrender.com",
  ALLOWED_ORIGINS: "https://staging--htcoachingweb.netlify.app",
  BACKGROUND_JOBS_ENABLED: "false",
  EMAIL_DELIVERY_MODE: "disabled",
  F1_RETENTION_ENFORCE: "false",
};

const configure = (overrides = {}) => {
  for (const [name, value] of Object.entries({ ...trial, ...overrides })) {
    vi.stubEnv(name, value);
  }
};

const collect = async (stream) => {
  const events = [];
  for await (const event of stream) events.push(event);
  return events;
};

const completeText = () => new Response(
  'data: {"choices":[{"delta":{"content":"OK"},"finish_reason":"stop"}]}\n\n' +
  'data: [DONE]\n\n',
  { status: 200 },
);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("isolated Vibi DeepSeek gateway", () => {
  it("uses the same fixed gateway only after complete production opt-in", async () => {
    configure({
      APP_ENV: "production", AI_STAGING_PROVIDER_TRIAL: "", AI_PRODUCTION_PROVIDER_PROFILE: "vibi",
      MONGO_URI: "mongodb+srv://cluster.example/gym-app",
      CLIENT_URL: "https://app.example.com", PUBLIC_API_ORIGIN: "https://api.example.com",
      ALLOWED_ORIGINS: "https://app.example.com", AI_WEB_SEARCH_PROVIDER: "brave",
      BRAVE_SEARCH_API_KEY: "synthetic-" + "b".repeat(32),
    });
    const fetchMock = vi.fn().mockResolvedValue(completeText());
    vi.stubGlobal("fetch", fetchMock);
    await expect(collect(deepseekLLMStream([{ role: "user", content: "Synthetic probe" }])))
      .resolves.toEqual([{ type: "text", content: "OK" }]);
    expect(fetchMock.mock.calls[0][0]).toBe("https://vibi.top/v1/chat/completions");
    vi.stubEnv("BRAVE_SEARCH_API_KEY", "");
    fetchMock.mockClear();
    await expect(collect(deepseekLLMStream([{ role: "user", content: "Synthetic probe" }])))
      .rejects.toMatchObject({ code: "DEEPSEEK_CONFIG_INVALID" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("streams through the verified fixed endpoint and model with unchanged limits", async () => {
    configure();
    const fetchMock = vi.fn().mockResolvedValue(completeText());
    vi.stubGlobal("fetch", fetchMock);

    await expect(collect(deepseekLLMStream([{ role: "user", content: "Synthetic probe" }])))
      .resolves.toEqual([{ type: "text", content: "OK" }]);
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe("https://vibi.top/v1/chat/completions");
    expect(request.redirect).toBe("error");
    expect(request.headers.Authorization).toBe(`Bearer ${trial.DEEPSEEK_API_KEY}`);
    expect(JSON.parse(request.body)).toMatchObject({
      model: "deepseek-v4.1-flash",
      stream: true,
      max_tokens: 2048,
      thinking: { type: "disabled" },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps KB JSON selection bounded at the same gateway", async () => {
    configure();
    const fetchMock = vi.fn().mockResolvedValue(completeText());
    vi.stubGlobal("fetch", fetchMock);
    await collect(deepseekLLMStream([{ role: "user", content: "Select JSON refs" }], [], {
      surface: "kb_selection",
      maxOutputTokens: 999,
      responseFormat: "json_object",
    }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      model: "deepseek-v4.1-flash",
      max_tokens: 256,
      response_format: { type: "json_object" },
    });
  });

  it.each([
    { APP_ENV: "production" },
    { APP_ENV: "development" },
    { AI_PROVIDER: "gemini" },
    { AI_STAGING_PROVIDER_TRIAL: "" },
    { AI_KB_RETRIEVAL_MODE: "vector" },
    { MONGO_URI: "mongodb+srv://cluster.example/htcoaching" },
    { CLIENT_URL: "https://untrusted.example" },
    { BACKGROUND_JOBS_ENABLED: "true" },
    { DEEPSEEK_MODEL: "deepseek-flash" },
    { DEEPSEEK_ENDPOINT_PROFILE: "official" },
    { DEEPSEEK_ENDPOINT_PROFILE: "__proto__" },
    { DEEPSEEK_ENDPOINT_PROFILE: "https://vibi.top.evil.example/v1" },
    { DEEPSEEK_ENDPOINT_PROFILE: "http://127.0.0.1/v1" },
    { DEEPSEEK_ENDPOINT_PROFILE: "https://vibi.top/v1?key=private" },
  ])("rejects invalid gateway configuration before credential egress: %j", async (overrides) => {
    configure(overrides);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(collect(deepseekLLMStream([{ role: "user", content: "Synthetic probe" }])))
      .rejects.toMatchObject({ code: "DEEPSEEK_CONFIG_INVALID" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
