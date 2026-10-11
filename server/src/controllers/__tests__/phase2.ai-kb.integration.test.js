import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import request from "supertest";

import {
  clearCollections,
  createTestApp,
  createTestUser,
  setupTestDB,
  teardownTestDB,
  withAuth,
} from "../../__tests__/setup.js";
import { protect } from "../../middlewares/auth.middleware.js";
import ChatConversation from "../../models/ChatConversation.js";
import Food from "../../models/Food.js";
import KnowledgeEntry from "../../models/KnowledgeEntry.js";
import {
  chatStream,
  clearHistory,
  forkConversation,
  getConversations,
  getHistory,
} from "../ai.controller.js";
import {
  createEntry,
  mergeVariant,
  suggestFromConversations,
  updateEntry,
} from "../knowledgeBase.controller.js";
import {
  getMetricsSnapshot,
  resetMetricsForTests,
} from "../../observability/metrics.js";

let app;

const CONFIRMED_TDEE_PAYLOAD = Object.freeze({
  gender: "male",
  age: 30,
  heightCm: 175,
  weightKg: 75,
  dailyMovement: "mostly_seated",
  steps: "under_5000",
  trainingFrequency: "five_plus",
  trainingDuration: "between_45_60",
  trainingIntensity: "moderate",
  goal: "fat_loss",
});

const createSuggestionConversation = (userId) =>
  ChatConversation.create({
    userId,
    title: "Synthetic fitness Q&A",
    messages: [
      {
        role: "user",
        content: "Tôi nên phân bổ protein trong ngày như thế nào?",
      },
      {
        role: "assistant",
        content:
          "Bạn có thể chia protein tương đối đều vào các bữa chính để hỗ trợ tổng lượng protein trong ngày.",
      },
    ],
  });

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.post("/api/ai/chat", protect, chatStream);
  app.get("/api/ai/conversations", protect, getConversations);
  app.get("/api/ai/history", protect, getHistory);
  app.delete("/api/ai/history", protect, clearHistory);
  app.post("/api/ai/conversations/:id/fork", protect, forkConversation);
  app.post("/api/knowledge-base", protect, createEntry);
  app.put("/api/knowledge-base/:id", protect, updateEntry);
  app.post("/api/knowledge-base/:id/merge", protect, mergeVariant);
  app.post(
    "/api/knowledge-base/suggest-from-conversations",
    protect,
    suggestFromConversations,
  );
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env.GEMINI_API_KEY;
  resetMetricsForTests();
  await clearCollections();
});

afterAll(teardownTestDB);

