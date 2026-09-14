import crypto from "crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";

import {
  clearCollections,
  createTestApp,
  createTestUser,
  setupTestDB,
  teardownTestDB,
  withAuth,
} from "../../__tests__/setup.js";
import KnowledgeEntry from "../../models/KnowledgeEntry.js";
import ChatConversation from "../../models/ChatConversation.js";
import knowledgeBaseRoutes from "../../routes/knowledgeBase.routes.js";
import {
  clearEmbeddingCacheForTests,
  EMBEDDING_DIMENSION,
  EMBEDDING_VERSION,
} from "../../services/ai/embedding.service.js";

const VECTOR = Array.from(
  { length: EMBEDDING_DIMENSION },
  (_, index) => index / EMBEDDING_DIMENSION,
);

const stubEmbeddingProvider = () => {
  process.env.GEMINI_API_KEY = "synthetic-test-key";
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(
        JSON.stringify({
          embedding: { values: VECTOR },
          usageMetadata: { promptTokenCount: 4, totalTokenCount: 4 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ),
  );
};

const sourceBackedPayload = (overrides = {}) => ({
  question: "Synthetic evidence-backed fitness question?",
  answer: "Synthetic answer used only by an isolated integration test.",
  category: "health",
  evidenceLevel: "source_backed",
  freshnessClass: "periodic",
  reviewDueAt: "2099-01-01T00:00:00.000Z",
  sources: [
    {
      type: "research",
      title: "Synthetic primary source",
      publisher: "Synthetic Journal",
      url: "https://example.org/research/synthetic-evidence",
      publishedAt: "2026-01-01T00:00:00.000Z",
      retrievedAt: "2026-09-12T00:00:00.000Z",
      evidenceTier: "primary",
    },
  ],
  skipDuplicateCheck: true,
  ...overrides,
});

const reviewedSource = (overrides = {}) => ({
  type: "research",
  title: "Synthetic reviewed source",
  publisher: "Synthetic Journal",
  url: "https://example.org/research/reviewed-source",
  publishedAt: new Date("2026-01-01T00:00:00.000Z"),
  retrievedAt: new Date("2026-09-12T00:00:00.000Z"),
  evidenceTier: "primary",
  ...overrides,
});

const createReviewedEntry = (userId, overrides = {}) => {
  const question = overrides.question || "Synthetic reviewed squat question?";
  return KnowledgeEntry.create({
    question,
    normalizedQuestion: question.toLocaleLowerCase("vi"),
    answer: "Synthetic reviewed squat answer.",
    category: "training",
    tags: ["squat"],
    embedding: VECTOR,
    variants: [
      {
        text: "How do I squat safely?",
        embedding: VECTOR,
      },
    ],
    variantCount: 1,
    embeddingStatus: "ready",
    embeddingVersion: EMBEDDING_VERSION,
    embeddingUpdatedAt: new Date("2026-09-12T01:00:00.000Z"),
    sources: [reviewedSource()],
    evidenceLevel: "source_backed",
    freshnessClass: "stable",
    reviewDueAt: null,
    reviewStatus: "reviewed",
    reviewedBy: userId,
    reviewedAt: new Date("2026-09-12T02:00:00.000Z"),
    revision: 3,
    status: "published",
    createdBy: userId,
    ...overrides,
  });
};

const sourceBinding = (conversation, questionIndex, answerIndex) => ({
  questionMessageId: conversation.messages[questionIndex]._id.toString(),
  answerMessageId: conversation.messages[answerIndex]._id.toString(),
  questionHash: crypto
    .createHash("sha256")
    .update(conversation.messages[questionIndex].content, "utf8")
    .digest("hex"),
  answerHash: crypto
    .createHash("sha256")
    .update(conversation.messages[answerIndex].content, "utf8")
    .digest("hex"),
});

let app;

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/knowledge-base", knowledgeBaseRoutes);
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env.GEMINI_API_KEY;
  clearEmbeddingCacheForTests();
  await clearCollections();
});

afterAll(teardownTestDB);

