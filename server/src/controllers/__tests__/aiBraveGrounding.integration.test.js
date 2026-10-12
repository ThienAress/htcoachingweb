import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { clearCollections, createTestApp, createTestUser, setupTestDB,
  teardownTestDB, withAuth } from "../../__tests__/setup.js";
import ChatConversation from "../../models/ChatConversation.js";
import { resetPublicFigureIdentityCache } from "../../services/ai/publicFigureIdentity.service.js";

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
  vi.unstubAllEnvs();
  configure();
  await clearCollections();
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await teardownTestDB();
});

describe("Vibi + Brave through owned chat SSE", () => {
  it.each(["staging", "production"])("searches once through Vibi + Brave in %s with citations and trace", async (environment) => {
    configure();
    if (environment === "production") {
      const env = {
        NODE_ENV: "production", APP_ENV: "production", AI_STAGING_PROVIDER_TRIAL: "",
        AI_PRODUCTION_PROVIDER_PROFILE: "vibi", MONGO_URI: "mongodb+srv://cluster.example/gym-app",
        CLIENT_URL: "https://app.example.com", PUBLIC_API_ORIGIN: "https://api.example.com",
        ALLOWED_ORIGINS: "https://app.example.com", BRAVE_SEARCH_API_KEY: "synthetic-" + "b".repeat(32),
      };
      for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
    }
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

  it("looks up a famous person named without a role word and answers with a source", async () => {
    const question = "bạn biết LeBron James không bro, thành tích của anh ấy vang dội như thế nào " +
      "và anh ấy củng tập luyện rất kỷ luật để có được thân hình săn chắc đúng không";
    const lebronQuote = "LeBron James has won 4 NBA championships and 4 NBA Finals MVP awards.";
    const lebronAnswer = { segments: [{
      text: "LeBron James đã giành 4 chức vô địch NBA và 4 danh hiệu MVP Chung kết NBA.",
      supports: [{ sourceId: "source_1", quote: lebronQuote }],
    }] };
    const fetchMock = vi.fn(async (url, options) => {
      if (url === "https://api.search.brave.com/res/v1/llm/context") {
        return new Response(JSON.stringify({ grounding: { generic: [{
          url: "https://www.nba.com/player/2544/lebron-james",
          title: "LeBron James", snippets: [lebronQuote],
        }] } }));
      }
      if (url === "https://vibi.top/v1/chat/completions") {
        const body = JSON.parse(options.body);
        return body.tool_choice?.function?.name === "submit_grounded_answer"
          ? streamTool("submit_grounded_answer", lebronAnswer)
          : streamTool("search_knowledge", { query: question });
      }
      throw new Error("Unexpected egress");
    });
    vi.stubGlobal("fetch", fetchMock);
    const { accessToken } = await createTestUser();
    const response = await withAuth(request(app).post("/api/ai/chat"), accessToken)
      .send({ message: question });
    expect(response.status).toBe(200);
    const frames = parseFrames(response);
    expect(frames.some((frame) => frame.type === "error")).toBe(false);
    expect(frames.find((frame) => frame.type === "done").meta.provenance).toBe("web_grounded");
    const text = frames.filter((frame) => frame.type === "text").map((frame) => frame.content).join("");
    expect(text).toContain("LeBron James");
    expect(text.startsWith("Biết chứ bro!")).toBe(true);
    expect(text).toContain("Điều đáng học hỏi");
    expect(text).not.toContain("chưa thể xác minh");
    const braveCalls = fetchMock.mock.calls.filter(([url]) =>
      url === "https://api.search.brave.com/res/v1/llm/context");
    expect(braveCalls).toHaveLength(1);
  });

  it("searches a nickname under the canonical name", async () => {
    const question = "Đăng Béo thường tập gì để có thân hình đó?";
    const dangQuote = "Hoàng Hải Đăng trains with 5 sessions of weight lifting each week.";
    const dangAnswer = { segments: [{
      text: "Hoàng Hải Đăng tập tạ 5 buổi mỗi tuần.",
      supports: [{ sourceId: "source_1", quote: dangQuote }],
    }] };
    const fetchMock = vi.fn(async (url, options) => {
      if (url === "https://api.search.brave.com/res/v1/llm/context") {
        return new Response(JSON.stringify({ grounding: { generic: [{
          url: "https://example.com/hoang-hai-dang", title: "Hoàng Hải Đăng",
          snippets: [dangQuote],
        }] } }));
      }
      if (url === "https://vibi.top/v1/chat/completions") {
        const body = JSON.parse(options.body);
        return body.tool_choice?.function?.name === "submit_grounded_answer"
          ? streamTool("submit_grounded_answer", dangAnswer)
          : streamTool("search_knowledge", { query: question });
      }
      throw new Error("Unexpected egress");
    });
    vi.stubGlobal("fetch", fetchMock);
    const { accessToken } = await createTestUser();
    const response = await withAuth(request(app).post("/api/ai/chat"), accessToken)
      .send({ message: question });
    expect(response.status).toBe(200);
    const frames = parseFrames(response);
    expect(frames.find((frame) => frame.type === "done").meta.provenance).toBe("web_grounded");
    const braveCall = fetchMock.mock.calls.find(([url]) =>
      url === "https://api.search.brave.com/res/v1/llm/context");
    const sentQuery = JSON.parse(braveCall[1].body).q;
    expect(sentQuery).toContain("Hoàng Hải Đăng");
    expect(sentQuery).not.toContain("Đăng Béo");
  });

  it("searches again for a follow-up that only says 'anh ấy' after a public figure", async () => {
    const quote = "LeBron James trains about 6 days per week with weights and recovery work.";
    const answerFor = { segments: [{
      text: "LeBron James tập khoảng 6 ngày mỗi tuần với tạ và các bài phục hồi.",
      supports: [{ sourceId: "source_1", quote }],
    }] };
    const first = "LeBron James thành tích thế nào?";
    const second = "anh ấy tập luyện cụ thể như thế nào mỗi tuần vậy?";
    let userQuestion = first;
    const fetchMock = vi.fn(async (url, options) => {
      if (url === "https://api.search.brave.com/res/v1/llm/context") {
        return new Response(JSON.stringify({ grounding: { generic: [{
          url: "https://www.mensfitness.com/lebron-training", title: "LeBron training",
          snippets: [quote],
        }] } }));
      }
      if (url === "https://vibi.top/v1/chat/completions") {
        const body = JSON.parse(options.body);
        return body.tool_choice?.function?.name === "submit_grounded_answer"
          ? streamTool("submit_grounded_answer", answerFor)
          : streamTool("search_knowledge", { query: userQuestion });
      }
      throw new Error("Unexpected egress");
    });
    vi.stubGlobal("fetch", fetchMock);
    const { accessToken } = await createTestUser();
    const firstResponse = await withAuth(request(app).post("/api/ai/chat"), accessToken)
      .send({ message: first });
    expect(firstResponse.status).toBe(200);
    const conversationId = parseFrames(firstResponse)
      .find((frame) => frame.type === "conversation").conversationId;
    userQuestion = second;
    const secondResponse = await withAuth(request(app).post("/api/ai/chat"), accessToken)
      .send({ message: second, conversationId });
    expect(secondResponse.status).toBe(200);
    expect(parseFrames(secondResponse).find((frame) => frame.type === "done").meta.provenance)
      .toBe("web_grounded");
    const braveCalls = fetchMock.mock.calls.filter(([url]) =>
      url === "https://api.search.brave.com/res/v1/llm/context");
    expect(braveCalls).toHaveLength(2);
    expect(JSON.parse(braveCalls[1][1].body).q)
      .toBe("LeBron James training workout routine");
  });

  it("does not search an ordinary private name even when it is written like a full name", async () => {
    const fetchMock = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);
    const { accessToken } = await createTestUser();
    const response = await withAuth(request(app).post("/api/ai/chat"), accessToken)
      .send({ message: "Nguyễn Văn A thường tập gì để có thân hình đẹp?" });
    expect(response.status).toBe(200);
    const braveCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes("api.search.brave.com"));
    expect(braveCalls).toHaveLength(0);
  });

  describe("identity classifier for names outside the registry", () => {
    afterEach(() => resetPublicFigureIdentityCache());
    const mcgregorQuestion = "Conor McGregor thành tích thế nào?";
    const mcgregorQuote = "Conor McGregor won the UFC featherweight title in 2015 and the lightweight title in 2016.";
    const mcgregorAnswer = { segments: [{
      text: "Conor McGregor đã giành đai hạng lông UFC năm 2015 và đai hạng nhẹ năm 2016.",
      supports: [{ sourceId: "source_1", quote: mcgregorQuote }],
    }] };
    const stubProvider = (classification) => {
      const fetchMock = vi.fn(async (url, options) => {
        if (url === "https://api.search.brave.com/res/v1/llm/context") {
          return new Response(JSON.stringify({ grounding: { generic: [{
            url: "https://www.ufc.com/athlete/conor-mcgregor", title: "Conor McGregor",
            snippets: [mcgregorQuote],
          }] } }));
        }
        if (url === "https://vibi.top/v1/chat/completions") {
          const body = JSON.parse(options.body);
          if (body.response_format?.type === "json_object") {
            return classification === null
              ? new Response("{}", { status: 500 })
              : streamText(JSON.stringify(classification));
          }
          return body.tool_choice?.function?.name === "submit_grounded_answer"
            ? streamTool("submit_grounded_answer", mcgregorAnswer)
            : streamTool("search_knowledge", { query: mcgregorQuestion });
        }
        throw new Error("Unexpected egress");
      });
      vi.stubGlobal("fetch", fetchMock);
      return fetchMock;
    };
    const braveCalls = (fetchMock) => fetchMock.mock.calls.filter(([url]) =>
      String(url).includes("api.search.brave.com"));

    it("looks up a famous person the classifier confirms, sending only the name to it", async () => {
      const fetchMock = stubProvider({ public: true, confidence: "high", canonical: "Conor McGregor" });
      const { accessToken } = await createTestUser();
      const response = await withAuth(request(app).post("/api/ai/chat"), accessToken)
        .send({ message: "Conor McGregor thành tích thế nào?" });
      expect(response.status).toBe(200);
      expect(parseFrames(response).find((frame) => frame.type === "done").meta.provenance)
        .toBe("web_grounded");
      const classifierCall = fetchMock.mock.calls.find(([url, options]) =>
        url === "https://vibi.top/v1/chat/completions"
        && JSON.parse(options.body).response_format?.type === "json_object");
      const classifierMessages = JSON.parse(classifierCall[1].body).messages;
      expect(classifierMessages[classifierMessages.length - 1].content)
        .toBe(JSON.stringify({ name: "Conor McGregor" }));
      expect(braveCalls(fetchMock)).toHaveLength(1);
    });

    it.each([
      ["says the name is not public", { public: false, confidence: "high", canonical: "" }],
      ["is unsure", { public: true, confidence: "low", canonical: "Conor McGregor" }],
      ["names a different person", { public: true, confidence: "high", canonical: "Floyd Mayweather" }],
      ["is unavailable", null],
    ])("does not search when the classifier %s", async (_label, classification) => {
      const fetchMock = stubProvider(classification);
      const { accessToken } = await createTestUser();
      const response = await withAuth(request(app).post("/api/ai/chat"), accessToken)
        .send({ message: "Conor McGregor thành tích thế nào?" });
      expect(response.status).toBe(200);
      expect(braveCalls(fetchMock)).toHaveLength(0);
    });

    it("never asks the classifier about a private subject", async () => {
      const fetchMock = stubProvider({ public: true, confidence: "high", canonical: "Conor McGregor" });
      const { accessToken } = await createTestUser();
      const response = await withAuth(request(app).post("/api/ai/chat"), accessToken)
        .send({ message: "học viên Conor McGregor bị tiểu đường, nên ăn gì?" });
      expect(response.status).toBe(200);
      const classifierCalls = fetchMock.mock.calls.filter(([url, options]) =>
        url === "https://vibi.top/v1/chat/completions"
        && JSON.parse(options.body).response_format?.type === "json_object");
      expect(classifierCalls).toHaveLength(0);
      expect(braveCalls(fetchMock)).toHaveLength(0);
    });

    it("can be switched off", async () => {
      vi.stubEnv("AI_PUBLIC_FIGURE_CLASSIFIER", "off");
      const fetchMock = stubProvider({ public: true, confidence: "high", canonical: "Conor McGregor" });
      const { accessToken } = await createTestUser();
      const response = await withAuth(request(app).post("/api/ai/chat"), accessToken)
        .send({ message: "Conor McGregor thành tích thế nào?" });
      expect(response.status).toBe(200);
      expect(braveCalls(fetchMock)).toHaveLength(0);
    });
  });

  it.each([
    "học viên Lisa bị tiểu đường type 2 thì nên ăn gì?",
    "bạn tôi Lisa tập gym thế nào?",
  ])("never sends a private subject named in %s to the search provider", async (message) => {
    const fetchMock = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);
    const { accessToken } = await createTestUser();
    const response = await withAuth(request(app).post("/api/ai/chat"), accessToken).send({ message });
    expect(response.status).toBe(200);
    const braveCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes("api.search.brave.com"));
    expect(braveCalls).toHaveLength(0);
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
