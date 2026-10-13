import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { clearCollections, createTestApp, createTestUser, setupTestDB,
  teardownTestDB, withAuth } from "../../__tests__/setup.js";
import AiUsageRecord from "../../models/AiUsageRecord.js";
import { estimateAiUsageCostUsd, resolveAiPrices } from "../../config/aiPricing.js";

vi.mock("../../utils/safeLogger.js", () => ({ safeLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const prompt = "Theo khuyến nghị mới nhất của WHO, người trưởng thành nên vận động bao nhiêu phút mỗi tuần? " +
  "Hãy trả lời kèm nguồn công khai cập nhật.";
const quote = "Adults should do at least 150–300 minutes of moderate-intensity aerobic physical activity.";
const answer = { segments: [{ text: "Người trưởng thành nên vận động 150–300 phút cường độ vừa mỗi tuần.",
  supports: [{ sourceId: "source_1", quote }] }] };
const usage = { prompt_tokens: 1000, prompt_cache_hit_tokens: 400, prompt_cache_miss_tokens: 600,
  completion_tokens: 200, total_tokens: 1200 };
const streamTool = (name, args) => new Response([
  `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, id: "call_1",
    function: { name, arguments: JSON.stringify(args) } }] }, finish_reason: "tool_calls" }] })}\n\n`,
  `data: ${JSON.stringify({ choices: [], usage })}\n\n`,
  "data: [DONE]\n\n",
].join(""), { headers: { "Content-Type": "text/event-stream" } });
const streamText = (content) => new Response([
  `data: ${JSON.stringify({ choices: [{ delta: { content }, finish_reason: "stop" }] })}\n\n`,
  `data: ${JSON.stringify({ choices: [], usage })}\n\n`,
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
const waitForRecords = async (expected) => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const records = await AiUsageRecord.find().lean();
    if (records.length >= expected) return records;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return AiUsageRecord.find().lean();
};

let app;
beforeAll(async () => {
  await setupTestDB();
  configure();
  const { default: aiRoutes } = await import("../../routes/ai.routes.js");
  const { default: policyRoutes } = await import("../../routes/serviceAccessPolicy.routes.js");
  app = createTestApp();
  app.use("/api/ai", aiRoutes);
  app.use("/api/admin/service-access-policies", policyRoutes);
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

describe("AI usage meter", () => {
  it("records provider usage and estimated cost of a smart-search turn without identity or content", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url, options) => {
      if (url === "https://api.search.brave.com/res/v1/llm/context") {
        return new Response(JSON.stringify({ grounding: { generic: [{
          url: "https://www.who.int/news-room/fact-sheets/detail/physical-activity",
          title: "Physical activity", snippets: [quote],
        }] } }));
      }
      if (url === "https://vibi.top/v1/chat/completions") {
        const body = JSON.parse(options.body);
        return body.tool_choice?.function?.name === "submit_grounded_answer"
          ? streamTool("submit_grounded_answer", answer) : streamTool("search_knowledge", { query: prompt });
      }
      throw new Error("Unexpected egress");
    }));
    const { accessToken } = await createTestUser();
    const response = await withAuth(request(app).post("/api/ai/chat"), accessToken)
      .send({ message: prompt, webSearch: true });
    expect(response.status).toBe(200);

    const [record] = await waitForRecords(1);
    expect(record).toMatchObject({
      serviceKey: "ai_chat",
      operation: "chat_smart_search",
      actorKind: "user",
      httpStatus: 200,
      brave: { contextCalls: 1 },
    });
    // Luồng web: Brave context rồi đúng một lần tổng hợp qua Vibi.
    expect(record.deepseek).toMatchObject({
      calls: 1, promptTokens: 1000, cacheHitTokens: 400, cacheMissTokens: 600, outputTokens: 200,
    });
    expect(record.estimatedCostUsd).toBeGreaterThan(0.005);
    const stored = JSON.stringify(record);
    expect(stored).not.toContain("WHO");
    expect(stored).not.toMatch(/userId|guestKey|message/);
  });

  it("records a plain chat turn without Brave calls", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url) => {
      if (url === "https://vibi.top/v1/chat/completions") return streamText("Chào bạn!");
      throw new Error("Unexpected egress");
    }));
    const { accessToken } = await createTestUser();
    await withAuth(request(app).post("/api/ai/chat"), accessToken)
      .send({ message: "Chào bạn", webSearch: false });
    const [record] = await waitForRecords(1);
    expect(record).toMatchObject({ operation: "chat", brave: { contextCalls: 0, imageCalls: 0 } });
  });

  it("summarizes recorded cost by operation for admins only", async () => {
    await AiUsageRecord.create([
      { serviceKey: "ai_chat", operation: "chat", tier: "user", actorKind: "user", estimatedCostUsd: 0.001 },
      { serviceKey: "ai_chat", operation: "chat", tier: "user", actorKind: "user", estimatedCostUsd: 0.003 },
      { serviceKey: "meal_scan", operation: "meal_scan", tier: "guest", actorKind: "guest", estimatedCostUsd: 0.002 },
    ]);
    const { accessToken: adminToken } = await createTestUser({ role: "admin" });
    const response = await withAuth(
      request(app).get("/api/admin/service-access-policies/ai-usage?days=7"), adminToken,
    );
    expect(response.status).toBe(200);
    const chat = response.body.data.byOperation.find((row) => row.operation === "chat");
    expect(chat).toMatchObject({ count: 2, totalCostUsd: 0.004, avgCostUsd: 0.002, maxCostUsd: 0.003 });
    expect(response.body.data.overall.count).toBe(3);

    const { accessToken: userToken } = await createTestUser();
    const forbidden = await withAuth(
      request(app).get("/api/admin/service-access-policies/ai-usage"), userToken,
    );
    expect(forbidden.status).toBe(403);
    const invalid = await withAuth(
      request(app).get("/api/admin/service-access-policies/ai-usage?days=0"), adminToken,
    );
    expect(invalid.status).toBe(400);
  });
});

describe("AI price estimate", () => {
  it("prices tokens per million, Brave per request and honours env overrides", () => {
    const prices = resolveAiPrices({ AI_PRICE_BRAVE_CONTEXT_PER_REQUEST: "0.01", AI_PRICE_DEEPSEEK_OUTPUT_PER_M: "bad" });
    expect(prices.braveContextPerRequest).toBe(0.01);
    expect(prices.deepseekOutputPerMillion).toBe(0.6);
    const cost = estimateAiUsageCostUsd({
      deepseek: { promptTokens: 1_000_000, cacheHitTokens: 0, cacheMissTokens: 0, outputTokens: 1_000_000 },
      brave: { contextCalls: 2, imageCalls: 0 },
    }, prices);
    // 1M input miss × $0.15 + 1M output × $0.60 + 2 Brave × $0.01
    expect(cost).toBe(0.77);
  });
});
