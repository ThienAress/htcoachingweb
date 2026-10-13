import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { clearCollections, createTestApp, createTestUser, setupTestDB,
  teardownTestDB, withAuth } from "../../__tests__/setup.js";

vi.mock("../../utils/safeLogger.js", () => ({ safeLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const webPrompt = "Theo khuyến nghị mới nhất của WHO, người trưởng thành nên vận động bao nhiêu phút mỗi tuần? " +
  "Hãy trả lời kèm nguồn công khai cập nhật.";
const quote = "Adults should do at least 150–300 minutes of moderate-intensity aerobic physical activity.";
const answer = { segments: [{ text: "Người trưởng thành nên vận động 150–300 phút cường độ vừa mỗi tuần.",
  supports: [{ sourceId: "source_1", quote }] }] };
const streamTool = (name, args) => new Response([
  `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, id: "call_1",
    function: { name, arguments: JSON.stringify(args) } }] }, finish_reason: "tool_calls" }] })}\n\n`,
  "data: [DONE]\n\n",
].join(""), { headers: { "Content-Type": "text/event-stream" } });
const streamText = (content) => new Response([
  `data: ${JSON.stringify({ choices: [{ delta: { content }, finish_reason: "stop" }] })}\n\n`,
  "data: [DONE]\n\n",
].join(""), { headers: { "Content-Type": "text/event-stream" } });
const configure = () => {
  const env = {
    APP_ENV: "staging", AI_PROVIDER: "deepseek", AI_STAGING_PROVIDER_TRIAL: "deepseek",
    AI_KB_RETRIEVAL_MODE: "llm_selection", DEEPSEEK_MODEL: "deepseek-v4.1-flash",
    DEEPSEEK_ENDPOINT_PROFILE: "vibi", DEEPSEEK_API_KEY: "d".repeat(32),
    AI_WEB_SEARCH_PROVIDER: "brave", BRAVE_SEARCH_API_KEY: "synthetic-key",
    MONGO_URI: "mongodb://localhost/htcoaching_staging", CLIENT_URL: "https://staging--htcoachingweb.netlify.app",
    PUBLIC_API_ORIGIN: "https://htcoachingweb-staging.onrender.com",
    ALLOWED_ORIGINS: "https://staging--htcoachingweb.netlify.app", BACKGROUND_JOBS_ENABLED: "false",
    EMAIL_DELIVERY_MODE: "disabled", F1_RETENTION_ENFORCE: "false",
  };
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
};
const stubProviders = () => vi.stubGlobal("fetch", vi.fn(async (url, options) => {
  if (url === "https://api.search.brave.com/res/v1/llm/context") {
    return new Response(JSON.stringify({ grounding: { generic: [{
      url: "https://www.who.int/news-room/fact-sheets/detail/physical-activity",
      title: "Physical activity", snippets: [quote],
    }] } }));
  }
  if (url === "https://vibi.top/v1/chat/completions") {
    const body = JSON.parse(options.body);
    if (body.tool_choice?.function?.name === "submit_grounded_answer") {
      return streamTool("submit_grounded_answer", answer);
    }
    return body.tools?.some((tool) => tool.function?.name === "search_knowledge")
      ? streamTool("search_knowledge", { query: webPrompt })
      : streamText("Chào bạn, mình là HT Assistant.");
  }
  throw new Error("Unexpected egress");
}));
const frames = (response) => response.text.split("\n\n")
  .filter((row) => row.startsWith("data: "))
  .map((row) => JSON.parse(row.slice(6)));
const lastQuota = (response) => frames(response).filter((frame) => frame.type === "quota").at(-1)?.quota;
const spendable = (quota) => Math.min(...quota.windows.map((window) => window.remaining));

let app;
beforeAll(async () => {
  await setupTestDB();
  configure();
  const { default: aiRoutes } = await import("../../routes/ai.routes.js");
  app = createTestApp();
  app.use("/api/ai", aiRoutes);
});
afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  configure();
  await clearCollections();
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await teardownTestDB();
});

describe("AI credits", () => {
  it("reports the full credit budget and per-operation costs before any chat", async () => {
    const { accessToken } = await createTestUser();
    const response = await withAuth(request(app).get("/api/ai/credits"), accessToken);
    expect(response.status).toBe(200);
    expect(response.body.data.quota).toMatchObject({ serviceKey: "ai_credits", tier: "user" });
    // Policy user: 20 credit/24h + 80 credit/30 ngày.
    expect(response.body.data.quota.windows.map(({ limit, remaining }) => [limit, remaining]))
      .toEqual([[20, 20], [80, 80]]);
    expect(response.body.data.costs).toMatchObject({ chat: 1, smart_search_surcharge: 4, meal_scan: 2 });
  });

  it("charges one credit for a plain question", async () => {
    stubProviders();
    const { accessToken } = await createTestUser();
    const response = await withAuth(request(app).post("/api/ai/chat"), accessToken)
      .send({ message: "Chào bạn", webSearch: false });
    expect(response.status).toBe(200);
    expect(spendable(lastQuota(response))).toBe(19);
  });

  it("charges five credits when smart search actually searches the web", async () => {
    stubProviders();
    const { accessToken } = await createTestUser();
    const response = await withAuth(request(app).post("/api/ai/chat"), accessToken)
      .send({ message: webPrompt, webSearch: true });
    expect(response.status).toBe(200);
    expect(spendable(lastQuota(response))).toBe(15);
  });

  it("refunds the smart search surcharge when the question needs no web lookup", async () => {
    stubProviders();
    const { accessToken } = await createTestUser();
    const response = await withAuth(request(app).post("/api/ai/chat"), accessToken)
      .send({ message: "Chào bạn", webSearch: true });
    expect(response.status).toBe(200);
    expect(spendable(lastQuota(response))).toBe(19);
    const credits = await withAuth(request(app).get("/api/ai/credits"), accessToken);
    expect(spendable(credits.body.data.quota)).toBe(19);
  });

  it("rejects smart search when credits cannot cover the surcharge and keeps the base credit", async () => {
    stubProviders();
    const { accessToken } = await createTestUser();
    for (let index = 0; index < 4; index += 1) {
      const spent = await withAuth(request(app).post("/api/ai/chat"), accessToken)
        .send({ message: webPrompt, webSearch: true });
      expect(spent.status).toBe(200);
    }
    // 20 - 4 × 5 = 0 credit trong cửa sổ 24 giờ.
    const plain = await withAuth(request(app).post("/api/ai/chat"), accessToken)
      .send({ message: "Chào bạn", webSearch: false });
    expect(plain.status).toBe(429);
    expect(plain.body.code).toBe("AI_RATE_LIMITED");
    expect(spendable(plain.body.meta.quota)).toBe(0);
  });

  it("returns a dedicated code when only the smart search surcharge is unaffordable", async () => {
    stubProviders();
    const { accessToken } = await createTestUser();
    for (let index = 0; index < 3; index += 1) {
      await withAuth(request(app).post("/api/ai/chat"), accessToken)
        .send({ message: webPrompt, webSearch: true });
    }
    // Còn 5 credit: dùng 2 câu thường còn 3, không đủ 5 cho Tìm kiếm thông minh.
    for (let index = 0; index < 2; index += 1) {
      await withAuth(request(app).post("/api/ai/chat"), accessToken)
        .send({ message: "Chào bạn", webSearch: false });
    }
    const rejected = await withAuth(request(app).post("/api/ai/chat"), accessToken)
      .send({ message: webPrompt, webSearch: true });
    expect(rejected.status).toBe(429);
    expect(rejected.body.code).toBe("AI_CREDITS_INSUFFICIENT_SMART_SEARCH");
    expect(spendable(rejected.body.meta.quota)).toBe(3);
  });

  it("gives guests their small IP-scoped credit budget without smart search surcharge", async () => {
    stubProviders();
    const response = await request(app).post("/api/ai/chat")
      .set("Cookie", ["csrfToken=test-csrf-token"])
      .set("X-CSRF-Token", "test-csrf-token")
      .send({ message: "Chào bạn", webSearch: true });
    expect(response.status).toBe(200);
    const quota = lastQuota(response);
    expect(quota).toMatchObject({ serviceKey: "ai_credits", tier: "guest", limit: 5 });
    expect(spendable(quota)).toBe(4);
  });
});
