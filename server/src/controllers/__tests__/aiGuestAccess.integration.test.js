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

vi.mock("../../services/ai/providers/index.js", () => ({
  llmStream: vi.fn(async function* streamMockResponse() {
    yield { type: "text", content: "Phản hồi fitness thử nghiệm" };
  }),
}));

vi.mock("../../utils/safeLogger.js", () => ({
  safeLog: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import {
  clearCollections,
  createTestApp,
  createTestUser,
  setupTestDB,
  teardownTestDB,
} from "../../__tests__/setup.js";
import ChatConversation from "../../models/ChatConversation.js";
import ServiceUsageBucket from "../../models/ServiceUsageBucket.js";
import { hashAiGuestSessionId } from "../../middlewares/aiGuestSession.js";
import { getAllConversations } from "../knowledgeBase.controller.js";
import { llmStream } from "../../services/ai/providers/index.js";

const TEST_CSRF = "test-csrf-token";
const GUEST_COOKIE_NAME = "htAiGuest";

let app;

const guestRequest = (payload, cookie) => {
  const cookies = [`csrfToken=${TEST_CSRF}`];
  if (cookie) cookies.push(cookie);
  return request(app)
    .post("/api/ai/chat")
    .set("Cookie", cookies)
    .set("X-CSRF-Token", TEST_CSRF)
    .send(payload);
};

const readGuestCookie = (response) =>
  response.headers["set-cookie"]
    ?.map((value) => value.split(";")[0])
    .find((value) => value.startsWith(`${GUEST_COOKIE_NAME}=`));

const rawRequestIdsFromStorage = (values = []) =>
  values.map((value) => String(value).slice(-36));

beforeAll(async () => {
  await setupTestDB();
  const { default: aiRoutes } = await import("../../routes/ai.routes.js");
  app = createTestApp();
  app.use("/api/ai", aiRoutes);
});

afterEach(async () => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  await clearCollections();
});

afterAll(async () => {
  await teardownTestDB();
});

describe("AI guest access", () => {
  it("requires exactly one conversation owner", async () => {
    await expect(
      ChatConversation.create({ title: "ownerless" }),
    ).rejects.toThrow("đúng một user hoặc guest session");
  });

  it("keeps guest conversations out of Knowledge Base mining", async () => {
    const { user } = await createTestUser();
    await ChatConversation.create([
      { userId: user._id, title: "User conversation" },
      { guestKey: "a".repeat(64), title: "Guest conversation" },
    ]);
    const res = { json: vi.fn((payload) => payload) };

    await getAllConversations({ query: {} }, res);

    expect(res.json.mock.calls[0][0].data).toHaveLength(1);
    expect(res.json.mock.calls[0][0].data[0].title).toBe("User conversation");
  });

  it("creates an isolated short-lived conversation without a user account", async () => {
    const response = await guestRequest({
      message: "Tóm tắt trang này giúp tôi",
      context: { page: "/blog", pageType: "wallet" },
    });

    expect(response.status).toBe(200);
    expect(readGuestCookie(response)).toBeTruthy();
    expect(response.text).toContain('"type":"quota"');
    expect(response.text).toContain('"limit":5');

    const conversation = await ChatConversation.findOne({ userId: null })
      .select("+guestKey")
      .lean();
    expect(conversation.guestKey).toMatch(/^[a-f0-9]{64}$/);
    expect(conversation.context.pageType).toBe("blog");
    expect(conversation.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(
      24 * 60 * 60 * 1000,
    );
  });

  it("does not let another guest continue a conversation by id", async () => {
    const first = await guestRequest({ message: "Xin chào" });
    const conversationId = first.text.match(/"conversationId":"([^"]+)"/)?.[1];
    expect(conversationId).toBeTruthy();

    const second = await guestRequest({
      message: "Tiếp tục",
      conversationId,
    });

    expect(second.status).toBe(404);
  });

  it("scopes request idempotency to each guest owner", async () => {
    const requestId = "b26e93e8-8d21-4be2-9c6e-2ebf3cc340b1";
    const first = await guestRequest({ message: "Bài tập chân", requestId });
    const second = await guestRequest({ message: "Bài tập lưng", requestId });
    const replay = await guestRequest(
      { message: "Bài tập chân", requestId },
      readGuestCookie(first),
    );
    const firstConversationId = first.text.match(
      /"conversationId":"([^"]+)"/,
    )?.[1];
    const secondConversationId = second.text.match(
      /"conversationId":"([^"]+)"/,
    )?.[1];

    expect({
      statuses: [first.status, second.status, replay.status],
      distinctOwners: readGuestCookie(first) !== readGuestCookie(second),
      distinctConversations: firstConversationId !== secondConversationId,
      replayDeduplicated: replay.text.includes('"duplicate":true'),
      replayConversationId: replay.text.match(
        /"conversationId":"([^"]+)"/,
      )?.[1],
      conversationCount: await ChatConversation.countDocuments(),
    }).toEqual({
      statuses: [200, 200, 200],
      distinctOwners: true,
      distinctConversations: true,
      replayDeduplicated: true,
      replayConversationId: firstConversationId,
      conversationCount: 2,
    });
  });

  it("recognizes a legacy raw request ID for the same guest", async () => {
    const sessionId = "b36e93e8-8d21-4be2-9c6e-2ebf3cc340b1";
    const requestId = "b46e93e8-8d21-4be2-9c6e-2ebf3cc340b1";
    const conversation = await ChatConversation.create({
      guestKey: hashAiGuestSessionId(sessionId),
      title: "Legacy guest turn",
      recentRequestIds: [requestId],
    });

    const response = await guestRequest(
      { message: "Không được tạo turn mới", requestId },
      `${GUEST_COOKIE_NAME}=${sessionId}`,
    );

    expect({
      status: response.status,
      duplicate: response.text.includes('"duplicate":true'),
      conversationId: response.text.match(/"conversationId":"([^"]+)"/)?.[1],
      conversationCount: await ChatConversation.countDocuments(),
    }).toEqual({
      status: 200,
      duplicate: true,
      conversationId: conversation._id.toString(),
      conversationCount: 1,
    });
  });

  it("returns 401 for an invalid access token instead of downgrading to guest", async () => {
    const response = await request(app)
      .post("/api/ai/chat")
      .set("Cookie", [
        "accessToken=invalid-token",
        `csrfToken=${TEST_CSRF}`,
      ])
      .set("X-CSRF-Token", TEST_CSRF)
      .send({ message: "Xin chào" });

    expect(response.status).toBe(401);
  });

  it("keeps CSRF mandatory for guest chat", async () => {
    const response = await request(app)
      .post("/api/ai/chat")
      .send({ message: "Xin chào" });

    expect(response.status).toBe(403);
  });

  it("enforces the shared five-message quota across guest sessions", async () => {
    const responses = [];
    for (let attempt = 1; attempt <= 6; attempt += 1) {
      responses.push(
        await guestRequest({
          message: `Câu hỏi fitness ${attempt}`,
          requestId: `a26e93e8-8d21-4be2-9c6e-2ebf3cc340b${attempt}`,
        }),
      );
    }

    expect(responses.map(({ status }) => status)).toEqual([
      200, 200, 200, 200, 200, 429,
    ]);
    expect(responses[4].text).toContain('"remaining":0');
    expect(responses[5].body).toMatchObject({
      code: "AI_GUEST_RATE_LIMITED",
      meta: { quota: { tier: "guest", limit: 5, remaining: 0 } },
    });
    expect(await ServiceUsageBucket.countDocuments()).toBe(1);
  });

  it("rejects malformed chat before consuming shared quota", async () => {
    const response = await guestRequest({ message: "" });

    expect(response.status).toBe(400);
    expect(await ServiceUsageBucket.countDocuments()).toBe(0);
  });

  it("rejects image input for guest mode", async () => {
    const response = await guestRequest({
      message: "Phân tích ảnh",
      context: {
        image: `data:image/png;base64,${Buffer.from("guest-image").toString("base64")}`,
      },
    });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("AI_GUEST_IMAGE_UNAVAILABLE");
    expect(await ServiceUsageBucket.countDocuments()).toBe(0);
  });

  it("refunds the AI message when the provider stream fails", async () => {
    llmStream.mockImplementationOnce(async function* failedProviderStream() {
      throw new Error("synthetic provider failure");
    });

    const failed = await guestRequest({
      message: "Bạn có thể giúp tôi những gì?",
      requestId: "c26e93e8-8d21-4be2-9c6e-2ebf3cc340b1",
    });
    const bucketAfterFailure = await ServiceUsageBucket.findOne()
      .select("+usageEvents")
      .lean();
    const retried = await guestRequest({
      message: "Bạn có thể giới thiệu thêm khả năng khác không?",
      requestId: "c26e93e8-8d21-4be2-9c6e-2ebf3cc340b2",
    });

    expect(failed.status).toBe(200);
    expect(failed.text).toContain('"type":"error"');
    expect(failed.text).toContain('"remaining":5');
    expect(bucketAfterFailure.usageEvents).toHaveLength(0);
    expect(retried.text).toContain('"remaining":4');
  });

  it("classifies a guest public-person lookup as a policy block without calling web search", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await guestRequest({
      message: "Ronaldo thường tập những bài gì trong phòng gym?",
      requestId: "aa6e93e8-8d21-4be2-9c6e-2ebf3cc340b1",
    });
    const conversation = await ChatConversation.findOne({ userId: null })
      .select("+guestKey")
      .lean();
    const answer = conversation.messages.find(
      (message) => message.role === "assistant" && message.content,
    );

    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(conversation.messages.some((message) =>
      message.toolCalls?.some((call) => call.name === "search_knowledge"),
    )).toBe(false);
    expect(answer.content).toMatch(/chế độ khách.*đăng nhập.*tra cứu có nguồn/i);
    expect(answer.answerTrace).toMatchObject({
      evidenceMode: "web_required",
      webSearchUsed: false,
      webSearchOutcome: "not_called",
    });
  });

  it.each([
    {
      status: 503,
      expected: "Dịch vụ AI đang tạm gián đoạn",
      excluded: "quá nhiều yêu cầu",
    },
    {
      status: 429,
      expected: "nhận quá nhiều yêu cầu từ nhà cung cấp",
      excluded: "tạm gián đoạn",
    },
  ])("classifies provider HTTP $status without leaking diagnostics", async ({
    status,
    expected,
    excluded,
  }) => {
    llmStream.mockImplementationOnce(async function* failedProviderStream() {
      throw Object.assign(new Error("synthetic private provider diagnostic"), {
        code: "GEMINI_HTTP_ERROR",
        status,
      });
    });

    const failed = await guestRequest({
      message: "Bạn có thể giúp tôi những gì?",
      requestId: status === 503
        ? "c26e93e8-8d21-4be2-9c6e-2ebf3cc340c1"
        : "c26e93e8-8d21-4be2-9c6e-2ebf3cc340c2",
    });

    expect(failed.text).toContain(expected);
    expect(failed.text).not.toContain(excluded);
    expect(failed.text).not.toContain("synthetic private provider diagnostic");
  });

  it("retries the same request and conversation after a provider failure without a ghost message or charge", async () => {
    llmStream.mockImplementationOnce(async function* failedProviderStream() {
      throw new Error("synthetic secret provider diagnostic");
    });
    const requestId = "d26e93e8-8d21-4be2-9c6e-2ebf3cc340b1";
    const failed = await guestRequest({
      message: "Bạn có thể giúp tôi những gì?",
      requestId,
    });
    const conversationId = failed.text.match(/"conversationId":"([^"]+)"/)?.[1];
    const guestCookie = readGuestCookie(failed);

    expect(failed.status).toBe(200);
    expect(failed.text).toContain('"type":"error"');
    expect(failed.text).toContain('"retryable":true');
    expect(failed.text).toContain('"remaining":5');
    expect(failed.text).not.toContain('"type":"done"');
    expect(failed.text).not.toContain("synthetic secret provider diagnostic");
    expect(conversationId).toBeTruthy();
    expect(guestCookie).toBeTruthy();

    const retried = await guestRequest(
      { message: "Bạn có thể giúp tôi những gì?", conversationId, requestId },
      guestCookie,
    );
    const conversation = await ChatConversation.findById(conversationId)
      .select("+recentRequestIds")
      .lean();
    const bucket = await ServiceUsageBucket.findOne()
      .select("+usageEvents")
      .lean();

    expect(retried.status).toBe(200);
    expect(retried.text).toContain('"type":"text"');
    expect(retried.text).toContain('"type":"done"');
    expect(retried.text).not.toContain('"duplicate":true');
    expect(retried.text).toContain('"remaining":4');
    expect(llmStream).toHaveBeenCalledTimes(2);
    expect(conversation.messages.map(({ role }) => role)).toEqual(["user", "assistant"]);
    expect(conversation.messageCount).toBe(2);
    expect(rawRequestIdsFromStorage(conversation.recentRequestIds)).toEqual([
      requestId,
    ]);
    expect(bucket.usageEvents).toHaveLength(1);
  });

  it("never marks the SSE error retryable when failed-turn rollback did not complete before the frame", async () => {
    llmStream.mockImplementationOnce(async function* failedProviderStream() {
      throw new Error("synthetic provider failure");
    });
    const rollback = vi.spyOn(ChatConversation, "updateOne")
      .mockRejectedValueOnce(new Error("synthetic rollback failure"));
    try {
      const failed = await guestRequest({
        message: "Bạn có thể giúp tôi những gì?",
        requestId: "d26e93e8-8d21-4be2-9c6e-2ebf3cc340b2",
      });

      expect(failed.status).toBe(200);
      expect(failed.text).toContain('"type":"error"');
      expect(failed.text).toContain('"retryable":false');
      expect(failed.text).not.toContain("synthetic rollback failure");
    } finally {
      rollback.mockRestore();
    }
  });

  it("refunds an empty provider response instead of completing an empty conversation", async () => {
    llmStream.mockImplementationOnce(async function* emptyProviderStream() {});
    const failed = await guestRequest({
      message: "Giúp tôi tập luyện",
      requestId: "e26e93e8-8d21-4be2-9c6e-2ebf3cc340b1",
    });
    const bucket = await ServiceUsageBucket.findOne()
      .select("+usageEvents")
      .lean();

    expect(failed.status).toBe(200);
    expect(failed.text).toContain('"type":"error"');
    expect(failed.text).not.toContain('"type":"done"');
    expect(failed.text).toContain('"remaining":5');
    expect(bucket.usageEvents).toHaveLength(0);
  });

  it("does not persist a provider-only diagnostic filtered from public output", async () => {
    llmStream.mockImplementationOnce(async function* diagnosticResponse() {
      yield { type: "text", content: "⚠️ Lỗi provider diagnostic" };
    });
    const failed = await guestRequest({
      message: "Cách tập squat",
      requestId: "e26e93e8-8d21-4be2-9c6e-2ebf3cc340b2",
    });
    const conversationId = failed.text.match(/"conversationId":"([^"]+)"/)?.[1];
    const conversation = await ChatConversation.findById(conversationId).lean();

    expect(failed.text).toContain('"type":"error"');
    expect(failed.text).not.toContain('"type":"done"');
    expect(failed.text).not.toContain("provider diagnostic");
    expect(conversation.messages).toHaveLength(0);
    expect(conversation.messageCount).toBe(0);
  });

  it("rolls back an orphan protocol fragment and retries in the same conversation", async () => {
    llmStream
      .mockImplementationOnce(async function* malformedProviderResponse() {
        yield { type: "text", content: "}" };
      })
      .mockImplementationOnce(async function* repeatedMalformedProviderResponse() {
        yield { type: "text", content: "{" };
      })
      .mockImplementationOnce(async function* recoveredProviderResponse() {
        yield { type: "text", content: "Phản hồi đã phục hồi." };
      });
    const requestId = "e26e93e8-8d21-4be2-9c6e-2ebf3cc340b3";
    const failed = await guestRequest({ message: "Giúp tôi tập luyện", requestId });
    const conversationId = failed.text.match(/"conversationId":"([^"]+)"/)?.[1];
    const guestCookie = readGuestCookie(failed);
    const afterFailure = await ChatConversation.findById(conversationId).lean();

    expect(failed.text).toContain('"type":"error"');
    expect(failed.text).toContain('"retryable":true');
    expect(failed.text).not.toContain('"type":"done"');
    expect(afterFailure.messages).toHaveLength(0);

    const retried = await guestRequest(
      { message: "Giúp tôi tập luyện", conversationId, requestId },
      guestCookie,
    );
    const afterRetry = await ChatConversation.findById(conversationId).lean();

    expect(retried.text).toContain('"type":"text"');
    expect(retried.text).toContain('"type":"done"');
    expect(afterRetry.messages.map(({ role }) => role)).toEqual([
      "user",
      "assistant",
    ]);
    expect(afterRetry.messages.at(-1)?.content).toBe("Phản hồi đã phục hồi.");
  });

  it("preserves earlier turns when a later request fails and retries with the same key", async () => {
    const firstRequestId = "f26e93e8-8d21-4be2-9c6e-2ebf3cc340b1";
    const retryRequestId = "f26e93e8-8d21-4be2-9c6e-2ebf3cc340b2";
    const first = await guestRequest({ message: "Xin chào", requestId: firstRequestId });
    const conversationId = first.text.match(/"conversationId":"([^"]+)"/)?.[1];
    const guestCookie = readGuestCookie(first);
    const beforeFailure = await ChatConversation.findById(conversationId).lean();
    llmStream.mockImplementationOnce(async function* failedProviderStream() {
      throw new Error("synthetic provider failure");
    });

    const failed = await guestRequest(
      {
        message: "Bạn có thể giúp tôi những gì?",
        conversationId,
        requestId: retryRequestId,
      },
      guestCookie,
    );
    const afterFailure = await ChatConversation.findById(conversationId)
      .select("+recentRequestIds")
      .lean();
    const retried = await guestRequest(
      {
        message: "Bạn có thể giúp tôi những gì?",
        conversationId,
        requestId: retryRequestId,
      },
      guestCookie,
    );
    const afterRetry = await ChatConversation.findById(conversationId)
      .select("+recentRequestIds")
      .lean();

    expect(failed.text).toContain('"type":"error"');
    expect(failed.text).toContain('"remaining":4');
    expect(afterFailure.messages).toHaveLength(2);
    expect(afterFailure.messageCount).toBe(2);
    expect(afterFailure.lastMessagePreview).toBe(beforeFailure.lastMessagePreview);
    expect(rawRequestIdsFromStorage(afterFailure.recentRequestIds)).toEqual([
      firstRequestId,
    ]);
    expect(retried.text).toContain('"type":"text"');
    expect(retried.text).not.toContain('"duplicate":true');
    expect(retried.text).toContain('"remaining":3');
    expect(afterRetry.messages.map(({ role }) => role)).toEqual([
      "user", "assistant", "user", "assistant",
    ]);
    expect(rawRequestIdsFromStorage(afterRetry.recentRequestIds)).toEqual([
      firstRequestId,
      retryRequestId,
    ]);
  });
});
