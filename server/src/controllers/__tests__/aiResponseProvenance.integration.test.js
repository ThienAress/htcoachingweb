import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { clearCollections, createTestApp, createTestUser, setupTestDB,
  teardownTestDB, withAuth } from "../../__tests__/setup.js";

const { retrieval, stream } = vi.hoisted(() => ({ retrieval: vi.fn(), stream: vi.fn() }));
vi.mock("../../services/ai/providers/index.js", () => ({ llmStream: stream }));
vi.mock("../../services/ai/knowledgeRetrieval.service.js", () => ({ searchAssistantKnowledgeBase: retrieval }));
vi.mock("../../utils/safeLogger.js", () => ({ safeLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const claim = "Người trưởng thành nên đạt ít nhất 150 phút hoạt động thể lực cường độ vừa mỗi tuần.";
const uri = "https://www.who.int/news-room/fact-sheets/detail/physical-activity";
let app;
beforeAll(async () => {
  await setupTestDB();
  const { default: routes } = await import("../../routes/ai.routes.js");
  app = createTestApp();
  app.use("/api/ai", routes);
});
afterEach(async () => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  await clearCollections();
});
afterAll(teardownTestDB);

describe("delivered internal evidence provenance", () => {
  it("labels claim-bound reviewed KB evidence even when the question does not exactly match", async () => {
    vi.stubEnv("AI_PROVIDER", "gemini");
    retrieval.mockResolvedValue({ results: [{
      _id: "507f191e810c19729de860ed",
      question: "Tập luyện mỗi tuần bao nhiêu phút?",
      answer: `Theo nguồn chính thức, ${claim.toLocaleLowerCase("vi")}`,
      category: "training",
      status: "published",
      evidenceLevel: "source_backed",
      reviewStatus: "reviewed",
      freshnessClass: "stable",
      sources: [{ type: "official", title: "Physical activity", publisher: "WHO",
        url: uri, evidenceTier: "primary" }],
    }] });
    stream.mockImplementation(async function* answer() {
      yield { type: "text", content: `Theo nguồn chính thức, ${claim.toLocaleLowerCase("vi")}` };
    });
    const { accessToken } = await createTestUser();
    const response = await withAuth(request(app).post("/api/ai/chat"), accessToken)
      .send({ message: "Tập luyện đem lại lợi ích sức khỏe nào?" });
    expect(response.status).toBe(200);
    const frames = response.text.split("\n\n").filter((row) => row.startsWith("data: "))
      .map((row) => JSON.parse(row.slice(6)));
    expect(retrieval).toHaveBeenCalledTimes(1);
    expect(frames.filter((frame) => frame.type === "text").map((frame) => frame.content).join(""))
      .toContain(uri);
    expect(frames.find((frame) => frame.type === "done").meta.provenance).toBe("internal_kb");
  });
});
