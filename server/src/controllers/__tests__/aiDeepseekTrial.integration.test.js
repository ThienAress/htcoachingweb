import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { clearCollections, createTestApp, createTestUser, setupTestDB, teardownTestDB, withAuth } from "../../__tests__/setup.js";
import ChatConversation from "../../models/ChatConversation.js";
import KnowledgeEntry from "../../models/KnowledgeEntry.js";
import { EMBEDDING_VERSION } from "../../services/ai/embeddingProfile.js";
import { toolRegistry } from "../../services/ai/tools/toolRegistry.js";

vi.mock("../../utils/safeLogger.js", () => ({ safeLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("../../services/ai/knowledgeSelectionPolicy.js", async (importOriginal) => ({
  ...(await importOriginal()),
  CHAT_KNOWLEDGE_SELECTION_TIMEOUT_MS: 400,
}));
const configureTrial = () => {
  const deepseekSecretName = ["DEEP", "SEEK", "_API_KEY"].join("");
  const profile = {
    APP_ENV: "staging", AI_PROVIDER: "deepseek", AI_STAGING_PROVIDER_TRIAL: "deepseek",
    AI_KB_RETRIEVAL_MODE: "llm_selection", DEEPSEEK_MODEL: "deepseek-flash",
    DEEPSEEK_ENDPOINT_PROFILE: "official",
    [deepseekSecretName]: "d".repeat(32), MONGO_URI: "mongodb://localhost/htcoaching_staging",
    CLIENT_URL: "https://staging--htcoachingweb.netlify.app", PUBLIC_API_ORIGIN: "https://htcoachingweb-staging.onrender.com",
    ALLOWED_ORIGINS: "https://staging--htcoachingweb.netlify.app", BACKGROUND_JOBS_ENABLED: "false",
    EMAIL_DELIVERY_MODE: "disabled", F1_RETENTION_ENFORCE: "false", AI_LOG_LEVEL: "error",
  };
  for (const [key, value] of Object.entries(profile)) vi.stubEnv(key, value);
};
const stream = (content, { tool, done = true } = {}) => {
  const delta = tool ? { tool_calls: [{ index: 0, id: "trial-call", type: "function", function: { name: tool, arguments: "{}" } }] } : { content };
  return new Response(`data: ${JSON.stringify({ choices: [{ index: 0, delta, finish_reason: null }] })}\n\ndata: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: tool ? "tool_calls" : "stop" }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } })}\n\n${done ? "data: [DONE]\n\n" : ""}`, { headers: { "content-type": "text/event-stream" } });
};
const frames = (res) => res.text.split("\n\n").filter(row => row.startsWith("data: ")).map(row => JSON.parse(row.slice(6)));
const text = (res) => frames(res).filter(row => row.type === "text").map(row => row.content).join("");
const fixture = (createdBy, index = 0) => ({
  question: `Protein là gì? Nhãn ${index}.`, answer: "Đạm hỗ trợ mô cơ.", category: "nutrition",
  status: "published", embeddingStatus: "ready", embeddingVersion: EMBEDDING_VERSION,
  evidenceLevel: "editor_reviewed", reviewStatus: "reviewed", freshnessClass: "stable",
  reviewedAt: new Date(), reviewDueAt: new Date("2099-01-01"), revision: 1, createdBy,
});
let app; let fetchMock;
const originalGym = toolRegistry.get_gym_info?.execute;
const submit = (accessToken, body) => withAuth(request(app).post("/api/ai/chat"), accessToken).send(body);
beforeAll(async () => {
  await setupTestDB(); configureTrial();
  const { default: routes } = await import("../../routes/ai.routes.js");
  app = createTestApp(); app.use("/api/ai", routes);
});
beforeEach(() => {
  configureTrial(); fetchMock = vi.fn(async (url) => {
    if (url !== "https://api.deepseek.com/chat/completions") throw new Error("Unexpected outbound request");
    return stream("Mình hiểu ý bạn, chúng ta có thể trao đổi từng bước nhé.");
  }); vi.stubGlobal("fetch", fetchMock);
});
afterEach(async () => { if (originalGym) toolRegistry.get_gym_info.execute = originalGym; vi.unstubAllGlobals(); await clearCollections(); });
afterAll(async () => { vi.unstubAllEnvs(); await teardownTestDB(); });

describe("real DeepSeek factory/provider at the owned chat SSE seam", () => {
  it.each([
    ["official", "deepseek-flash", "https://api.deepseek.com/chat/completions"],
    ["vibi", "deepseek-v4.1-flash", "https://vibi.top/v1/chat/completions"],
  ])("persists conversational replies and sends prior turns on follow-up via %s", async (profile, model, endpoint) => {
    vi.stubEnv("DEEPSEEK_ENDPOINT_PROFILE", profile);
    vi.stubEnv("DEEPSEEK_MODEL", model);
    fetchMock.mockImplementation(async (url) => {
      if (url !== endpoint) throw new Error("Unexpected outbound request");
      return stream("Mình hiểu ý bạn, chúng ta có thể trao đổi từng bước nhé.");
    });
    const { user, accessToken } = await createTestUser();
    const first = await submit(accessToken, { message: "Chào bạn, hôm nay mình muốn trò chuyện một chút." });
    const id = frames(first).find(row => row.type === "done")?.conversationId;
    const second = await submit(accessToken, { message: "Bạn nhắc lại điều mình vừa muốn được không?", conversationId: id });
    const stored = await ChatConversation.findOne({ _id: id, userId: user._id }).lean();
    const sent = JSON.parse(fetchMock.mock.calls.at(-1)[1].body);
    expect({ done: frames(second).at(-1).type, model: stored.messages.at(-1).answerTrace.model,
      sentModel: sent.model,
      prior: sent.messages.some(row => row.role === "assistant" && row.content === text(first)),
      noGemini: fetchMock.mock.calls.every(([url]) => url === endpoint) })
      .toEqual({ done: "done", model, sentModel: model, prior: true, noGemini: true });
  });
  it("uses selection and generation without embeddings for a KB paraphrase", async () => {
    const { user, accessToken } = await createTestUser();
    const { insertedId } = await KnowledgeEntry.collection.insertOne(fixture(user._id));
    fetchMock.mockImplementation(async (_url, options) => {
      const body = JSON.parse(options.body);
      return body.response_format ? stream('{"refs":["kb_1"]}') : stream("Đạm hỗ trợ mô cơ.");
    });
    const res = await submit(accessToken, { message: "Protein có vai trò gì trong cơ thể?" });
    const stored = await ChatConversation.findOne({ userId: user._id }).lean();
    expect({ calls: fetchMock.mock.calls.length, end: frames(res).at(-1).type,
      ids: stored.messages.at(-1).answerTrace.kbEntryIds.length,
      retrieval: stored.messages.at(-1).answerTrace.kbRetrieval,
      prompt: JSON.parse(fetchMock.mock.calls.at(-1)[1].body).messages[0].content })
      .toMatchObject({ calls: 2, end: "done", ids: 1,
        retrieval: { method: "llm_selection", coverage: "full", eligibleCount: 1,
          safeCount: 1, excludedCount: 0, refs: [{ rank: 1, revision: 1 }] },
        prompt: expect.stringContaining("llm_selection; hạng 1") });
    expect(fetchMock.mock.calls.every(([url]) => url === "https://api.deepseek.com/chat/completions")).toBe(true);
    expect(JSON.parse(JSON.stringify(stored.messages.at(-1).answerTrace.kbRetrieval)))
      .toEqual({ method: "llm_selection", coverage: "full", eligibleCount: 1,
        safeCount: 1, excludedCount: 0,
        refs: [{ entryId: insertedId.toString(), rank: 1, revision: 1 }] });
  });
  it("persists bounded no-hit metadata without candidate content", async () => {
    const { user, accessToken } = await createTestUser();
    await KnowledgeEntry.collection.insertOne({ ...fixture(user._id),
      answer: "KB_PUBLIC_ANSWER_SENTINEL", tags: ["KB_PUBLIC_TAG_SENTINEL"] });
    fetchMock.mockImplementation(async (_url, options) => JSON.parse(options.body).response_format
      ? stream('{"refs":[]}') : stream("Mình có thể trao đổi nguyên tắc chung."));
    const res = await submit(accessToken, { message: "Protein có vai trò gì trong cơ thể?" });
    const stored = await ChatConversation.findOne({ userId: user._id }).lean();
    expect({ end: frames(res).at(-1).type, calls: fetchMock.mock.calls.length,
      retrieval: JSON.parse(JSON.stringify(stored.messages.at(-1).answerTrace.kbRetrieval)) })
      .toEqual({ end: "done", calls: 2, retrieval: { method: "llm_selection",
        coverage: "full", eligibleCount: 1, safeCount: 1, excludedCount: 0, refs: [] } });
  });
  it("degrades a slow KB selector to a KB miss instead of failing the chat turn", async () => {
    const { user, accessToken } = await createTestUser();
    await KnowledgeEntry.collection.insertOne(fixture(user._id));
    fetchMock.mockImplementation((_url, options) => {
      if (!JSON.parse(options.body).response_format) return Promise.resolve(stream("Mình có thể trao đổi nguyên tắc chung."));
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
      });
    });
    const res = await submit(accessToken, { message: "Protein có vai trò gì trong cơ thể?" });
    const stored = await ChatConversation.findOne({ userId: user._id }).lean();
    expect({ end: frames(res).at(-1).type,
      ids: stored.messages.at(-1).answerTrace.kbEntryIds.length,
      retrieval: JSON.parse(JSON.stringify(stored.messages.at(-1).answerTrace.kbRetrieval)) })
      .toEqual({ end: "done", ids: 0, retrieval: { method: "llm_selection",
        coverage: "unknown", eligibleCount: null, safeCount: null, excludedCount: null, refs: [] } });
  });
  it("keeps non-timeout selector failures fail-closed", async () => {
    const { user, accessToken } = await createTestUser();
    await KnowledgeEntry.collection.insertOne(fixture(user._id));
    fetchMock.mockImplementation(async (_url, options) => JSON.parse(options.body).response_format
      ? stream("not json") : stream("Mình có thể trao đổi nguyên tắc chung."));
    const res = await submit(accessToken, { message: "Protein có vai trò gì trong cơ thể?" });
    expect(frames(res).at(-1).type).toBe("error");
  });
  it("hydrates legacy traces without a migration or required retrieval metadata", async () => {
    const { user } = await createTestUser();
    const { insertedId } = await ChatConversation.collection.insertOne({ userId: user._id,
      messages: [{ role: "assistant", content: "Legacy synthetic answer", answerTrace: {
        routeDomain: "fitness", evidenceMode: "model_prior", model: "legacy-provider",
        promptVersion: "legacy-version" } }] });
    const stored = await ChatConversation.findById(insertedId);
    let validation;
    try { await stored.validate(); } catch (error) { validation = error; }
    expect({ retrieval: stored.messages[0].answerTrace.kbRetrieval,
      validation }).toEqual({ retrieval: null, validation: undefined });
  });
  it("surfaces corpus overflow before any paid generation", async () => {
    const { user, accessToken } = await createTestUser();
    await KnowledgeEntry.collection.insertMany(Array.from({ length: 65 }, (_, i) => fixture(user._id, i)));
    const res = await submit(accessToken, { message: "Protein có vai trò gì trong cơ thể?" });
    expect({ last: frames(res).at(-1).type, calls: fetchMock.mock.calls.length }).toEqual({ last: "error", calls: 0 });
  });
  it("never commits a partial response and permits Retry after provider failure", async () => {
    const { user, accessToken } = await createTestUser();
    fetchMock.mockResolvedValueOnce(stream("Bản nháp chưa hoàn tất", { done: false }));
    const body = { message: "Chào bạn, mình muốn trò chuyện.", requestId: "0c7f7c4e-5d46-4db6-9a61-0f0d3c9b9e01" };
    const failed = await submit(accessToken, body);
    const retried = await submit(accessToken, body);
    const stored = await ChatConversation.findOne({ userId: user._id }).sort({ updatedAt: -1 }).lean();
    expect({ failed: frames(failed).at(-1).type, retryable: frames(failed).at(-1).retryable,
      retry: frames(retried).at(-1).type, partialSaved: stored.messages.some(row => row.content.includes("Bản nháp")) })
      .toEqual({ failed: "error", retryable: true, retry: "done", partialSaved: false });
  });
  it("attributes a deterministic semantic fallback instead of DeepSeek", async () => {
    const { user, accessToken } = await createTestUser();
    fetchMock.mockImplementation(async () => stream(
      "Tập bốn buổi mỗi tuần nhưng chưa có đủ cấu trúc RPE, deload và tiến triển.",
    ));
    const res = await submit(accessToken, {
      message: "Tạo lịch tăng cơ 4 ngày/tuần, mỗi buổi tối đa 60 phút, chỉ có đôi tạ đơn điều chỉnh và dây kháng lực. Ghi bài, hiệp, lần, RPE, thời gian nghỉ, cách tăng tiến trong 6 tuần và tuần deload.",
    });
    const stored = await ChatConversation.findOne({ userId: user._id }).lean();
    expect({ done: frames(res).at(-1).type, calls: fetchMock.mock.calls.length,
      model: stored.messages.at(-1).answerTrace.model })
      .toEqual({ done: "done", calls: 2, model: "static_workout_v1" });
  });
  it("attributes a scope-preserving fallback after repeated invalid DeepSeek drafts", async () => {
    const { user, accessToken } = await createTestUser();
    const conversation = await ChatConversation.create({ userId: user._id, messages: [
      { role: "user", content: "Lập kế hoạch với thâm hụt 300 kcal." },
      { role: "assistant", content: "Lịch tập 4 buổi, thâm hụt 300 kcal." },
    ], messageCount: 2 });
    fetchMock.mockImplementation(async () => stream(
      "Đã đổi thành 700 kcal và giảm lịch tập từ 4 buổi xuống 3 buổi.",
    ));
    const res = await submit(accessToken, { conversationId: conversation._id,
      message: "Giữ nguyên toàn bộ kế hoạch vừa rồi nhưng đổi mức thâm hụt từ 300 kcal thành 700 kcal. Giải thích phần nào đã thay đổi." });
    const stored = await ChatConversation.findById(conversation._id).lean();
    expect({ done: frames(res).at(-1).type, calls: fetchMock.mock.calls.length,
      model: stored.messages.at(-1).answerTrace.model })
      .toEqual({ done: "done", calls: 2, model: "static_scope_preservation_v1" });
  });
  it("attributes an equipment-safe fallback after repeated invalid DeepSeek drafts", async () => {
    const { user, accessToken } = await createTestUser();
    fetchMock.mockImplementation(async () => stream("Hãy tập Barbell Bench Press."));
    const res = await submit(accessToken, {
      message: "Tôi chỉ dùng dây kháng lực. Tôi có nên dùng barbell bench press không?",
    });
    const stored = await ChatConversation.findOne({ userId: user._id }).lean();
    expect({ done: frames(res).at(-1).type, calls: fetchMock.mock.calls.length,
      model: stored.messages.at(-1).answerTrace.model })
      .toEqual({ done: "done", calls: 2, model: "static_equipment_limit_v1" });
  });
  it("attributes a required-tool missing response instead of the unused DeepSeek draft", async () => {
    const { user, accessToken } = await createTestUser();
    await KnowledgeEntry.collection.insertOne({ ...fixture(user._id), category: "training",
      question: "Kỹ thuật bài tập tổng quát", answer: "Dùng thư viện bài tập nội bộ để tra cứu động tác." });
    fetchMock.mockImplementation(async (_url, options) => JSON.parse(options.body).response_format
      ? stream('{"refs":["kb_1"]}') : stream("Mình hiểu ý bạn, chúng ta có thể trao đổi từng bước nhé."));
    const res = await submit(accessToken, {
      message: "Cách tập đúng kỹ thuật với bài chưa có trong thư viện?",
    });
    const stored = await ChatConversation.findOne({ userId: user._id }).lean();
    expect({ done: frames(res).at(-1).type, calls: fetchMock.mock.calls.length,
      model: stored.messages.at(-1).answerTrace.model, answer: text(res),
      requiredTool: JSON.parse(fetchMock.mock.calls.at(-1)[1].body).tool_choice?.function?.name })
      .toEqual({ done: "done", calls: 2, model: "server_tool_missing_v1", requiredTool: "search_exercises",
        answer: "Mình chưa thể đối chiếu thư viện bài tập cho yêu cầu này. Bạn thử nêu nhóm cơ và thiết bị hiện có nhé." });
  });
  it("returns unsupported web evidence without Gemini or DeepSeek calls", async () => {
    const { user, accessToken } = await createTestUser();
    const res = await submit(accessToken, { message: "Cristiano Ronaldo là ai? Dựa trên nguồn công khai cập nhật, hãy trả lời có nguồn." });
    const stored = await ChatConversation.findOne({ userId: user._id }).lean();
    expect({ calls: fetchMock.mock.calls.length, trace: stored.messages.at(-1).answerTrace, done: frames(res).at(-1).type })
      .toMatchObject({ calls: 0, done: "done", trace: { model: "server:capability_unavailable", webSearchOutcome: "not_called", webSearchUsed: false } });
  });
  it("does not allow another user to read trial history", async () => {
    const { accessToken } = await createTestUser();
    const res = await submit(accessToken, { message: "Chào bạn, mình muốn trò chuyện." });
    const id = frames(res).at(-1).conversationId;
    const other = await createTestUser();
    const history = await withAuth(request(app).get(`/api/ai/conversations/${id}`), other.accessToken);
    expect(history.status).toBe(404);
  });
});
