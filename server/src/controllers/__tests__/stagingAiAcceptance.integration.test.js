import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { provider, retrieval } = vi.hoisted(() => ({ provider: vi.fn(), retrieval: vi.fn() }));
vi.mock("../../services/ai/providers/index.js", () => ({ llmStream: provider }));
vi.mock("../../services/ai/embedding.service.js", () => ({ searchKnowledgeBase: retrieval }));
vi.mock("../../services/ai/aiLogger.js", () => ({ aiLogger: {
  chatStart: vi.fn(), chatEnd: vi.fn(), chatError: vi.fn(), kbMatch: vi.fn(),
  userLocked: vi.fn(), moderationTrigger: vi.fn(),
} }));
import {
  clearCollections, createTestApp, createTestUser, TEST_JWT_SECRET, TEST_REFRESH_SECRET, withAuth,
} from "../../__tests__/setup.js";
import ChatConversation from "../../models/ChatConversation.js";
import KnowledgeEntry from "../../models/KnowledgeEntry.js";
import ServiceUsageBucket from "../../models/ServiceUsageBucket.js";
import User from "../../models/User.js";
import { chatStream } from "../ai.controller.js";
import { parseChatRequest } from "../../utils/aiChat.js";
import {
  issueStagingAiAcceptance, claimStagingAiAcceptance,
  registerStagingAiAcceptanceCapability, STAGING_AI_ACCEPTANCE_COLLECTION,
} from "../../services/ai/stagingAiAcceptance.service.js";
import {
  prepareStagingAiAcceptance,
  settleStagingAiAcceptanceHandler,
} from "../../middlewares/stagingAiAcceptance.js";

const env = {
  NODE_ENV: "test", JWT_SECRET: TEST_JWT_SECRET, REFRESH_SECRET: TEST_REFRESH_SECRET,
  APP_ENV: "staging", STAGING_AI_ACCEPTANCE_ENABLED: "true",
  CLIENT_URL: "https://staging--htcoachingweb.netlify.app",
  PUBLIC_API_ORIGIN: "https://htcoachingweb-staging.onrender.com",
  RENDER_GIT_COMMIT: "a".repeat(40),
};
let mongo;
let app;
let knowledgeBaseApp;
const makeBody = async (actorId, mode, overrides = {}) => {
  const body = { message: "Xin chào", requestId: randomUUID(), ...overrides };
  const runId = randomUUID();
  await User.updateOne({ _id: actorId }, { $set: { email: `ac009.${runId}@example.invalid` } });
  body.stagingAcceptance = issueStagingAiAcceptance({
    request: body, actorId, action: "ai_chat", mode, releaseSha: env.RENDER_GIT_COMMIT, runId,
    purpose: mode === "provider_failure_before_llm"
      ? "provider_failure_retry"
      : mode === "observe_only" ? "live_kb_provider" : "paced_conversation",
  });
  await registerStagingAiAcceptanceCapability(body.stagingAcceptance, { env });
  return body;
};
const events = (text) => text.split("\n\n").filter((frame) => frame.startsWith("data: "))
  .map((frame) => JSON.parse(frame.slice(6)));

beforeAll(async () => {
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { dbName: "htcoaching_staging" });
  const { default: routes } = await import("../../routes/ai.routes.js");
  const { default: knowledgeBaseRoutes } = await import("../../routes/knowledgeBase.routes.js");
  app = createTestApp();
  app.use("/api/ai", routes);
  knowledgeBaseApp = createTestApp();
  knowledgeBaseApp.use("/api/knowledge-base", knowledgeBaseRoutes);
});
beforeEach(() => {
  provider.mockImplementation(async function* () { yield { type: "text", content: "Normal provider answer." }; });
  retrieval.mockResolvedValue([]);
});
afterEach(async () => {
  vi.clearAllMocks();
  await clearCollections();
  await mongoose.connection.db.collection(STAGING_AI_ACCEPTANCE_COLLECTION).deleteMany({});
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
  vi.unstubAllEnvs();
});