describe("Phase 2 AI conversation integrity", () => {
  it("does not expose internal errors from conversation list or history APIs", async () => {
    const { accessToken } = await createTestUser();
    const internalMessage = "INTERNAL_SENTINEL_DO_NOT_EXPOSE";

    vi.spyOn(ChatConversation, "find").mockImplementationOnce(() => {
      throw new Error(internalMessage);
    });
    const listResponse = await withAuth(
      request(app).get("/api/ai/conversations"),
      accessToken,
    );
    expect(listResponse.status).toBe(500);
    expect(listResponse.body.message).toBe(
      "Không thể tải danh sách cuộc trò chuyện",
    );
    expect(listResponse.text).not.toContain(internalMessage);

    vi.spyOn(ChatConversation, "findOne").mockImplementationOnce(() => {
      throw new Error(internalMessage);
    });
    const historyResponse = await withAuth(
      request(app).get("/api/ai/history"),
      accessToken,
    );
    expect(historyResponse.status).toBe(500);
    expect(historyResponse.body.message).toBe(
      "Không thể tải lịch sử trò chuyện",
    );
    expect(historyResponse.text).not.toContain(internalMessage);
  });

  it("does not expose internal errors when clearing history", async () => {
    const { accessToken } = await createTestUser();
    const internalMessage = "INTERNAL_SENTINEL_DO_NOT_EXPOSE";
    vi.spyOn(ChatConversation, "exists").mockRejectedValueOnce(
      new Error(internalMessage),
    );

    const response = await withAuth(
      request(app).delete("/api/ai/history"),
      accessToken,
    );

    expect(response.status).toBe(500);
    expect(response.body.message).toBe("Không thể xóa lịch sử trò chuyện");
    expect(response.text).not.toContain(internalMessage);
  });

  it("persists the user turn before streaming and stores bounded summaries", async () => {
    const { user, accessToken } = await createTestUser();
    const requestId = "a26e93e8-8d21-4be2-9c6e-2ebf3cc340b1";
    const response = await withAuth(
      request(app).post("/api/ai/chat").send({
        message: "Xin chào trợ lý",
        requestId,
        context: { page: "/blog", injected: true },
      }),
      accessToken,
    );

    expect(response.status).toBe(200);
    expect(response.text).toContain('"type":"conversation"');
    expect(response.text).toContain('"type":"done"');

    const conversation = await ChatConversation.findOne({ userId: user._id })
      .select("+activeStreamId +recentRequestIds")
      .lean();
    expect(conversation.messages[0].content).toBe("Xin chào trợ lý");
    expect(conversation.messages.some((item) => item.role === "assistant")).toBe(true);
    expect(conversation.messageCount).toBe(2);
    expect(conversation.lastMessagePreview).toBeTruthy();
    expect(conversation.activeStreamId).toBeNull();
    expect(conversation.recentRequestIds).toContain(requestId);
    expect(conversation.context.injected).toBeUndefined();
  });

  it("deduplicates a retried request and rejects a second active stream", async () => {
    const { user, accessToken } = await createTestUser();
    const requestId = "b26e93e8-8d21-4be2-9c6e-2ebf3cc340b2";
    await withAuth(
      request(app).post("/api/ai/chat").send({ message: "Hello", requestId }),
      accessToken,
    );
    const conversation = await ChatConversation.findOne({ userId: user._id });

    const duplicate = await withAuth(
      request(app).post("/api/ai/chat").send({
        message: "Hello",
        conversationId: conversation._id,
        requestId,
      }),
      accessToken,
    );
    expect(duplicate.status).toBe(200);
    expect(duplicate.text).toContain('"duplicate":true');
    expect((await ChatConversation.findById(conversation._id)).messageCount).toBe(2);

    await ChatConversation.updateOne(
      { _id: conversation._id },
      { $set: { activeStreamId: "busy", activeStreamStartedAt: new Date() } },
    );
    const busy = await withAuth(
      request(app).post("/api/ai/chat").send({
        message: "Another turn",
        conversationId: conversation._id,
        requestId: "c26e93e8-8d21-4be2-9c6e-2ebf3cc340b3",
      }),
      accessToken,
    );
    expect(busy.status).toBe(409);
  });

  it("persists structured TDEE memory after confirmed structured input", async () => {
    const { user, accessToken } = await createTestUser();
    const structuredAction = {
      type: "calculate_tdee",
      payload: CONFIRMED_TDEE_PAYLOAD,
    };
    await withAuth(
      request(app).post("/api/ai/chat").send({
        message: "Xác nhận và tính TDEE",
        structuredAction,
        requestId: "e26e93e8-8d21-4be2-9c6e-2ebf3cc340b5",
      }),
      accessToken,
    );

    const conversation = await ChatConversation.findOne({ userId: user._id })
      .lean();

    expect(conversation.workingMemory.lastTdee).toMatchObject({
      input: {
        gender: "male",
        age: 30,
        heightCm: 175,
        weightKg: 75,
        activityLevel: "moderate",
        dailyMovement: "mostly_seated",
        steps: "under_5000",
        trainingFrequency: "five_plus",
        trainingDuration: "between_45_60",
        trainingIntensity: "moderate",
        goal: "fat_loss",
      },
    });
    expect(conversation.messages[0].structuredAction).toEqual(structuredAction);

    const history = await withAuth(
      request(app).get("/api/ai/history"),
      accessToken,
    );
    expect(history.status).toBe(200);
    expect(history.body.data.messages[0].structuredAction).toEqual(
      structuredAction,
    );
  });

  it("prefills a partial TDEE form, persists it, then calculates only from confirmed structured data", async () => {
    const { user, accessToken } = await createTestUser();
    const intakeResponse = await withAuth(
      request(app).post("/api/ai/chat").send({
        message:
          "Tôi là nam, 28 tuổi, 1 tuần tập 3-4 buổi, tính giúp tôi TDEE",
        requestId: "a46e93e8-8d21-4be2-9c6e-2ebf3cc340b8",
      }),
      accessToken,
    );

    expect(intakeResponse.status).toBe(200);
    expect(intakeResponse.text).toContain('"cardType":"tdeeForm"');
    expect(intakeResponse.text).toContain('"trainingFrequency":"three_four"');
    expect(intakeResponse.text).not.toContain('"activityLevel"');

    const conversation = await ChatConversation.findOne({ userId: user._id })
      .lean();
    expect(
      conversation.messages.find(
        (item) => item.role === "assistant" && item.uiCard?.cardType === "tdeeForm",
      )?.uiCard,
    ).toMatchObject({
      cardType: "tdeeForm",
      data: {
        prefill: {
          gender: "male",
          age: 28,
          trainingFrequency: "three_four",
        },
      },
    });

    const structuredAction = {
      type: "calculate_tdee",
      payload: {
        gender: "male",
        age: 28,
        heightCm: 175,
        weightKg: 75,
        dailyMovement: "mixed",
        steps: "between_5000_7999",
        trainingFrequency: "three_four",
        trainingDuration: "between_45_60",
        trainingIntensity: "moderate",
        goal: "maintenance",
      },
    };
    const calculationResponse = await withAuth(
      request(app).post("/api/ai/chat").send({
        message: "Tính TDEE từ thông tin tôi đã xác nhận",
        conversationId: conversation._id,
        requestId: "b46e93e8-8d21-4be2-9c6e-2ebf3cc340b9",
        structuredAction,
      }),
      accessToken,
    );

    expect(calculationResponse.status).toBe(200);
    expect(calculationResponse.text).toContain('"cardType":"tdee"');
    const updated = await ChatConversation.findById(conversation._id).lean();
    expect(updated.workingMemory.lastTdee.input).toMatchObject({
      ...structuredAction.payload,
      activityLevel: "moderate",
    });
  });

  it("reuses TDEE memory when the next turn requests a four-meal plan", async () => {
    const { user, accessToken } = await createTestUser();
    await withAuth(
      request(app).post("/api/ai/chat").send({
        message: "Xác nhận và tính TDEE",
        structuredAction: {
          type: "calculate_tdee",
          payload: CONFIRMED_TDEE_PAYLOAD,
        },
        requestId: "f26e93e8-8d21-4be2-9c6e-2ebf3cc340b6",
      }),
      accessToken,
    );
    const conversation = await ChatConversation.findOne({ userId: user._id });
    await Food.insertMany([
      {
        label: "Ức gà kiểm thử",
        protein: 31,
        carb: 0,
        fat: 3.6,
        calories: 156.4,
      },
      {
        label: "Cơm kiểm thử",
        protein: 2.7,
        carb: 28,
        fat: 0.3,
        calories: 125.5,
      },
      {
        label: "Dầu kiểm thử",
        protein: 0,
        carb: 0,
        fat: 100,
        calories: 900,
      },
    ]);

    const response = await withAuth(
      request(app).post("/api/ai/chat").send({
        message: "Làm lại thực đơn với 4 meal cho tôi",
        conversationId: conversation._id,
        requestId: "a36e93e8-8d21-4be2-9c6e-2ebf3cc340b7",
      }),
      accessToken,
    );
    const updated = await ChatConversation.findById(conversation._id).lean();

    expect(response.text).not.toContain("cần tính TDEE trước");
    expect(updated.workingMemory.lastMeal.mealsPerDay).toBe(4);
    expect(
      updated.messages.find(
        (message) => message.uiCard?.cardType === "meal",
      )?.uiCard?.data?.mealRevision,
    ).toBe(1);
  });

  it("forks before a user message instead of rewriting server history", async () => {
    const { user, accessToken } = await createTestUser();
    await withAuth(
      request(app).post("/api/ai/chat").send({
        message: "Original question",
        requestId: "d26e93e8-8d21-4be2-9c6e-2ebf3cc340b4",
      }),
      accessToken,
    );
    const source = await ChatConversation.findOne({ userId: user._id });
    const userMessage = source.messages.find((message) => message.role === "user");

    const response = await withAuth(
      request(app)
        .post(`/api/ai/conversations/${source._id}/fork`)
        .send({ messageId: userMessage._id }),
      accessToken,
    );

    expect(response.status).toBe(201);
    expect(response.body.data.messages).toHaveLength(0);
    const branch = await ChatConversation.findById(
      response.body.data.conversationId,
    ).lean();
    expect(branch.forkedFromConversationId.toString()).toBe(source._id.toString());
    expect((await ChatConversation.findById(source._id)).messages).toHaveLength(2);
  });

  it("replaces a retry tail atomically instead of appending a ghost turn", async () => {
    const { user, accessToken } = await createTestUser();
    const source = await ChatConversation.create({
      userId: user._id,
      title: "Retry contract",
      messages: [
        { role: "user", content: "Câu hỏi trước" },
        { role: "assistant", content: "Câu trả lời trước" },
        { role: "user", content: "Câu hỏi cần retry" },
        { role: "assistant", content: "Phần trả lời dở dang" },
      ],
      messageCount: 4,
    });
    const retryTarget = source.messages[2];

    const response = await withAuth(
      request(app).post("/api/ai/chat").send({
        message: "Câu hỏi cần retry",
        conversationId: source._id,
        retryOfMessageId: retryTarget._id,
        requestId: "e26e93e8-8d21-4be2-9c6e-2ebf3cc340b5",
      }),
      accessToken,
    );

    expect(response.status).toBe(200);
    expect(response.text).toContain('"type":"done"');
    const updated = await ChatConversation.findById(source._id).lean();
    expect(updated.messages.filter(
      (message) => message.role === "user" && message.content === "Câu hỏi cần retry",
    )).toHaveLength(1);
    expect(updated.messages.some(
      (message) => message.content === "Phần trả lời dở dang",
    )).toBe(false);
    expect(updated.messages.filter((message) => message.role === "assistant").length)
      .toBe(2);
  });

  it("rejects a stale retry CAS without deleting a turn completed by another tab", async () => {
    const { user, accessToken } = await createTestUser();
    const source = await ChatConversation.create({
      userId: user._id,
      title: "Concurrent retry contract",
      messages: [
        { role: "user", content: "Câu hỏi trước" },
        { role: "assistant", content: "Câu trả lời trước" },
        { role: "user", content: "Câu hỏi cần retry" },
        { role: "assistant", content: "Câu trả lời cần giữ nếu CAS thua" },
      ],
      messageCount: 4,
    });
    const retryTarget = source.messages[2];
    const originalCollectionUpdate =
      ChatConversation.collection.updateOne.bind(ChatConversation.collection);
    let releaseRetryAcquire;
    let markRetryAcquireReached;
    let intercepted = false;
    const retryAcquireReached = new Promise((resolve) => {
      markRetryAcquireReached = resolve;
    });
    const retryAcquireGate = new Promise((resolve) => {
      releaseRetryAcquire = resolve;
    });
    vi.spyOn(ChatConversation.collection, "updateOne")
      .mockImplementation(async (filter, update, options) => {
        if (
          !intercepted &&
          String(filter?._id) === String(source._id) &&
          Array.isArray(filter?.messages) &&
          update?.$set?.activeStreamId
        ) {
          intercepted = true;
          markRetryAcquireReached();
          await retryAcquireGate;
        }
        return originalCollectionUpdate(filter, update, options);
      });

    const retryPromise = withAuth(
      request(app).post("/api/ai/chat").send({
        message: retryTarget.content,
        conversationId: source._id,
        retryOfMessageId: retryTarget._id,
        requestId: "e36e93e8-8d21-4be2-9c6e-2ebf3cc340b5",
      }),
      accessToken,
    ).then((response) => response);

    await retryAcquireReached;
    const concurrent = await withAuth(
      request(app).post("/api/ai/chat").send({
        message: "Lượt mới hoàn tất từ tab khác",
        conversationId: source._id,
        requestId: "e46e93e8-8d21-4be2-9c6e-2ebf3cc340b5",
      }),
      accessToken,
    );
    releaseRetryAcquire();
    const retried = await retryPromise;
    const stored = await ChatConversation.findById(source._id).lean();

    expect({
      concurrentStatus: concurrent.status,
      retryStatus: retried.status,
      keptConcurrentTurn: stored.messages.some(
        ({ role, content }) =>
          role === "user" && content === "Lượt mới hoàn tất từ tab khác",
      ),
      keptOriginalTail: stored.messages.some(
        ({ content }) => content === "Câu trả lời cần giữ nếu CAS thua",
      ),
    }).toEqual({
      concurrentStatus: 200,
      retryStatus: 409,
      keptConcurrentTurn: true,
      keptOriginalTail: true,
    });
  });

  it("keeps memory-only TDEE state when retrying a meal tail", async () => {
    const { user, accessToken } = await createTestUser();
    const retainedMessages = Array.from({ length: 37 }, (_, index) => ({
      role: index % 2 === 0 ? "user" : "assistant",
      content: `Lịch sử gần đây ${index + 1}`,
    }));
    const source = await ChatConversation.create({
      userId: user._id,
      title: "Memory-only TDEE retry",
      messages: [
        ...retainedMessages,
        { role: "user", content: "Tôi cần thêm động lực tập luyện" },
        {
          role: "assistant",
          content: "",
          toolCalls: [{ id: "old-meal", name: "suggest_meal", args: {} }],
        },
        {
          role: "tool",
          content: "Thực đơn cũ",
          toolName: "suggest_meal",
          toolCallId: "old-meal",
          toolStatus: "success",
        },
      ],
      messageCount: 39,
      workingMemory: {
        lastTdee: {
          input: {
            ...CONFIRMED_TDEE_PAYLOAD,
            activityLevel: "moderate",
          },
          result: {
            bmr: 1700,
            tdee: 2600,
            targetCalories: 2300,
            adjustment: -300,
            macros: {},
          },
        },
        lastMeal: {
          targetCalories: 2300,
          proteinGrams: 170,
          carbGrams: 240,
          fatGrams: 73,
          mealsPerDay: 4,
        },
      },
    });
    const retryTarget = source.messages[37];

    const response = await withAuth(
      request(app).post("/api/ai/chat").send({
        message: retryTarget.content,
        conversationId: source._id,
        retryOfMessageId: retryTarget._id,
        requestId: "e56e93e8-8d21-4be2-9c6e-2ebf3cc340b5",
      }),
      accessToken,
    );
    const updated = await ChatConversation.findById(source._id).lean();

    expect({
      status: response.status,
      targetCalories: updated.workingMemory.lastTdee?.result?.targetCalories,
      lastMeal: updated.workingMemory.lastMeal,
    }).toEqual({
      status: 200,
      targetCalories: 2300,
      lastMeal: undefined,
    });
  });

  it("rejects a retry payload mismatch and permits a genuinely stale stream", async () => {
    const { user, accessToken } = await createTestUser();
    const structuredAction = {
      type: "calculate_tdee",
      payload: CONFIRMED_TDEE_PAYLOAD,
    };
    const source = await ChatConversation.create({
      userId: user._id,
      title: "Retry payload contract",
      messages: [{
        role: "user",
        content: "Tính TDEE từ dữ liệu đã xác nhận",
        structuredAction,
      }],
      messageCount: 1,
    });
    const target = source.messages[0];

    const mismatched = await withAuth(
      request(app).post("/api/ai/chat").send({
        message: target.content,
        conversationId: source._id,
        retryOfMessageId: target._id,
        structuredAction: {
          ...structuredAction,
          payload: { ...CONFIRMED_TDEE_PAYLOAD, calorieAdjustment: 100 },
        },
        requestId: "f26e93e8-8d21-4be2-9c6e-2ebf3cc340b1",
      }),
      accessToken,
    );
    expect(mismatched.status).toBe(409);
    expect((await ChatConversation.findById(source._id)).messages).toHaveLength(1);

    await ChatConversation.updateOne(
      { _id: source._id },
      {
        $set: {
          activeStreamId: "legacy-stale-stream",
          activeStreamStartedAt: new Date(Date.now() - 11 * 60 * 1000),
        },
      },
    );
    const retried = await withAuth(
      request(app).post("/api/ai/chat").send({
        message: target.content,
        conversationId: source._id,
        retryOfMessageId: target._id,
        structuredAction,
        requestId: "f26e93e8-8d21-4be2-9c6e-2ebf3cc340b2",
      }),
      accessToken,
    );
    expect(retried.status).toBe(200);
    expect(retried.text).toContain('"type":"done"');
  });
});

