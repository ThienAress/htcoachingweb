import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
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
import KnowledgeEntry from "../../models/KnowledgeEntry.js";
import {
  chatStream,
  forkConversation,
  getConversations,
} from "../ai.controller.js";
import {
  createEntry,
  mergeVariant,
  updateEntry,
} from "../knowledgeBase.controller.js";

let app;

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.post("/api/ai/chat", protect, chatStream);
  app.get("/api/ai/conversations", protect, getConversations);
  app.post("/api/ai/conversations/:id/fork", protect, forkConversation);
  app.post("/api/knowledge-base", protect, createEntry);
  app.put("/api/knowledge-base/:id", protect, updateEntry);
  app.post("/api/knowledge-base/:id/merge", protect, mergeVariant);
});

afterEach(async () => {
  delete process.env.GEMINI_API_KEY;
  await clearCollections();
});

afterAll(teardownTestDB);

describe("Phase 2 AI conversation integrity", () => {
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
});

describe("Phase 2 Knowledge Base lifecycle", () => {
  it("keeps an entry in draft when embedding generation fails", async () => {
    const { accessToken } = await createTestUser({ role: "admin" });
    const response = await withAuth(
      request(app).post("/api/knowledge-base").send({
        question: "Protein là gì?",
        answer: "Protein hỗ trợ xây dựng và duy trì mô cơ.",
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