describe("Knowledge Base evidence publication routes", () => {
  it("blocks a private-health Search Test query before the embedding provider", async () => {
    const { accessToken } = await createTestUser({ role: "admin" });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await withAuth(
      request(app)
        .get("/api/knowledge-base/search")
        .query({ q: "I have narcolepsy, what changed recently?" }),
      accessToken,
    );

    expect({
      status: response.status,
      code: response.body.code,
      providerCalls: fetchMock.mock.calls.length,
    }).toEqual({
      status: 400,
      code: "KNOWLEDGE_QUERY_SENSITIVE",
      providerCalls: 0,
    });
  });

  it("rejects a private-health manual entry before creating an embedding", async () => {
    const { accessToken } = await createTestUser({ role: "admin" });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await withAuth(
      request(app).post("/api/knowledge-base").send({
        question: "I am on methotrexate, latest research?",
        answer: "Synthetic answer that must never enter the global KB.",
        status: "draft",
      }),
      accessToken,
    );

    expect({
      status: response.status,
      code: response.body.code,
      providerCalls: fetchMock.mock.calls.length,
      storedEntries: await KnowledgeEntry.countDocuments(),
    }).toEqual({
      status: 400,
      code: "KNOWLEDGE_QUERY_SENSITIVE",
      providerCalls: 0,
      storedEntries: 0,
    });
  });

  it("rejects private health hidden deep in a manual answer before embedding", async () => {
    const { accessToken } = await createTestUser({ role: "admin" });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await withAuth(
      request(app).post("/api/knowledge-base").send({
        question: "How should a beginner train safely?",
        answer: `${"General training guidance. ".repeat(30)}Client zoraqx quux has lupus.`,
        status: "draft",
      }),
      accessToken,
    );

    expect({
      status: response.status,
      code: response.body.code,
      providerCalls: fetchMock.mock.calls.length,
      storedEntries: await KnowledgeEntry.countDocuments(),
    }).toEqual({
      status: 400,
      code: "KNOWLEDGE_QUERY_SENSITIVE",
      providerCalls: 0,
      storedEntries: 0,
    });
  });

  it("validates the merged entry when private health is added through tags", async () => {
    const { user, accessToken } = await createTestUser({ role: "admin" });
    const entry = await createReviewedEntry(user._id, { status: "draft" });

    const response = await withAuth(
      request(app)
        .put(`/api/knowledge-base/${entry._id}`)
        .send({ tags: ["client zoraqx quux has lupus"] }),
      accessToken,
    );

    expect({
      status: response.status,
      code: response.body.code,
      storedTags: (await KnowledgeEntry.findById(entry._id).lean()).tags,
    }).toEqual({
      status: 400,
      code: "KNOWLEDGE_QUERY_SENSITIVE",
      storedTags: ["squat"],
    });
  });

  it("blocks regeneration when legacy answer metadata contains private health", async () => {
    const { user, accessToken } = await createTestUser({ role: "admin" });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const entry = await createReviewedEntry(user._id, {
      status: "draft",
      answer: "Client zoraqx quux has lupus.",
    });

    const response = await withAuth(
      request(app).post(`/api/knowledge-base/${entry._id}/regenerate-embedding`),
      accessToken,
    );

    expect({
      status: response.status,
      code: response.body.code,
      providerCalls: fetchMock.mock.calls.length,
    }).toEqual({
      status: 400,
      code: "KNOWLEDGE_QUERY_SENSITIVE",
      providerCalls: 0,
    });
  });

  it("validates legacy source metadata before merging a new variant", async () => {
    const { user, accessToken } = await createTestUser({ role: "admin" });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const entry = await createReviewedEntry(user._id, {
      status: "draft",
      sources: [reviewedSource({ title: "Client zoraqx quux has lupus" })],
    });

    const response = await withAuth(
      request(app)
        .post(`/api/knowledge-base/${entry._id}/merge`)
        .send({ question: "How should I progress a squat safely?" }),
      accessToken,
    );

    expect({
      status: response.status,
      code: response.body.code,
      providerCalls: fetchMock.mock.calls.length,
    }).toEqual({
      status: 400,
      code: "KNOWLEDGE_QUERY_SENSITIVE",
      providerCalls: 0,
    });
  });

  it("keeps a source-less entry as legacy draft and rejects its publish transition", async () => {
    const { accessToken } = await createTestUser({ role: "admin" });
    const created = await withAuth(
      request(app).post("/api/knowledge-base").send({
        question: "Synthetic draft without evidence?",
        answer: "This draft intentionally has no evidence.",
      }),
      accessToken,
    );
    const publish = await withAuth(
      request(app)
        .put(`/api/knowledge-base/${created.body.data._id}`)
        .send({ status: "published" }),
      accessToken,
    );

    expect({
      createStatus: created.status,
      entryStatus: created.body.data.status,
      evidenceLevel: created.body.data.evidenceLevel,
      reviewStatus: created.body.data.reviewStatus,
      publishStatus: publish.status,
      publishCode: publish.body.code,
    }).toEqual({
      createStatus: 201,
      entryStatus: "draft",
      evidenceLevel: "legacy_unverified",
      reviewStatus: "needs_review",
      publishStatus: 409,
      publishCode: "KNOWLEDGE_EVIDENCE_UNVERIFIED",
    });
  });

  it("publishes source-backed evidence with reviewer metadata owned by the server", async () => {
    stubEmbeddingProvider();
    const { user, accessToken } = await createTestUser({ role: "admin" });
    const response = await withAuth(
      request(app)
        .post("/api/knowledge-base")
        .send(sourceBackedPayload({ status: "published" })),
      accessToken,
    );

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      status: "published",
      evidenceLevel: "source_backed",
      reviewStatus: "reviewed",
      freshnessClass: "periodic",
      revision: 1,
      reviewedBy: user._id.toString(),
    });
    expect(response.body.data.reviewedAt).toBeTruthy();
  });

  it("rejects publishing a ready entry whose embedding profile is stale", async () => {
    const { user, accessToken } = await createTestUser({ role: "admin" });
    const entry = await createReviewedEntry(user._id, {
      status: "draft",
      reviewStatus: "needs_review",
      reviewedBy: null,
      reviewedAt: null,
      embeddingVersion: "stale-embedding-profile-v1",
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await withAuth(
      request(app)
        .put(`/api/knowledge-base/${entry._id}`)
        .send({ status: "published" }),
      accessToken,
    );
    const stored = await KnowledgeEntry.findById(entry._id).lean();

    expect({
      status: response.status,
      code: response.body.code,
      storedStatus: stored.status,
      providerCalls: fetchMock.mock.calls.length,
    }).toEqual({
      status: 409,
      code: "KNOWLEDGE_EMBEDDING_VERSION_MISMATCH",
      storedStatus: "draft",
      providerCalls: 0,
    });
  });

  it("enforces the active embedding version in the model publication invariant", async () => {
    const { user } = await createTestUser({ role: "admin" });

    await expect(
      createReviewedEntry(user._id, {
        question: "Synthetic stale model profile question?",
        embeddingVersion: "stale-embedding-profile-v1",
      }),
    ).rejects.toMatchObject({ name: "ValidationError" });
  });

  it("keeps a full published no-op update free of embedding cost and lifecycle churn", async () => {
    const { user, accessToken } = await createTestUser({ role: "admin" });
    const entry = await createReviewedEntry(user._id);
    stubEmbeddingProvider();
    const fetchMock = globalThis.fetch;

    const response = await withAuth(
      request(app).put(`/api/knowledge-base/${entry._id}`).send({
        question: entry.question,
        answer: entry.answer,
        category: entry.category,
        tags: [...entry.tags],
        variants: entry.variants.map((variant) => variant.text),
        status: "published",
        sources: [reviewedSource()],
        evidenceLevel: entry.evidenceLevel,
        freshnessClass: entry.freshnessClass,
        reviewDueAt: null,
      }),
      accessToken,
    );
    const stored = await KnowledgeEntry.findById(entry._id).lean();

    expect({
      status: response.status,
      providerCalls: fetchMock.mock.calls.length,
      storedStatus: stored.status,
      revision: stored.revision,
      reviewStatus: stored.reviewStatus,
      reviewedBy: stored.reviewedBy?.toString(),
      reviewedAt: stored.reviewedAt?.toISOString(),
      embeddingStatus: stored.embeddingStatus,
    }).toEqual({
      status: 200,
      providerCalls: 0,
      storedStatus: "published",
      revision: 3,
      reviewStatus: "reviewed",
      reviewedBy: user._id.toString(),
      reviewedAt: "2026-09-12T02:00:00.000Z",
      embeddingStatus: "ready",
    });
  });

  it("reopens review for an evidence-only change without regenerating embeddings", async () => {
    const { user, accessToken } = await createTestUser({ role: "admin" });
    const entry = await createReviewedEntry(user._id);
    stubEmbeddingProvider();
    const fetchMock = globalThis.fetch;

    const response = await withAuth(
      request(app).put(`/api/knowledge-base/${entry._id}`).send({
        question: entry.question,
        answer: entry.answer,
        category: entry.category,
        tags: [...entry.tags],
        variants: entry.variants.map((variant) => variant.text),
        status: "published",
        sources: [
          reviewedSource({ title: "Synthetic reviewed source — corrected" }),
        ],
        evidenceLevel: entry.evidenceLevel,
        freshnessClass: entry.freshnessClass,
        reviewDueAt: null,
      }),
      accessToken,
    );
    const stored = await KnowledgeEntry.findById(entry._id).lean();

    expect({
      status: response.status,
      providerCalls: fetchMock.mock.calls.length,
      storedStatus: stored.status,
      revision: stored.revision,
      reviewStatus: stored.reviewStatus,
      reviewedBy: stored.reviewedBy,
      reviewedAt: stored.reviewedAt,
      embeddingStatus: stored.embeddingStatus,
      sourceTitle: stored.sources[0].title,
    }).toEqual({
      status: 200,
      providerCalls: 0,
      storedStatus: "draft",
      revision: 4,
      reviewStatus: "needs_review",
      reviewedBy: null,
      reviewedAt: null,
      embeddingStatus: "ready",
      sourceTitle: "Synthetic reviewed source — corrected",
    });
  });

  it("maps stored legacy documents to unverified metadata without rewriting them", async () => {
    const { user, accessToken } = await createTestUser({ role: "admin" });
    const inserted = await KnowledgeEntry.collection.insertOne({
      question: "Synthetic legacy question?",
      normalizedQuestion: "synthetic legacy question?",
      answer: "Synthetic legacy answer.",
      category: "training",
      tags: [],
      embedding: VECTOR,
      variants: [],
      variantCount: 0,
      embeddingStatus: "ready",
      status: "published",
      createdBy: user._id,
      usageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await withAuth(
      request(app).get("/api/knowledge-base?search=Synthetic%20legacy"),
      accessToken,
    );
    const stored = await KnowledgeEntry.collection.findOne({ _id: inserted.insertedId });

    expect(response.body.data[0]).toMatchObject({
      evidenceLevel: "legacy_unverified",
      reviewStatus: "needs_review",
      freshnessClass: "stable",
      revision: 1,
      sources: [],
    });
    expect(stored.evidenceLevel).toBeUndefined();
  });

  it("regenerates a published legacy vector without demoting or rewriting its trust metadata", async () => {
    stubEmbeddingProvider();
    const { user, accessToken } = await createTestUser({ role: "admin" });
    const inserted = await KnowledgeEntry.collection.insertOne({
      question: "Synthetic legacy regeneration question?",
      normalizedQuestion: "synthetic legacy regeneration question?",
      answer: "Synthetic legacy regeneration answer.",
      category: "training",
      tags: [],
      embedding: VECTOR,
      variants: [],
      variantCount: 0,
      embeddingStatus: "ready",
      status: "published",
      createdBy: user._id,
      usageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await withAuth(
      request(app).post(
        `/api/knowledge-base/${inserted.insertedId}/regenerate-embedding`,
      ),
      accessToken,
    );
    const stored = await KnowledgeEntry.collection.findOne({
      _id: inserted.insertedId,
    });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      status: "published",
      evidenceLevel: "legacy_unverified",
      reviewStatus: "needs_review",
    });
    expect(stored.status).toBe("published");
    expect(stored.embeddingVersion).toBeTruthy();
    expect(stored.evidenceLevel).toBeUndefined();
  });

  it("enforces the existing admin and CSRF boundary on evidence mutation", async () => {
    const { accessToken: userToken } = await createTestUser({ role: "user" });
    const { accessToken: adminToken } = await createTestUser({
      role: "admin",
      email: "synthetic-admin-2@example.invalid",
    });
    const deniedRole = await withAuth(
      request(app).post("/api/knowledge-base").send(sourceBackedPayload()),
      userToken,
    );
    const deniedCsrf = await request(app)
      .post("/api/knowledge-base")
      .set("Cookie", [`accessToken=${adminToken}`])
      .send(sourceBackedPayload());

    expect([deniedRole.status, deniedCsrf.status]).toEqual([403, 403]);
  });

  it("persists immutable message provenance when publishing from a conversation", async () => {
    stubEmbeddingProvider();
    const { user, accessToken } = await createTestUser({ role: "admin" });
    const conversation = await ChatConversation.create({
      userId: user._id,
      title: "Synthetic provenance source",
      messages: [
        { role: "user", content: "Romanian deadlift tác động nhóm cơ nào?" },
        {
          role: "assistant",
          content: "Bài tập chủ yếu tải chuỗi cơ sau.",
          feedback: "up",
        },
      ],
      messageCount: 2,
    });

    const response = await withAuth(
      request(app).post("/api/knowledge-base/from-conversation").send({
        conversationId: conversation._id.toString(),
        questionIndex: 0,
        answerIndex: 1,
        ...sourceBinding(conversation, 0, 1),
        category: "training",
        status: "published",
        evidenceLevel: "source_backed",
        freshnessClass: "stable",
        sources: [
          {
            type: "professional",
            title: "Synthetic technique reference",
            publisher: "Synthetic Coaching Institute",
            url: "https://example.org/training/romanian-deadlift",
            evidenceTier: "professional",
          },
        ],
        skipDuplicateCheck: true,
      }),
      accessToken,
    );
    const stored = await KnowledgeEntry.findById(response.body.data._id).lean();

    expect(response.status).toBe(201);
    expect(stored).toMatchObject({
      status: "published",
      evidenceLevel: "source_backed",
      reviewStatus: "reviewed",
      freshnessClass: "stable",
    });
    expect(stored.source).toMatchObject({
      conversationId: conversation._id,
      messageIndex: 0,
      questionIndex: 0,
      answerIndex: 1,
      questionMessageId: conversation.messages[0]._id,
      answerMessageId: conversation.messages[1]._id,
    });
    expect(stored.source.questionHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.source.answerHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.source.capturedAt).toBeTruthy();
  });

  it("rejects mismatched conversation message indices as provenance", async () => {
    const { user, accessToken } = await createTestUser({ role: "admin" });
    const conversation = await ChatConversation.create({
      userId: user._id,
      title: "Synthetic mismatched provenance",
      messages: [
        { role: "user", content: "Câu hỏi thứ nhất?" },
        { role: "assistant", content: "Câu trả lời thứ nhất." },
        { role: "user", content: "Câu hỏi thứ hai?" },
        { role: "assistant", content: "Câu trả lời thứ hai." },
      ],
      messageCount: 4,
    });

    const response = await withAuth(
      request(app).post("/api/knowledge-base/from-conversation").send({
        conversationId: conversation._id.toString(),
        questionIndex: 0,
        answerIndex: 3,
        ...sourceBinding(conversation, 0, 3),
      }),
      accessToken,
    );

    expect(response.status).toBe(400);
  });

  it("rejects stale message IDs instead of binding provenance by index alone", async () => {
    const { user, accessToken } = await createTestUser({ role: "admin" });
    const conversation = await ChatConversation.create({
      userId: user._id,
      title: "Synthetic stale provenance",
      messages: [
        { role: "user", content: "Câu hỏi gốc?" },
        { role: "assistant", content: "Câu trả lời gốc." },
        { role: "user", content: "Câu hỏi khác?" },
        { role: "assistant", content: "Câu trả lời khác." },
      ],
      messageCount: 4,
    });

    const response = await withAuth(
      request(app).post("/api/knowledge-base/from-conversation").send({
        conversationId: conversation._id.toString(),
        questionIndex: 0,
        answerIndex: 1,
        ...sourceBinding(conversation, 2, 3),
      }),
      accessToken,
    );

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("KNOWLEDGE_CONVERSATION_SOURCE_STALE");
  });

  it("rejects a conversation source that omits the immutable binding", async () => {
    const { user, accessToken } = await createTestUser({ role: "admin" });
    const conversation = await ChatConversation.create({
      userId: user._id,
      title: "Synthetic missing provenance binding",
      messages: [
        { role: "user", content: "Cách giữ lưng khi deadlift?" },
        { role: "assistant", content: "Giữ cột sống trung lập." },
      ],
      messageCount: 2,
    });

    const response = await withAuth(
      request(app).post("/api/knowledge-base/from-conversation").send({
        conversationId: conversation._id.toString(),
        questionIndex: 0,
        answerIndex: 1,
      }),
      accessToken,
    );

    expect(response.status).toBe(400);
  });

  it("rejects stale hashes even when conversation message IDs still match", async () => {
    const { user, accessToken } = await createTestUser({ role: "admin" });
    const conversation = await ChatConversation.create({
      userId: user._id,
      title: "Synthetic stale provenance hashes",
      messages: [
        { role: "user", content: "Cách hít thở khi squat?" },
        { role: "assistant", content: "Hít vào trước khi hạ người." },
      ],
      messageCount: 2,
    });
    const binding = sourceBinding(conversation, 0, 1);

    const response = await withAuth(
      request(app).post("/api/knowledge-base/from-conversation").send({
        conversationId: conversation._id.toString(),
        questionIndex: 0,
        answerIndex: 1,
        ...binding,
        questionHash: "0".repeat(64),
        answerHash: "f".repeat(64),
      }),
      accessToken,
    );

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("KNOWLEDGE_CONVERSATION_SOURCE_STALE");
  });

  it("rejects a sensitive personal-health conversation before embedding", async () => {
    const { user, accessToken } = await createTestUser({ role: "admin" });
    const conversation = await ChatConversation.create({
      userId: user._id,
      title: "Synthetic sensitive provenance",
      messages: [
        { role: "user", content: "Khách hàng Nguyễn Văn A bị HIV, nên tập gì?" },
        {
          role: "assistant",
          content: "Đây là câu trả lời riêng cho hồ sơ sức khỏe khách hàng.",
        },
      ],
      messageCount: 2,
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await withAuth(
      request(app).post("/api/knowledge-base/from-conversation").send({
        conversationId: conversation._id.toString(),
        questionIndex: 0,
        answerIndex: 1,
        ...sourceBinding(conversation, 0, 1),
      }),
      accessToken,
    );

    expect(response.status).toBe(409);
    expect(response.body.code).toBe(
      "KNOWLEDGE_CONVERSATION_SOURCE_INELIGIBLE",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("redacts direct identifiers again when the client echoes raw conversation text", async () => {
    stubEmbeddingProvider();
    const { user, accessToken } = await createTestUser({ role: "admin" });
    const rawQuestion =
      "Gửi hướng dẫn squat cho lan@example.com hoặc số 0912 345 678 nhé";
    const rawAnswer =
      "Giữ cột sống trung lập; không cần gửi tới lan@example.com.";
    const conversation = await ChatConversation.create({
      userId: user._id,
      title: "Synthetic identifier source",
      messages: [
        { role: "user", content: rawQuestion },
        { role: "assistant", content: rawAnswer },
      ],
      messageCount: 2,
    });

    const response = await withAuth(
      request(app).post("/api/knowledge-base/from-conversation").send({
        conversationId: conversation._id.toString(),
        questionIndex: 0,
        answerIndex: 1,
        ...sourceBinding(conversation, 0, 1),
        question: rawQuestion,
        answer: rawAnswer,
        category: "training",
        status: "draft",
      }),
      accessToken,
    );
    const stored = await KnowledgeEntry.findById(response.body.data?._id).lean();
    const serialized = JSON.stringify({
      question: stored?.question,
      answer: stored?.answer,
    });

    expect(response.status).toBe(201);
    expect(serialized).not.toMatch(/lan@example\.com|0912\s*345\s*678/i);
    expect(serialized).toContain("[đã ẩn");
  });

  it("rejects a sensitive override even when the source conversation is safe", async () => {
    const { user, accessToken } = await createTestUser({ role: "admin" });
    const conversation = await ChatConversation.create({
      userId: user._id,
      title: "Synthetic safe source",
      messages: [
        { role: "user", content: "Cách squat đúng kỹ thuật?" },
        { role: "assistant", content: "Giữ cột sống trung lập." },
      ],
      messageCount: 2,
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await withAuth(
      request(app).post("/api/knowledge-base/from-conversation").send({
        conversationId: conversation._id.toString(),
        questionIndex: 0,
        answerIndex: 1,
        ...sourceBinding(conversation, 0, 1),
        question: "Client John Doe has HIV and needs a workout plan",
        answer: "Use this private patient profile as global advice.",
        category: "health",
        status: "draft",
      }),
      accessToken,
    );

    expect(response.status).toBe(409);
    expect(response.body.code).toBe(
      "KNOWLEDGE_CONVERSATION_SOURCE_INELIGIBLE",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("demotes and reopens review when a published entry gains a variant", async () => {
    stubEmbeddingProvider();
    const { user, accessToken } = await createTestUser({ role: "admin" });
    const created = await withAuth(
      request(app).post("/api/knowledge-base").send(
        sourceBackedPayload({
          question: "Synthetic published variant source?",
          status: "published",
        }),
      ),
      accessToken,
    );

    const response = await withAuth(
      request(app).post(`/api/knowledge-base/${created.body.data._id}/merge`).send({
        question: "Synthetic alternate variant wording?",
      }),
      accessToken,
    );
    const stored = await KnowledgeEntry.findById(created.body.data._id)
      .select("+variants")
      .lean();

    expect(response.status).toBe(200);
    expect(stored).toMatchObject({
      status: "draft",
      reviewStatus: "needs_review",
      reviewedBy: null,
      reviewedAt: null,
      revision: 2,
      embeddingVersion: EMBEDDING_VERSION,
      variantCount: 1,
    });
  });

  it("demotes and reopens review when a published variant is deleted", async () => {
    stubEmbeddingProvider();
    const { user, accessToken } = await createTestUser({ role: "admin" });
    const created = await withAuth(
      request(app).post("/api/knowledge-base").send(
        sourceBackedPayload({
          question: "Synthetic published deletion source?",
          variants: ["Synthetic removable variant wording?"],
          status: "published",
        }),
      ),
      accessToken,
    );
    const before = await KnowledgeEntry.findById(created.body.data._id)
      .select("+variants")
      .lean();

    const response = await withAuth(
      request(app).delete(
        `/api/knowledge-base/${created.body.data._id}/variants/${before.variants[0]._id}`,
      ),
      accessToken,
    );
    const stored = await KnowledgeEntry.findById(created.body.data._id)
      .select("+variants")
      .lean();

    expect(response.status).toBe(200);
    expect(stored).toMatchObject({
      status: "draft",
      reviewStatus: "needs_review",
      reviewedBy: null,
      reviewedAt: null,
      revision: 2,
      embeddingVersion: EMBEDDING_VERSION,
      variantCount: 0,
    });
  });

  it("rejects variant mutation on a stale embedding profile", async () => {
    const { user, accessToken } = await createTestUser({ role: "admin" });
    const entry = await KnowledgeEntry.create({
      question: "Synthetic stale embedding entry?",
      answer: "Synthetic stale answer.",
      category: "training",
      embedding: VECTOR,
      embeddingStatus: "ready",
      embeddingVersion: "legacy-profile-v1",
      createdBy: user._id,
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await withAuth(
      request(app).post(`/api/knowledge-base/${entry._id}/merge`).send({
        question: "Synthetic stale profile variant?",
      }),
      accessToken,
    );

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("KNOWLEDGE_EMBEDDING_VERSION_MISMATCH");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("Knowledge Base privacy-safe feedback review", () => {
  it("returns only the redacted pending-downvote DTO requested by the admin queue", async () => {
    const { user, accessToken } = await createTestUser({ role: "admin" });
    const conversation = await ChatConversation.create({
      userId: user._id,
      title: "Synthetic feedback review",
      messages: [
        {
          role: "user",
          content: "Cách squat đúng cho lan@example.com?",
        },
        {
          role: "assistant",
          content: "Giữ cột sống trung lập, đừng gửi tới số 0912 345 678.",
          feedback: "down",
          feedbackReview: { status: "pending" },
        },
        { role: "user", content: "UNRELATED_PRIVATE_QUESTION" },
        {
          role: "assistant",
          content: "UNRELATED_PRIVATE_ANSWER",
          feedback: "up",
          feedbackReview: { status: "none" },
        },
      ],
      messageCount: 4,
    });

    const list = await withAuth(
      request(app).get("/api/knowledge-base/conversations?feedbackReviewStatus=pending"),
      accessToken,
    );
    const detail = await withAuth(
      request(app).get(
        `/api/knowledge-base/conversations/${conversation._id}?feedback=down&feedbackReviewStatus=pending`,
      ),
      accessToken,
    );

    expect(list.body.data).toEqual([
      {
        _id: conversation._id.toString(),
        title: "Synthetic feedback review",
        updatedAt: expect.any(String),
        messageCount: 4,
        pendingFeedbackCount: 1,
      },
    ]);
    expect(detail.body.data).toEqual({
      _id: conversation._id.toString(),
      title: "Synthetic feedback review",
      qaPairs: [
        {
          question: "Cách squat đúng cho [đã ẩn email]?",
          answer:
            "Giữ cột sống trung lập, đừng gửi tới số [đã ẩn số điện thoại].",
          answerMessageId: conversation.messages[1]._id.toString(),
          answerFeedback: "down",
          feedbackReview: { status: "pending" },
          contentVisibility: "redacted",
        },
      ],
    });
  });

  it("keeps manual conversation mining privacy-safe with immutable provenance", async () => {
    const { user, accessToken } = await createTestUser({ role: "admin" });
    const conversation = await ChatConversation.create({
      userId: user._id,
      title: "Synthetic manual mining",
      messages: [
        {
          role: "user",
          content: "Gửi cách squat đúng cho lan@example.com nhé",
        },
        {
          role: "assistant",
          content: "Giữ cột sống trung lập và kiểm soát biên độ.",
        },
        {
          role: "user",
          content: "Học viên Lan đang dùng Ozempic, nên tập cardio thế nào?",
        },
        {
          role: "assistant",
          content: "Đây là hồ sơ sức khỏe riêng tư không được trả qua API admin.",
        },
        { role: "user", content: "Deadlift có tác dụng gì?" },
        {
          role: "assistant",
          content: "Một câu trả lời không nên đưa vào Knowledge Base.",
          feedback: "down",
          feedbackReview: { status: "pending" },
        },
      ],
      messageCount: 6,
    });

    const detail = await withAuth(
      request(app).get(`/api/knowledge-base/conversations/${conversation._id}`),
      accessToken,
    );
    const binding = sourceBinding(conversation, 0, 1);

    expect(detail.body.data.qaPairs).toEqual([
      {
        question: "Gửi cách squat đúng cho [đã ẩn email] nhé",
        answer: "Giữ cột sống trung lập và kiểm soát biên độ.",
        questionIndex: 0,
        answerIndex: 1,
        questionMessageId: binding.questionMessageId,
        answerMessageId: binding.answerMessageId,
        questionHash: binding.questionHash,
        answerHash: binding.answerHash,
        answerFeedback: null,
        feedbackReview: { status: "none" },
        contentVisibility: "redacted",
      },
    ]);
  });

  it("hides sensitive content but keeps a pending downvote reviewable", async () => {
    const { user, accessToken } = await createTestUser({ role: "admin" });
    const conversation = await ChatConversation.create({
      userId: user._id,
      title: "Hồ sơ của học viên Lan",
      messages: [
        {
          role: "user",
          content: "Học viên Lan đang dùng Ozempic, nên tập cardio thế nào?",
        },
        {
          role: "assistant",
          content: "Lan nên hỏi bác sĩ về hồ sơ điều trị riêng.",
          feedback: "down",
          feedbackReview: { status: "pending" },
        },
      ],
      messageCount: 2,
    });

    const detail = await withAuth(
      request(app).get(
        `/api/knowledge-base/conversations/${conversation._id}?feedbackReviewStatus=pending`,
      ),
      accessToken,
    );

    expect(detail.body.data).toEqual({
      _id: conversation._id.toString(),
      title: "Cuộc trò chuyện",
      qaPairs: [
        {
          question: null,
          answer: null,
          answerMessageId: conversation.messages[1]._id.toString(),
          answerFeedback: "down",
          feedbackReview: { status: "pending" },
          contentVisibility: "hidden_sensitive",
        },
      ],
    });
  });

  it("keeps conversation reads admin-only without requiring CSRF", async () => {
    const { accessToken: userToken } = await createTestUser({ role: "user" });
    const { user: admin, accessToken: adminToken } = await createTestUser({
      role: "admin",
      email: "feedback-admin@example.invalid",
    });
    const conversation = await ChatConversation.create({
      userId: admin._id,
      title: "Synthetic read boundary",
      messages: [
        { role: "user", content: "Cách squat đúng?" },
        { role: "assistant", content: "Giữ cột sống trung lập." },
      ],
      messageCount: 2,
    });

    const deniedRole = await withAuth(
      request(app).get(`/api/knowledge-base/conversations/${conversation._id}`),
      userToken,
    );
    const adminReadWithoutCsrf = await request(app)
      .get(`/api/knowledge-base/conversations/${conversation._id}`)
      .set("Cookie", [`accessToken=${adminToken}`]);

    expect([deniedRole.status, adminReadWithoutCsrf.status]).toEqual([403, 200]);
  });

  it("treats a legacy downvote without review metadata as pending", async () => {
    const { user, accessToken } = await createTestUser({ role: "admin" });
    const conversation = await ChatConversation.create({
      userId: user._id,
      title: "Synthetic legacy pending feedback",
      messages: [
        { role: "user", content: "Cách warm-up trước squat?" },
        {
          role: "assistant",
          content: "Synthetic legacy answer.",
          feedback: "down",
          feedbackReview: null,
        },
      ],
      messageCount: 2,
    });

    const list = await withAuth(
      request(app).get("/api/knowledge-base/conversations?feedbackReviewStatus=pending"),
      accessToken,
    );
    const detail = await withAuth(
      request(app).get(
        `/api/knowledge-base/conversations/${conversation._id}?feedbackReviewStatus=pending`,
      ),
      accessToken,
    );
    const reviewed = await withAuth(
      request(app)
        .post(
          `/api/knowledge-base/feedback/${conversation._id}/${conversation.messages[1]._id}/review`,
        )
        .send({ status: "resolved" }),
      accessToken,
    );

    expect(list.status).toBe(200);
    expect(list.body.data).toEqual([
      expect.objectContaining({
        _id: conversation._id.toString(),
        pendingFeedbackCount: 1,
      }),
    ]);
    expect(detail.body.data.qaPairs[0].feedbackReview).toMatchObject({
      status: "pending",
    });
    expect(reviewed.status).toBe(200);
    expect(reviewed.body.data.feedbackReview).toMatchObject({
      status: "resolved",
      reviewedBy: user._id.toString(),
    });
  });

  it("keeps eligible AI suggestions privacy-safe and preserves message provenance", async () => {
    const { user, accessToken } = await createTestUser({ role: "admin" });
    const conversation = await ChatConversation.create({
      userId: user._id,
      title: "Lan bị đau đầu gối · lan@example.com",
      messages: [
        {
          role: "user",
          content: "Gửi cách squat đúng cho lan@example.com nhé",
        },
        {
          role: "assistant",
          content: "Giữ cột sống trung lập và kiểm soát biên độ.",
        },
        {
          role: "user",
          content: "Tôi đau đầu gối sau phẫu thuật và đang uống thuốc, nên tập gì?",
        },
        {
          role: "assistant",
          content: "Bạn nên trao đổi với bác sĩ điều trị trước khi tập.",
        },
        { role: "user", content: "Deadlift có tác dụng gì?" },
        {
          role: "assistant",
          content: "Một câu trả lời đã bị đánh giá không hữu ích.",
          feedback: "down",
          feedbackReview: { status: "pending" },
        },
      ],
      messageCount: 6,
    });
    process.env.GEMINI_API_KEY = "synthetic-test-key";
    let providerBody;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, options) => {
        providerBody = JSON.parse(options.body);
        return new Response(
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
                          category: "training",
                          reason: "Ứng viên có thể kiểm chứng",
                        },
                      ]),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }),
    );

    const response = await withAuth(
      request(app).post("/api/knowledge-base/ai-suggest").send({ days: 7 }),
      accessToken,
    );
    const serializedProviderBody = JSON.stringify(providerBody);
    const suggestion = response.body.data[0];

    expect(response.status).toBe(200);
    expect(serializedProviderBody).not.toContain("lan@example.com");
    expect(serializedProviderBody).not.toContain("đau đầu gối");
    expect(serializedProviderBody).not.toContain("đánh giá không hữu ích");
    expect(suggestion.convTitle).toBe("Cuộc trò chuyện");
    expect(JSON.stringify(suggestion)).not.toContain("lan@example.com");
    expect(JSON.stringify(suggestion)).not.toContain("đau đầu gối");
    expect(suggestion.source).toMatchObject({
      conversationId: conversation._id.toString(),
      questionIndex: 0,
      answerIndex: 1,
      questionMessageId: conversation.messages[0]._id.toString(),
      answerMessageId: conversation.messages[1]._id.toString(),
    });
    expect(suggestion.source.questionHash).toMatch(/^[a-f0-9]{64}$/);
    expect(suggestion.source.answerHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("does not offer traced general answers as fitness Knowledge Base suggestions", async () => {
    const { user, accessToken } = await createTestUser({ role: "admin" });
    await ChatConversation.create({
      userId: user._id,
      title: "Synthetic general conversation",
      messages: [
        { role: "user", content: "Lisa là ai trong nhóm BLACKPINK?" },
        {
          role: "assistant",
          content: "Lisa là một thành viên của nhóm BLACKPINK.",
          answerTrace: {
            routeDomain: "general",
            evidenceMode: "model_prior",
            kbEntryIds: [],
            webSearchUsed: false,
            model: "synthetic-model",
            promptVersion: "synthetic-v1",
          },
        },
      ],
      messageCount: 2,
    });
    process.env.GEMINI_API_KEY = "synthetic-test-key";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await withAuth(
      request(app).post("/api/knowledge-base/ai-suggest").send({ days: 7 }),
      accessToken,
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps structural medication and biometric records out of the AI Suggest provider", async () => {
    const { user, accessToken } = await createTestUser({ role: "admin" });
    await ChatConversation.create({
      userId: user._id,
      title: "Synthetic private clinical records",
      messages: [
        {
          role: "user",
          content: "học viên Lan đang dùng Ozempic, nên tập cardio thế nào?",
        },
        {
          role: "assistant",
          content:
            "Synthetic personalized medication answer that must never leave the server.",
        },
        {
          role: "user",
          content: "client Jane has SpO2 88% and wants cardio advice",
        },
        {
          role: "assistant",
          content:
            "Synthetic personalized biometric answer that must never leave the server.",
        },
        {
          role: "user",
          content: "học viên Lan được kê Ozempic, nên tập cardio thế nào?",
        },
        {
          role: "assistant",
          content:
            "Synthetic passive-prescription answer that must never leave the server.",
        },
        {
          role: "user",
          content: "SpO2 của client Jane là 88%, latest research nói gì?",
        },
        {
          role: "assistant",
          content:
            "Synthetic reversed-biometric answer that must never leave the server.",
        },
      ],
      messageCount: 8,
    });
    process.env.GEMINI_API_KEY = "synthetic-test-key";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await withAuth(
      request(app).post("/api/knowledge-base/ai-suggest").send({ days: 7 }),
      accessToken,
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not offer legacy general answers without answerTrace as fitness suggestions", async () => {
    const { user, accessToken } = await createTestUser({ role: "admin" });
    await ChatConversation.create({
      userId: user._id,
      title: "Legacy general conversation",
      messages: [
        { role: "user", content: "Lisa là ai trong nhóm BLACKPINK?" },
        {
          role: "assistant",
          content: "Lisa là một thành viên của nhóm BLACKPINK.",
        },
      ],
      messageCount: 2,
    });
    process.env.GEMINI_API_KEY = "synthetic-test-key";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await withAuth(
      request(app).post("/api/knowledge-base/ai-suggest").send({ days: 7 }),
      accessToken,
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lets an admin resolve a pending downvote with server-owned reviewer metadata", async () => {
    const { user, accessToken } = await createTestUser({ role: "admin" });
    const conversation = await ChatConversation.create({
      userId: user._id,
      title: "Synthetic pending answer",
      messages: [
        { role: "user", content: "Cách deadlift đúng?" },
        {
          role: "assistant",
          content: "Synthetic answer needing review.",
          feedback: "down",
          feedbackReview: { status: "pending" },
        },
      ],
      messageCount: 2,
    });
    const assistantMessage = conversation.messages[1];

    const response = await withAuth(
      request(app)
        .post(
          `/api/knowledge-base/feedback/${conversation._id}/${assistantMessage._id}/review`,
        )
        .send({ status: "resolved", reviewedBy: "forged" }),
      accessToken,
    );

    expect(response.status).toBe(400);

    const valid = await withAuth(
      request(app)
        .post(
          `/api/knowledge-base/feedback/${conversation._id}/${assistantMessage._id}/review`,
        )
        .send({ status: "resolved" }),
      accessToken,
    );
    const stored = await ChatConversation.findById(conversation._id).lean();
    expect(valid.body.data).toMatchObject({
      conversationId: conversation._id.toString(),
      messageId: assistantMessage._id.toString(),
      feedback: "down",
      feedbackReview: {
        status: "resolved",
        reviewedBy: user._id.toString(),
      },
    });
    expect(stored.messages[1].feedbackReview.reviewedAt).toBeTruthy();

    const repeated = await withAuth(
      request(app)
        .post(
          `/api/knowledge-base/feedback/${conversation._id}/${assistantMessage._id}/review`,
        )
        .send({ status: "dismissed" }),
      accessToken,
    );
    expect(repeated.status).toBe(409);
  });

  it("rejects review of an assistant answer that is not downvoted", async () => {
    const { user, accessToken } = await createTestUser({ role: "admin" });
    const conversation = await ChatConversation.create({
      userId: user._id,
      title: "Synthetic positive answer",
      messages: [
        { role: "user", content: "Cách plank đúng?" },
        { role: "assistant", content: "Synthetic answer.", feedback: "up" },
      ],
      messageCount: 2,
    });

    const response = await withAuth(
      request(app)
        .post(
          `/api/knowledge-base/feedback/${conversation._id}/${conversation.messages[1]._id}/review`,
        )
        .send({ status: "dismissed" }),
      accessToken,
    );

    expect(response.status).toBe(409);
  });
});