describe("Phase 2 Knowledge Base lifecycle", () => {
  it("records bounded Gemini usage for Knowledge Base suggestions", async () => {
    const { user, accessToken } = await createTestUser({ role: "admin" });
    await createSuggestionConversation(user._id);
    process.env.GEMINI_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify([
                        {
                          index: 0,
                          score: 8,
                          category: "nutrition",
                          reason: "Có thể tái sử dụng cho nhiều khách hàng",
                        },
                      ]),
                    },
                  ],
                },
              },
            ],
            usageMetadata: {
              promptTokenCount: 42,
              candidatesTokenCount: 8,
              totalTokenCount: 50,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const response = await withAuth(
      request(app)
        .post("/api/knowledge-base/suggest-from-conversations")
        .send({ days: 7 }),
      accessToken,
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(getMetricsSnapshot().counters).toMatchObject({
      "provider.gemini_kb_suggestion_requests": 1,
      "provider.gemini_kb_suggestion_succeeded": 1,
      "provider.gemini_kb_suggestion_prompt_tokens": 42,
      "provider.gemini_kb_suggestion_output_tokens": 8,
      "provider.gemini_kb_suggestion_total_tokens": 50,
    });
  });

  it("records provider-reported token usage when a Knowledge Base suggestion fails", async () => {
    const { user, accessToken } = await createTestUser({ role: "admin" });
    await createSuggestionConversation(user._id);
    process.env.GEMINI_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            error: { status: "UNAVAILABLE" },
            usageMetadata: {
              promptTokenCount: 21,
              candidatesTokenCount: 2,
              totalTokenCount: 23,
            },
          }),
          { status: 503, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const response = await withAuth(
      request(app)
        .post("/api/knowledge-base/suggest-from-conversations")
        .send({ days: 7 }),
      accessToken,
    );

    expect(response.status).toBe(503);
    expect(getMetricsSnapshot().counters).toMatchObject({
      "provider.gemini_kb_suggestion_requests": 1,
      "provider.gemini_kb_suggestion_failed": 1,
      "provider.gemini_kb_suggestion_prompt_tokens": 21,
      "provider.gemini_kb_suggestion_output_tokens": 2,
      "provider.gemini_kb_suggestion_total_tokens": 23,
    });
  });

  it("keeps an entry in draft when embedding generation fails", async () => {
    const { accessToken } = await createTestUser({ role: "admin" });
    const response = await withAuth(
      request(app).post("/api/knowledge-base").send({
        question: "Protein là gì?",
        answer: "Protein hỗ trợ xây dựng và duy trì mô cơ.",
        category: "nutrition",
        evidenceLevel: "source_backed",
        freshnessClass: "stable",
        sources: [
          {
            type: "professional",
            title: "Synthetic nutrition reference",
            publisher: "Synthetic Sports Nutrition Group",
            url: "https://example.org/nutrition/protein",
            evidenceTier: "professional",
          },
        ],
        status: "published",
      }),
      accessToken,
    );

    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe("draft");
    expect(response.body.data.embeddingStatus).toBe("failed");
    expect(response.body.data.embedding).toBeUndefined();
    expect(response.body.warning).toBeTruthy();

    const entry = await KnowledgeEntry.findById(response.body.data._id)
      .select("+embedding +embeddingError")
      .lean();
    expect(entry.embedding).toEqual([]);
    expect(entry.embeddingError).toBeTruthy();
  });

  it("rejects client-owned vectors, duplicate questions, and premature publish", async () => {
    const { accessToken } = await createTestUser({ role: "admin" });
    const forged = await withAuth(
      request(app).post("/api/knowledge-base").send({
        question: "Creatine là gì?",
        answer: "Một supplement.",
        embedding: [1, 2, 3],
      }),
      accessToken,
    );
    expect(forged.status).toBe(400);

    const created = await withAuth(
      request(app).post("/api/knowledge-base").send({
        question: "Creatine là gì?",
        answer: "Một supplement được nghiên cứu rộng rãi.",
      }),
      accessToken,
    );
    const duplicate = await withAuth(
      request(app).post("/api/knowledge-base").send({
        question: "  CREATINE   là gì? ",
        answer: "Nội dung trùng.",
      }),
      accessToken,
    );
    const publish = await withAuth(
      request(app).put(`/api/knowledge-base/${created.body.data._id}`).send({
        status: "published",
      }),
      accessToken,
    );
    const forgedMerge = await withAuth(
      request(app).post(`/api/knowledge-base/${created.body.data._id}/merge`).send({
        question: "Creatine có tác dụng gì?",
        embedding: [1, 2, 3],
      }),
      accessToken,
    );

    expect(duplicate.status).toBe(409);
    expect(publish.status).toBe(409);
    expect(forgedMerge.status).toBe(400);
  });
});