describe("staging acceptance through the authenticated chat route", () => {
  it("keeps normal requests on the original provider without acceptance metadata", async () => {
    const { accessToken } = await createTestUser();
    const response = await withAuth(request(app).post("/api/ai/chat"), accessToken)
      .send({ message: "Xin chào", requestId: randomUUID() });
    expect({ status: response.status, providerCalls: provider.mock.calls.length,
      acceptanceRecords: await mongoose.connection.db.collection(STAGING_AI_ACCEPTANCE_COLLECTION).countDocuments(),
      text: events(response.text).filter((event) => event.type === "text").map((event) => event.content).join(""),
    }).toEqual({ status: 200, providerCalls: 1, acceptanceRecords: 0, text: "Normal provider answer." });
  });

  it("rejects invalid capability before quota reservation or provider execution", async () => {
    const { accessToken } = await createTestUser();
    const response = await withAuth(request(app).post("/api/ai/chat"), accessToken)
      .set("Origin", env.CLIENT_URL).send({ message: "Xin chào", requestId: randomUUID(), stagingAcceptance: "invalid" });
    expect({ status: response.status, code: response.body.code,
      quotaRecords: await ServiceUsageBucket.countDocuments(), providerCalls: provider.mock.calls.length,
    }).toEqual({ status: 403, code: "STAGING_AI_ACCEPTANCE_REJECTED", quotaRecords: 0, providerCalls: 0 });
  });

  it("does not grant guest authentication or waive CSRF for a valid capability", async () => {
    const { user, accessToken } = await createTestUser();
    const body = await makeBody(user.id, "paced_response");
    const guest = await request(app).post("/api/ai/chat").set("Origin", env.CLIENT_URL)
      .set("Cookie", "csrfToken=test-csrf-token").set("X-CSRF-Token", "test-csrf-token").send(body);
    const noCsrf = await request(app).post("/api/ai/chat").set("Origin", env.CLIENT_URL)
      .set("Cookie", `accessToken=${accessToken}`).send(body);
    expect({ guest: guest.status, noCsrf: noCsrf.status, quota: await ServiceUsageBucket.countDocuments(),
      admittedClaims: await mongoose.connection.db.collection(STAGING_AI_ACCEPTANCE_COLLECTION)
        .countDocuments({ receiptState: "admitted" }),
    }).toEqual({ guest: 403, noCsrf: 403, quota: 0, admittedClaims: 0 });
  });

  it("settles a claimed capability when downstream middleware rejects before the controller", async () => {
    const { user } = await createTestUser();
    const body = await makeBody(user.id, "provider_failure_before_llm");
    const req = {
      body,
      user: { id: user.id },
      aiActor: { kind: "user", userId: user.id },
      aiChatRequest: parseChatRequest(body),
      get: (name) => name.toLowerCase() === "origin" ? env.CLIENT_URL : undefined,
    };
    const res = new EventEmitter();
    res.statusCode = 429;
    const next = vi.fn();
    await prepareStagingAiAcceptance(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    res.emit("finish");
    await vi.waitFor(async () => expect(await mongoose.connection.db
      .collection(STAGING_AI_ACCEPTANCE_COLLECTION)
      .findOne({ requestId: body.requestId })).toMatchObject({
        receiptState: "settled",
        outcome: "rejected",
      }));
  });

  it("waits for quota reconciliation when the client closes before the controller", async () => {
    const { user } = await createTestUser();
    const body = await makeBody(user.id, "provider_failure_before_llm");
    const req = {
      body,
      user: { id: user.id },
      aiActor: { kind: "user", userId: user.id },
      aiChatRequest: parseChatRequest(body),
      get: (name) => name.toLowerCase() === "origin" ? env.CLIENT_URL : undefined,
    };
    const res = new EventEmitter();
    res.statusCode = 200;
    res.writableEnded = false;
    const admitted = vi.fn();
    await prepareStagingAiAcceptance(req, res, admitted);
    expect(admitted).toHaveBeenCalledOnce();

    let releaseQuota;
    const quotaFinished = new Promise((resolve) => { releaseQuota = resolve; });
    const refund = vi.fn().mockResolvedValue({ remaining: 1 });
    const handler = vi.fn();
    const downstream = (async () => {
      await quotaFinished;
      req.refundServiceUsage = refund;
      await settleStagingAiAcceptanceHandler(handler)(req, res, vi.fn());
    })();

    res.emit("close");
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(await mongoose.connection.db.collection(STAGING_AI_ACCEPTANCE_COLLECTION)
      .findOne({ requestId: body.requestId })).toMatchObject({ receiptState: "admitted" });

    releaseQuota();
    await downstream;
    expect({
      handlerCalls: handler.mock.calls.length,
      refundCalls: refund.mock.calls.length,
      receipt: await mongoose.connection.db.collection(STAGING_AI_ACCEPTANCE_COLLECTION)
        .findOne({ requestId: body.requestId }),
    }).toMatchObject({
      handlerCalls: 0,
      refundCalls: 1,
      receipt: { receiptState: "settled", outcome: "aborted" },
    });
  });

  it("does not settle a pre-handler 503 with an unknown quota write outcome", async () => {
    const { user } = await createTestUser();
    const body = await makeBody(user.id, "observe_only");
    const req = {
      body, user: { id: user.id }, aiActor: { kind: "user", userId: user.id },
      aiChatRequest: parseChatRequest(body), get: () => env.CLIENT_URL,
    };
    const res = new EventEmitter();
    res.statusCode = 503;
    await prepareStagingAiAcceptance(req, res, vi.fn());
    res.emit("finish");
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(await mongoose.connection.db.collection(STAGING_AI_ACCEPTANCE_COLLECTION)
      .findOne({ requestId: body.requestId })).toMatchObject({ receiptState: "admitted" });
  });

  it("does not settle when conversation acquisition rejects with an unknown write outcome", async () => {
    const { user } = await createTestUser();
    const body = await makeBody(user.id, "observe_only");
    const acceptance = await claimStagingAiAcceptance(body.stagingAcceptance, {
      request: body, actorId: user.id, origin: env.CLIENT_URL,
    });
    const create = vi.spyOn(ChatConversation, "create")
      .mockRejectedValueOnce(new Error("synthetic ambiguous conversation write"));
    const req = {
      body, user: { id: user.id }, aiChatRequest: parseChatRequest(body),
      stagingAiAcceptance: acceptance, refundServiceUsage: vi.fn().mockResolvedValue(null),
    };
    const res = new EventEmitter();
    res.statusCode = 200;
    res.status = vi.fn((status) => { res.statusCode = status; return res; });
    res.json = vi.fn(() => res);
    try {
      await settleStagingAiAcceptanceHandler(chatStream)(req, res, vi.fn());
      expect({ status: res.statusCode, receipt: await mongoose.connection.db
        .collection(STAGING_AI_ACCEPTANCE_COLLECTION).findOne({ requestId: body.requestId }) })
        .toMatchObject({ status: 500, receipt: { receiptState: "admitted" } });
    } finally {
      create.mockRestore();
    }
  });

  it("keeps the receipt admitted when pre-controller quota reconciliation fails", async () => {
    const { user } = await createTestUser();
    const body = await makeBody(user.id, "provider_failure_before_llm");
    const req = {
      body,
      user: { id: user.id },
      aiActor: { kind: "user", userId: user.id },
      aiChatRequest: parseChatRequest(body),
      get: (name) => name.toLowerCase() === "origin" ? env.CLIENT_URL : undefined,
    };
    const res = new EventEmitter();
    res.statusCode = 200;
    const admitted = vi.fn();
    await prepareStagingAiAcceptance(req, res, admitted);
    expect(admitted).toHaveBeenCalledOnce();
    res.emit("close");
    req.refundServiceUsage = vi.fn()
      .mockRejectedValue(new Error("synthetic pre-controller refund failure"));
    const handler = vi.fn();

    await settleStagingAiAcceptanceHandler(handler)(req, res, vi.fn());

    expect({
      handlerCalls: handler.mock.calls.length,
      receipt: await mongoose.connection.db.collection(STAGING_AI_ACCEPTANCE_COLLECTION)
        .findOne({ requestId: body.requestId }),
    }).toMatchObject({ handlerCalls: 0, receipt: { receiptState: "admitted" } });
  });

  it("reconciles a close during conversation acquisition before provider execution", async () => {
    const { user } = await createTestUser();
    const body = await makeBody(user.id, "observe_only");
    const acceptance = await claimStagingAiAcceptance(body.stagingAcceptance, {
      request: body, actorId: user.id, origin: env.CLIENT_URL,
    });
    let releaseCreate;
    const createGate = new Promise((resolve) => { releaseCreate = resolve; });
    const originalCreate = ChatConversation.create.bind(ChatConversation);
    const create = vi.spyOn(ChatConversation, "create").mockImplementation(async (...args) => {
      await createGate;
      return originalCreate(...args);
    });
    const refund = vi.fn().mockResolvedValue({ remaining: 1 });
    const req = {
      body,
      user: { id: user.id },
      aiChatRequest: parseChatRequest(body),
      stagingAiAcceptance: acceptance,
      refundServiceUsage: refund,
    };
    const res = new EventEmitter();
    res.statusCode = 200;
    res.setHeader = vi.fn();
    res.flushHeaders = vi.fn();
    res.writableEnded = false;
    res.end = vi.fn(() => { res.writableEnded = true; });
    res.write = vi.fn();
    try {
      const pending = settleStagingAiAcceptanceHandler(chatStream)(req, res, vi.fn());
      await vi.waitFor(() => expect(create).toHaveBeenCalledOnce());
      res.emit("close");
      releaseCreate();
      await pending;

      const conversation = await ChatConversation.findOne({ userId: user._id })
        .select("+activeStreamId +recentRequestIds")
        .lean();
      expect({
        providerCalls: provider.mock.calls.length,
        refundCalls: refund.mock.calls.length,
        conversation: {
          messages: conversation?.messages,
          activeStreamId: conversation?.activeStreamId,
          recentRequestIds: conversation?.recentRequestIds,
        },
        receipt: await mongoose.connection.db.collection(STAGING_AI_ACCEPTANCE_COLLECTION)
          .findOne({ requestId: body.requestId }),
      }).toMatchObject({
        providerCalls: 0,
        refundCalls: 1,
        conversation: { messages: [], activeStreamId: null, recentRequestIds: [] },
        receipt: { receiptState: "settled", outcome: "aborted" },
      });
    } finally {
      releaseCreate();
      create.mockRestore();
    }
  });

  it("reconciles a response that closed before the controller starts", async () => {
    const { user } = await createTestUser();
    const body = await makeBody(user.id, "observe_only");
    const acceptance = await claimStagingAiAcceptance(body.stagingAcceptance, {
      request: body, actorId: user.id, origin: env.CLIENT_URL,
    });
    const refund = vi.fn().mockResolvedValue({ remaining: 1 });
    const req = {
      body,
      user: { id: user.id },
      aiChatRequest: parseChatRequest(body),
      stagingAiAcceptance: acceptance,
      stagingAiAcceptanceResponseClosed: true,
      refundServiceUsage: refund,
    };
    const res = new EventEmitter();
    res.statusCode = 200;
    res.writableEnded = false;
    res.setHeader = vi.fn();
    res.flushHeaders = vi.fn();
    res.end = vi.fn(() => { res.writableEnded = true; });
    res.write = vi.fn();

    await settleStagingAiAcceptanceHandler(chatStream)(req, res, vi.fn());

    expect({
      providerCalls: provider.mock.calls.length,
      refundCalls: refund.mock.calls.length,
      conversations: await ChatConversation.countDocuments({ userId: user._id }),
      receipt: await mongoose.connection.db.collection(STAGING_AI_ACCEPTANCE_COLLECTION)
        .findOne({ requestId: body.requestId }),
    }).toMatchObject({
      providerCalls: 0,
      refundCalls: 1,
      conversations: 0,
      receipt: { receiptState: "settled", outcome: "aborted" },
    });
  });

  it("substitutes a fixed safe response only after the normal retrieval path", async () => {
    const { user, accessToken } = await createTestUser();
    retrieval.mockResolvedValue([{ _id: new mongoose.Types.ObjectId(), question: "Phân bổ protein trong ngày?",
      answer: "Kiến thức tổng hợp thử nghiệm.", similarity: 0.95, category: "nutrition" }]);
    const body = await makeBody(user.id, "paced_response", {
      message: "Tôi nên phân bổ protein trong ngày như thế nào?",
    });
    const pending = withAuth(request(app).post("/api/ai/chat"), accessToken)
      .set("Origin", env.CLIENT_URL).send(body).then((response) => response);
    const collection = mongoose.connection.db.collection(STAGING_AI_ACCEPTANCE_COLLECTION);
    await vi.waitFor(async () => expect((await collection.findOne({ requestId: body.requestId }))?.status).toBe("first_frame"), { timeout: 5_000 });
    await collection.updateOne({ requestId: body.requestId, status: "first_frame" }, { $set: { status: "released" } });
    const response = await pending;
    const text = events(response.text).filter((event) => event.type === "text");
    const conversation = await ChatConversation.findOne({ userId: user._id }).lean();
    expect({ status: response.status, first: text[0]?.content, combined: text.map((event) => event.content).join(""),
      providerCalls: provider.mock.calls.length, retrievalCalls: retrieval.mock.calls.length,
      model: conversation.messages.at(-1).answerTrace.model,
    }).toEqual({ status: 200, first: expect.stringContaining("AC009-PREFIX"),
      combined: expect.stringMatching(/^AC009-PREFIX[\s\S]*AC009-LATE-SUFFIX$/),
      providerCalls: 0, retrievalCalls: 1, model: "staging_acceptance_synthetic_v1" });
    expect(text[0].content).not.toContain("AC009-LATE-SUFFIX");
    expect(response.text).not.toMatch(/stagingAcceptance|payloadDigest|releaseSha/);
  });

  it("injected operational failure rolls back the owned turn and refunds quota for a normal retry", async () => {
    const { user, accessToken } = await createTestUser();
    const body = await makeBody(user.id, "provider_failure_before_llm");
    const failed = await withAuth(request(app).post("/api/ai/chat"), accessToken)
      .set("Origin", env.CLIENT_URL).send(body);
    const conversation = await ChatConversation.findOne({ userId: user._id }).select("+recentRequestIds +activeStreamId").lean();
    const bucket = await ServiceUsageBucket.findOne({ userId: user._id }).select("+usageEvents").lean();
    expect({ error: events(failed.text).find((event) => event.type === "error"),
      messages: conversation.messages, activeStreamId: conversation.activeStreamId,
      recentRequestIds: conversation.recentRequestIds, count: bucket.count, usageEvents: bucket.usageEvents,
      providerCalls: provider.mock.calls.length,
    }).toEqual({ error: {
      type: "error",
      message: "Có lỗi xảy ra, vui lòng thử lại",
      retryable: true,
      conversationId: conversation._id.toString(),
    },
      messages: [], activeStreamId: null, recentRequestIds: [], count: 0, usageEvents: [], providerCalls: 0 });
    expect(failed.headers["x-ai-conversation-id"]).toBe(
      conversation._id.toString(),
    );
    const retry = await withAuth(request(app).post("/api/ai/chat"), accessToken)
      .send({ message: body.message, requestId: body.requestId, conversationId: conversation._id.toString() });
    expect({ done: events(retry.text).some((event) => event.type === "done"), providerCalls: provider.mock.calls.length })
      .toEqual({ done: true, providerCalls: 1 });
  });

  it("keeps conversation ownership checks authoritative for a correctly signed capability", async () => {
    const { user, accessToken } = await createTestUser();
    const foreignOwner = new mongoose.Types.ObjectId();
    const foreign = await ChatConversation.create({ userId: foreignOwner,
      title: "Synthetic foreign conversation", messages: [{ role: "user", content: "Private synthetic text" }],
    });
    const body = await makeBody(user.id, "provider_failure_before_llm", { conversationId: foreign.id });
    const response = await withAuth(request(app).post("/api/ai/chat"), accessToken)
      .set("Origin", env.CLIENT_URL).send(body);
    await vi.waitFor(async () => expect(await mongoose.connection.db.collection(STAGING_AI_ACCEPTANCE_COLLECTION)
      .findOne({ requestId: body.requestId })).toMatchObject({ receiptState: "settled" }));
    const receipt = await mongoose.connection.db.collection(STAGING_AI_ACCEPTANCE_COLLECTION)
      .findOne({ requestId: body.requestId });
    expect({ status: response.status, calls: provider.mock.calls.length,
      messages: (await ChatConversation.findById(foreign._id).lean()).messages.map((message) => message.content),
      quota: (await ServiceUsageBucket.findOne({ userId: user._id }).lean()).count,
      receipt: { state: receipt?.receiptState, outcome: receipt?.outcome },
    }).toEqual({ status: 404, calls: 0, messages: ["Private synthetic text"], quota: 0,
      receipt: { state: "settled", outcome: "rejected" } });
  });

  it("persists only the first delivered frame when the client closes during the hold", async () => {
    const { user } = await createTestUser();
    const body = await makeBody(user.id, "paced_response");
    const acceptance = await claimStagingAiAcceptance(body.stagingAcceptance, {
      request: body, actorId: user.id, origin: env.CLIENT_URL,
    });
    const frames = [];
    const res = new EventEmitter();
    res.setHeader = vi.fn();
    res.flushHeaders = vi.fn();
    res.writableEnded = false;
    res.end = vi.fn(() => { res.writableEnded = true; });
    res.write = (frame) => {
      frames.push(frame);
      if (frame.includes('"type":"text"')) setTimeout(() => res.emit("close"), 20);
    };
    await chatStream({ body, user: { id: user.id }, aiChatRequest: parseChatRequest(body),
      stagingAiAcceptance: acceptance,
    }, res);
    const conversation = await ChatConversation.findOne({ userId: user._id }).select("+activeStreamId").lean();
    const delivered = events(frames.join("")).filter((event) => event.type === "text");
    expect({ frames: delivered.length, text: conversation.messages.at(-1).content,
      activeStreamId: conversation.activeStreamId,
    }).toEqual({ frames: 1, text: delivered[0].content, activeStreamId: null });
    expect(conversation.messages.at(-1).content).toContain("AC009-PREFIX");
    expect(frames.join("")).not.toContain("AC009-LATE-SUFFIX");
    expect((await mongoose.connection.db.collection(STAGING_AI_ACCEPTANCE_COLLECTION)
      .findOne({ requestId: body.requestId })).status).toBe("aborted");
  });

  it("keeps the receipt admitted when quota refund is not acknowledged", async () => {
    const { user } = await createTestUser();
    const body = await makeBody(user.id, "provider_failure_before_llm");
    const acceptance = await claimStagingAiAcceptance(body.stagingAcceptance, {
      request: body, actorId: user.id, origin: env.CLIENT_URL,
    });
    const req = {
      body,
      user: { id: user.id },
      aiChatRequest: parseChatRequest(body),
      stagingAiAcceptance: acceptance,
      refundServiceUsage: vi.fn().mockRejectedValue(new Error("synthetic refund failure")),
    };
    const frames = [];
    const res = new EventEmitter();
    res.statusCode = 200;
    res.setHeader = vi.fn();
    res.flushHeaders = vi.fn();
    res.writableEnded = false;
    res.end = vi.fn(() => { res.writableEnded = true; });
    res.write = (frame) => frames.push(frame);
    await settleStagingAiAcceptanceHandler(chatStream)(req, res, vi.fn());
    expect(await mongoose.connection.db.collection(STAGING_AI_ACCEPTANCE_COLLECTION)
      .findOne({ requestId: body.requestId })).toMatchObject({ receiptState: "admitted" });
  });

  it("keeps the receipt admitted when rollback persistence is not acknowledged", async () => {
    const { user } = await createTestUser();
    const body = await makeBody(user.id, "provider_failure_before_llm");
    const acceptance = await claimStagingAiAcceptance(body.stagingAcceptance, {
      request: body, actorId: user.id, origin: env.CLIENT_URL,
    });
    const update = vi.spyOn(ChatConversation, "updateOne")
      .mockRejectedValue(new Error("synthetic rollback failure"));
    const req = {
      body,
      user: { id: user.id },
      aiChatRequest: parseChatRequest(body),
      stagingAiAcceptance: acceptance,
      refundServiceUsage: vi.fn().mockResolvedValue(null),
    };
    const res = new EventEmitter();
    res.statusCode = 200;
    res.setHeader = vi.fn();
    res.flushHeaders = vi.fn();
    res.writableEnded = false;
    res.end = vi.fn(() => { res.writableEnded = true; });
    res.write = vi.fn();
    try {
      await settleStagingAiAcceptanceHandler(chatStream)(req, res, vi.fn());
      expect(await mongoose.connection.db.collection(STAGING_AI_ACCEPTANCE_COLLECTION)
        .findOne({ requestId: body.requestId })).toMatchObject({ receiptState: "admitted" });
    } finally {
      update.mockRestore();
    }
  });

  it("keeps the receipt admitted when successful finalization is not acknowledged", async () => {
    const { user } = await createTestUser();
    const body = await makeBody(user.id, "observe_only");
    const acceptance = await claimStagingAiAcceptance(body.stagingAcceptance, {
      request: body, actorId: user.id, origin: env.CLIENT_URL,
    });
    const update = vi.spyOn(ChatConversation, "updateOne")
      .mockResolvedValue({ acknowledged: true, modifiedCount: 0 });
    const req = {
      body,
      user: { id: user.id },
      aiChatRequest: parseChatRequest(body),
      stagingAiAcceptance: acceptance,
    };
    const res = new EventEmitter();
    res.statusCode = 200;
    res.setHeader = vi.fn();
    res.flushHeaders = vi.fn();
    res.writableEnded = false;
    res.end = vi.fn(() => { res.writableEnded = true; });
    res.write = vi.fn();
    try {
      await settleStagingAiAcceptanceHandler(chatStream)(req, res, vi.fn());
      expect(await mongoose.connection.db.collection(STAGING_AI_ACCEPTANCE_COLLECTION)
        .findOne({ requestId: body.requestId })).toMatchObject({ receiptState: "admitted" });
    } finally {
      update.mockRestore();
    }
  });

  it("keeps the receipt admitted when Knowledge Base usage persistence fails", async () => {
    const { user } = await createTestUser();
    const body = await makeBody(user.id, "observe_only", { message: "Cách squat đúng?" });
    const acceptance = await claimStagingAiAcceptance(body.stagingAcceptance, {
      request: body, actorId: user.id, origin: env.CLIENT_URL,
    });
    retrieval.mockResolvedValue([{
      _id: new mongoose.Types.ObjectId(),
      question: "Cách squat?",
      answer: "Kiến thức tổng hợp thử nghiệm.",
      similarity: 0.95,
      category: "training",
    }]);
    const update = vi.spyOn(KnowledgeEntry, "updateMany")
      .mockRejectedValue(new Error("synthetic Knowledge Base usage failure"));
    const req = {
      body,
      user: { id: user.id },
      aiChatRequest: parseChatRequest(body),
      stagingAiAcceptance: acceptance,
    };
    const res = new EventEmitter();
    res.statusCode = 200;
    res.setHeader = vi.fn();
    res.flushHeaders = vi.fn();
    res.writableEnded = false;
    res.end = vi.fn(() => { res.writableEnded = true; });
    res.write = vi.fn();
    try {
      await settleStagingAiAcceptanceHandler(chatStream)(req, res, vi.fn());
      expect(await mongoose.connection.db.collection(STAGING_AI_ACCEPTANCE_COLLECTION)
        .findOne({ requestId: body.requestId })).toMatchObject({ receiptState: "admitted" });
    } finally {
      update.mockRestore();
    }
  });

  it("settles a duplicate request with the duplicate terminal outcome", async () => {
    const { user, accessToken } = await createTestUser();
    const requestId = randomUUID();
    const first = await withAuth(request(app).post("/api/ai/chat"), accessToken)
      .send({ message: "Xin chào", requestId });
    const conversationId = events(first.text)
      .find((event) => event.type === "done")?.conversationId;
    const body = await makeBody(user.id, "observe_only", { requestId, conversationId });

    const duplicate = await withAuth(request(app).post("/api/ai/chat"), accessToken)
      .set("Origin", env.CLIENT_URL)
      .send(body);
    await vi.waitFor(async () => expect(await mongoose.connection.db.collection(STAGING_AI_ACCEPTANCE_COLLECTION)
      .findOne({ requestId })).toMatchObject({ receiptState: "settled" }));
    const receipt = await mongoose.connection.db.collection(STAGING_AI_ACCEPTANCE_COLLECTION)
      .findOne({ requestId });
    expect({
      status: duplicate.status,
      duplicate: events(duplicate.text).find((event) => event.type === "done")?.duplicate,
      providerCalls: provider.mock.calls.length,
      receiptState: receipt?.receiptState,
      outcome: receipt?.outcome,
    }).toEqual({
      status: 200,
      duplicate: true,
      providerCalls: 1,
      receiptState: "settled",
      outcome: "duplicate",
    });
  });
});

describe("staging acceptance through the admin Knowledge Base search route", () => {
  it("requires real admin authentication and settles a header-bound search receipt", async () => {
    const runId = randomUUID();
    const { user, accessToken } = await createTestUser({
      role: "admin", email: `ac009-admin.${runId}@example.invalid`,
    });
    const requestId = randomUUID();
    const query = { q: "squat", limit: "3" };
    const token = issueStagingAiAcceptance({
      request: { query, requestId }, actorId: user.id, runId,
      releaseSha: env.RENDER_GIT_COMMIT, action: "kb_search",
      purpose: "kb_search_root", mode: "observe_only",
    });
    await registerStagingAiAcceptanceCapability(token, { env });
    const response = await withAuth(request(knowledgeBaseApp).get("/api/knowledge-base/search").query(query), accessToken)
      .set("Origin", env.CLIENT_URL)
      .set("X-Staging-Ai-Acceptance", token)
      .set("X-Staging-Ai-Request-Id", requestId);
    const receipt = await mongoose.connection.db.collection(STAGING_AI_ACCEPTANCE_COLLECTION).findOne({ requestId });
    expect({ status: response.status, providerCalls: retrieval.mock.calls.length, receipt: {
      action: receipt?.action, purpose: receipt?.purpose, receiptState: receipt?.receiptState, outcome: receipt?.outcome,
    } }).toEqual({ status: 200, providerCalls: 1, receipt: {
      action: "kb_search", purpose: "kb_search_root", receiptState: "settled", outcome: "completed",
    } });
  });
});
