import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { clearCollections, createTestApp, createTestUser, setupTestDB,
  teardownTestDB, withAuth } from "../../__tests__/setup.js";
import ChatConversation from "../../models/ChatConversation.js";

vi.mock("../../utils/safeLogger.js", () => ({ safeLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const prompt = "Theo khuyến nghị mới nhất của WHO, người trưởng thành nên vận động bao nhiêu phút mỗi tuần? " +
  "Hãy trả lời kèm nguồn công khai cập nhật.";
const quote = "Adults should do at least 150–300 minutes of moderate-intensity aerobic physical activity; " +
  "or at least 75–150 minutes of vigorous-intensity aerobic physical activity. " +
  "They should also do muscle-strengthening activities on 2 or more days a week.";
const answer = { segments: [{ text: "Người trưởng thành nên vận động 150–300 phút cường độ vừa " +
  "hoặc 75–150 phút cường độ mạnh mỗi tuần, và tập sức mạnh ít nhất 2 ngày mỗi tuần.",
supports: [{ sourceId: "source_1", quote }] }] };
const streamTool = (name, args) => new Response([
  `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, id: "call_brave",
    function: { name, arguments: JSON.stringify(args) } }] }, finish_reason: "tool_calls" }] })}\n\n`,
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
let app;
const parseFrames = (response) => response.text.split("\n\n")
  .filter((row) => row.startsWith("data: "))
  .map((row) => JSON.parse(row.slice(6)));
beforeAll(async () => {
  await setupTestDB();
  configure();
  const { default: routes } = await import("../../routes/ai.routes.js");
  app = createTestApp();
  app.use("/api/ai", routes);
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await clearCollections();
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await teardownTestDB();
});

describe("Vibi + Brave through owned chat SSE", () => {
  it("searches once, synthesizes through Vibi and persists the actual citations and trace", async () => {
    const fetchMock = vi.fn(async (url, options) => {
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
    });
    vi.stubGlobal("fetch", fetchMock);
    const { accessToken, user } = await createTestUser();
    const response = await withAuth(request(app).post("/api/ai/chat"), accessToken).send({ message: prompt });
    expect(response.status).toBe(200);
    const frames = response.text.split("\n\n").filter((row) => row.startsWith("data: "))
      .map((row) => JSON.parse(row.slice(6)));
    expect(frames.some((frame) => frame.type === "error")).toBe(false);
    expect(frames.find((frame) => frame.type === "done").meta).toMatchObject({
      provenance: "web_grounded",
      capabilities: { chatProvider: "vibi", externalWebSearch: true, canSearchWeb: true },
    });
    const text = frames.filter((frame) => frame.type === "text").map((frame) => frame.content).join("");
    expect(text).toContain("150–300");
    expect(text).toContain("who.int");
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "https://api.search.brave.com/res/v1/llm/context",
      "https://vibi.top/v1/chat/completions",
    ]);
    const saved = await ChatConversation.findOne({ userId: user._id }).lean();
    const message = saved.messages.find((item) => item.role === "assistant" && item.content.includes("150–300"));
    expect(message.answerTrace).toMatchObject({ model: "deepseek-v4.1-flash", evidenceMode: "web_required",
      webSearchUsed: true, webSearchOutcome: "grounded" });
    expect(saved.messages.some((item) => item.role === "tool" && item.uiCard?.cardType === "webSources"))
      .toBe(true);
    expect(frames.some((frame) => frame.type === "ui_card" && frame.cardType === "webSources"))
      .toBe(true);
  });

  it("reports unavailable provenance when a required lookup has no evidence", async () => {
    const fetchMock = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);
    const { accessToken } = await createTestUser();
    const response = await withAuth(request(app).post("/api/ai/chat"), accessToken)
      .send({ message: prompt });
    expect(response.status).toBe(200);
    const frames = parseFrames(response);
    expect(frames.find((frame) => frame.type === "done").meta.provenance)
      .toBe("capability_unavailable");
    expect(frames.some((frame) => frame.type === "ui_card" && frame.cardType === "webSources"))
      .toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    "Tính TDEE cho tôi",
    "Tôi đang đau ngực dữ dội và khó thở khi tập, tôi nên làm gì?",
  ])("includes deterministic provenance on the early response for %s", async (message) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { accessToken } = await createTestUser();
    const response = await withAuth(request(app).post("/api/ai/chat"), accessToken)
      .send({ message });
    expect(response.status).toBe(200);
    const frames = parseFrames(response);
    expect(frames.find((frame) => frame.type === "done").meta.provenance)
      .toBe("deterministic_server");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
