import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const { llmMock, kbMock } = vi.hoisted(() => ({ llmMock: vi.fn(), kbMock: vi.fn() }));
vi.mock("../../services/ai/providers/index.js", () => ({ llmStream: llmMock }));
vi.mock("../../services/ai/embedding.service.js", () => ({ searchKnowledgeBase: kbMock }));
vi.mock("../../utils/safeLogger.js", () => ({ safeLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { clearCollections, createTestApp, createTestUser, setupTestDB, teardownTestDB, withAuth } from "../../__tests__/setup.js";
import ChatConversation from "../../models/ChatConversation.js";
import { toolRegistry } from "../../services/ai/tools/toolRegistry.js";

let app;
const originalSearch = toolRegistry.search_knowledge.execute;
const irrelevantSource = "https://example.org/research/weight-loss";
const publishedKb = {
  _id: "507f191e810c19729de860ed", question: "Giảm cân với nhịn ăn gián đoạn?",
  answer: "Khung dinh dưỡng tham khảo.", category: "nutrition", similarity: 0.91,
  status: "published", evidenceLevel: "source_backed", reviewStatus: "reviewed",
  freshnessClass: "stable", reviewDueAt: "2099-01-01T00:00:00.000Z",
  sources: [{ type: "research", title: "Weight loss trial", publisher: "Synthetic journal", url: irrelevantSource, evidenceTier: "primary" }],
};
const frames = (response) => response.text.split("\n\n").filter((event) => event.startsWith("data: ")).map((event) => JSON.parse(event.slice(6)));
const text = (response) => frames(response).filter((frame) => frame.type === "text").map((frame) => frame.content).join("");
const submit = async (message) => {
  const { user, accessToken } = await createTestUser();
  const response = await withAuth(request(app).post("/api/ai/chat"), accessToken).send({ message });
  const conversation = await ChatConversation.findOne({ userId: user._id }).lean();
  const answer = [...conversation.messages].reverse().find((item) => item.role === "assistant" && item.content);
  return { response, answer, accessToken, conversationId: String(conversation._id), conversation };
};

beforeAll(async () => {
  await setupTestDB();
  const { default: routes } = await import("../../routes/ai.routes.js");
  app = createTestApp(); app.use("/api/ai", routes);
});
beforeEach(() => {
  llmMock.mockReset(); kbMock.mockReset(); kbMock.mockResolvedValue([publishedKb]);
  llmMock.mockImplementation(async function* () { yield { type: "text", content: "Mình cần biết mục tiêu, số đo và mức vận động trước khi đưa ra gợi ý." }; });
});
afterEach(async () => { toolRegistry.search_knowledge.execute = originalSearch; vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); await clearCollections(); });
afterAll(async () => { await teardownTestDB(); });

describe("selective source policy at the chat route", () => {
  it("preserves server-observed publisher provenance from the tool through SSE and owned history", async () => {
    const uri = "https://vertexaisearch.cloud.google.com/grounding-api-redirect/public-token";
    const fetchMock = vi.fn(async () => new Response(null, {
      status: 302,
      headers: { Location: "https://pmc.ncbi.nlm.nih.gov/articles/PMC1/" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const source = { title: "Public profile", uri,
      provenance: { kind: "google_grounding_redirect", publisherHost: "forged.example" } };
    toolRegistry.search_knowledge.execute = vi.fn(async () => ({
      text: `Cristiano Ronaldo là cầu thủ bóng đá. [Nguồn](<${uri}>)`,
      uiCard: { cardType: "webSources", data: { sources: [source] } },
      meta: { evidenceAvailable: true, sources: [source], searchOutcome: "grounded" },
    }));

    const { response, answer, accessToken, conversationId, conversation } = await submit("Cristiano Ronaldo là ai? Dựa trên nguồn công khai cập nhật, hãy trả lời có nguồn.");
    const history = await withAuth(request(app).get(`/api/ai/conversations/${conversationId}`), accessToken);
    const streamedSources = frames(response).find(frame => frame.cardType === "webSources")?.data.sources;
    const storedCardRow = conversation.messages.find(row => row.uiCard?.cardType === "webSources");
    const storedSources = storedCardRow?.uiCard.data.sources;
    const historySources = history.body.data?.messages.find(row => row._id === String(storedCardRow?._id))?.uiCard?.data.sources;
    const expected = [{ title: "Public profile", uri,
      provenance: { kind: "google_grounding_redirect", publisherHost: "pmc.ncbi.nlm.nih.gov" } }];

    expect({ streamedSources, storedSources, historySources, historyStatus: history.status, requests: fetchMock.mock.calls.length,
      persistedAnswerMatches: answer.content === text(response) && answer.content.includes(uri) })
      .toEqual({ streamedSources: expected, storedSources: expected, historySources: expected, historyStatus: 200, requests: 1, persistedAnswerMatches: true });
  });

  it("keeps public-source verification despite an irrelevant reviewed KB hit", async () => {
    const uri = "https://example.org/public/ronaldo";
    const search = vi.fn(async () => ({
      text: "Cristiano Ronaldo là cầu thủ bóng đá.",
      uiCard: { cardType: "webSources", data: { sources: [{ title: "Public player profile", uri }] } },
      meta: { evidenceAvailable: true, sources: [{ title: "Public player profile", uri }], searchOutcome: "grounded" },
    }));
    toolRegistry.search_knowledge.execute = search;
    const { response, answer } = await submit("Cristiano Ronaldo là ai? Dựa trên nguồn công khai cập nhật, hãy trả lời có nguồn.");
    expect({ status: response.status, attempts: search.mock.calls.length, content: text(response), trace: answer.answerTrace })
      .toMatchObject({ status: 200, attempts: 1, content: expect.not.stringContaining(irrelevantSource), trace: { evidenceMode: "web_required", webSearchUsed: true } });
  });

  it("does not attach unrelated KB citations to a missing-data intake answer", async () => {
    const { response, answer } = await submit("Tôi muốn biết mức calo và lịch tập phù hợp với mình. Nếu dữ liệu chưa đủ thì hãy hỏi tối đa 5 câu quan trọng nhất trước, không đoán.");
    expect({ status: response.status, streamed: text(response), persisted: answer.content, cards: frames(response).filter((frame) => frame.cardType === "webSources") })
      .toMatchObject({ status: 200, streamed: expect.not.stringContaining(irrelevantSource), persisted: expect.not.stringContaining(irrelevantSource), cards: [] });
  });

  it("rejects a copied unrelated research link without removing ordinary site navigation", async () => {
    llmMock.mockImplementation(async function* () {
      yield { type: "text", content: `Protein có nhiều vai trò. [Thực đơn](/mealplan)\n\nNguồn: [Thử nghiệm giảm cân](${irrelevantSource})` };
    });
    const { response, answer } = await submit("Protein có vai trò gì trong cơ thể?");
    expect(kbMock).toHaveBeenCalled();
    expect(llmMock.mock.calls[0][0][0].content).not.toContain(irrelevantSource);
    expect(text(response)).not.toContain(irrelevantSource);
    expect(answer.content).not.toContain(irrelevantSource);
    expect(answer.content).toContain("[Thực đơn](/mealplan)");
    expect(answer.uiCard).toBeNull();
  });

  it("binds a directly supported scientific citation to the final persisted assistant turn", async () => {
    const question = "Protein có vai trò gì trong cơ thể?";
    const uri = "https://example.org/research/protein";
    kbMock.mockResolvedValue([{ ...publishedKb, question, answer: "Protein hỗ trợ mô cơ.",
      sources: [{ ...publishedKb.sources[0], url: uri, title: "Synthetic protein reference" }] }]);
    llmMock.mockImplementation(async function* () {
      yield { type: "text", content: "Theo nghiên cứu, bổ sung protein hỗ trợ mô cơ. Mức đáp ứng còn tùy khẩu phần và vận động." };
    });
    const { response, answer } = await submit(question);
    expect(text(response)).toContain(uri);
    expect(answer.content).toBe(text(response));
    expect(answer.uiCard).toMatchObject({ cardType: "webSources", data: { sources: [{ uri }] } });
    expect(frames(response).filter((frame) => frame.cardType === "webSources")).toHaveLength(1);
  });
  it.each([
    "Theo khuyến nghị của Tổ chức Y tế Thế giới (WHO), người trưởng thành nên đạt ít nhất 150 phút hoạt động vừa mỗi tuần.",
    "**WHO** khuyến nghị người trưởng thành đạt ít nhất 150 phút hoạt động vừa mỗi tuần.",
    "Theo WHO, người trưởng thành nên vận động đều đặn.\nBạn muốn bắt đầu bằng đi bộ không?",
    "Theo **nguồn chính thức**, người trưởng thành nên đạt ít nhất 150 phút hoạt động vừa mỗi tuần.",
    "Theo khuyến nghị của\n**WHO**, người trưởng thành nên vận động đều đặn.",
    "Theo các khuyến nghị hiện hành của Tổ chức Y tế Thế giới (WHO), người trưởng thành nên đạt ít nhất 150 phút hoạt động vừa mỗi tuần.",
    "Theo các khuyến nghị của\nWHO, người trưởng thành nên vận động đều đặn.",
    "Mức vận động tham khảo:\nTheo nguồn chính thức, người trưởng thành nên đạt ít nhất 150 phút hoạt động vừa mỗi tuần.",
    "## Mức vận động\nTheo nguồn chính thức, người trưởng thành nên vận động đều đặn.",
  ])("keeps an attributed guideline source in SSE and owned history: %s", async (content) => {
    const question = "Tập luyện thể lực mỗi tuần bao nhiêu phút để khỏe mạnh?";
    const uri = "https://www.who.int/news-room/fact-sheets/detail/physical-activity";
    kbMock.mockResolvedValue([{ ...publishedKb, question, category: "general", answer: "Theo nguồn chính thức, người trưởng thành nên đạt ít nhất 150 phút hoạt động thể lực vừa mỗi tuần.",
      sources: [{ type: "official", title: "Physical activity", publisher: "World Health Organization", url: uri, evidenceTier: "primary" }] }]);
    llmMock.mockImplementation(async function* () { yield { type: "text", content }; });
    const { response, answer, accessToken, conversationId } = await submit(question);
    const history = await withAuth(request(app).get(`/api/ai/conversations/${conversationId}`), accessToken);
    const storedAnswer = history.body.data?.messages.find(row => row._id === String(answer._id));
    expect({ status: response.status, sourceInSse: text(response).includes(uri),
      sourceInStoredAnswer: answer.content.includes(uri), sourceInHistory: storedAnswer?.content.includes(uri),
      streamedCards: frames(response).filter(frame => frame.cardType === "webSources").length,
      historyCard: storedAnswer?.uiCard?.data.sources[0]?.uri, evidenceMode: answer.answerTrace.evidenceMode })
      .toEqual({ status: 200, sourceInSse: true, sourceInStoredAnswer: true, sourceInHistory: true,
        streamedCards: 1, historyCard: uri, evidenceMode: "internal_kb" });
  });
  it.each([
    "Bạn muốn biết khuyến nghị của WHO về chủ đề nào?",
    "Mình chưa **tìm** được khuyến nghị của WHO.",
    "Theo WHO, bạn muốn tìm khuyến nghị cho nhóm tuổi nào?",
    "**WHO** khuyến nghị gì cho nhóm tuổi của bạn?",
    "Theo nguồn chính thức, bạn muốn biết khuyến nghị cho nhóm tuổi nào?",
    "Mình chưa **tìm** được khuyến nghị theo nguồn chính thức.",
    "Mình chưa xác minh được theo nguồn chính thức.",
    "Bạn có thể tìm thêm theo nguồn chính thức.",
    "Theo các khuyến nghị của WHO, bạn muốn tìm thông tin cho nhóm tuổi nào?",
    "Bạn có thể tìm thêm khuyến nghị của WHO.",
    "Bạn hãy tìm theo các khuyến nghị của WHO.",
    "Theo các khuyến nghị của WHO,\nbạn muốn tìm thông tin cho nhóm tuổi nào?",
    "Để đối chiếu theo các khuyến nghị của WHO, bạn cho biết nhóm tuổi của mình nhé.",
    "Khuyến nghị của WHO là nội dung mình cần xác minh thêm.",
    "Theo các khuyến nghị của WHO, mình chưa xác minh được con số này.",
    "Theo các khuyến nghị của WHO, bạn hãy cho biết nhóm tuổi của mình nhé.",
  ])("keeps clarifications and formatted fallbacks uncited despite an eligible exact KB: %s", async (content) => {
    const question = "Tập luyện thể lực mỗi tuần bao nhiêu phút để khỏe mạnh?";
    const uri = "https://www.who.int/news-room/fact-sheets/detail/physical-activity";
    kbMock.mockResolvedValue([{ ...publishedKb, question, category: "general", answer: "Theo nguồn chính thức, người trưởng thành nên đạt ít nhất 150 phút hoạt động thể lực vừa mỗi tuần.",
      sources: [{ type: "official", title: "Physical activity", publisher: "World Health Organization", url: uri, evidenceTier: "primary" }] }]);
    llmMock.mockImplementation(async function* () { yield { type: "text", content }; });
    const { response, answer } = await submit(question);
    expect({ sourceInSse: text(response).includes(uri), sourceInStoredAnswer: answer.content.includes(uri),
      sourceCard: answer.uiCard, streamedCards: frames(response).filter(frame => frame.cardType === "webSources").length })
      .toEqual({ sourceInSse: false, sourceInStoredAnswer: false, sourceCard: null, streamedCards: 0 });
  });

  it("keeps joint discomfort private and avoids catalog-based unloading claims", async () => {
    const { response, answer } = await submit("Đầu gối tôi hơi khó chịu khi squat nhưng vẫn muốn tập chân. Tôi nên làm gì?");
    expect({ status: response.status, trace: answer.answerTrace, kbCalls: kbMock.mock.calls.length, content: answer.content })
      .toMatchObject({ status: 200, kbCalls: 0, trace: { webSearchUsed: false, evidenceMode: "model_prior" }, content: expect.not.stringContaining(irrelevantSource) });
    expect(answer.content).not.toMatch(/Bulgarian|Leg Press|gần như không gây áp lực/i);
    expect(answer.uiCard).toMatchObject({ cardType: "webSources", data: {
      sources: [{ uri: "https://orthoinfo.aaos.org/globalassets/pdfs/2023-rehab_knee.pdf" }],
    } });
  });
  it.each(["và", "nhưng", ",", ";"])("keeps an inherited private symptom out of external search: %s", async (separator) => {
    const search = vi.fn(); toolRegistry.search_knowledge.execute = search;
    await submit(`Tôi có đôi tạ đơn ${separator} bị nhức gối sau tập. Cho tôi nghiên cứu mới nhất.`);
    expect(search).not.toHaveBeenCalled();
    expect(kbMock).not.toHaveBeenCalled();
  });
  it.each([
    "Tôi có đôi tạ đơn nhưng đang bị nhức gối sau tập.",
    "Tôi có đôi tạ đơn, vẫn bị nhức gối sau tập.",
    "I have dumbbells but currently have knee pain after exercise.",
    "Học viên có đôi tạ đơn nhưng bị nhức gối sau tập.",
    "I have dumbbells but have rheumatoid arthritis. Show latest exercise research.",
  ])("blocks external search for a modified inherited symptom: %s", async (disclosure) => {
    const search = vi.fn(); toolRegistry.search_knowledge.execute = search;
    const { answer } = await submit(`${disclosure} Cho tôi nghiên cứu mới nhất.`);
    expect(search).not.toHaveBeenCalled();
    expect(kbMock).not.toHaveBeenCalled();
    expect(answer.answerTrace.webSearchUsed).toBe(false);
  });
});
