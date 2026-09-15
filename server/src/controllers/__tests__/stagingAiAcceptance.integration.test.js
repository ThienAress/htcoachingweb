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
import ServiceUsageBucket from "../../models/ServiceUsageBucket.js";
import User from "../../models/User.js";
import { chatStream } from "../ai.controller.js";
import { parseChatRequest } from "../../utils/aiChat.js";
import {
  issueStagingAiAcceptance, claimStagingAiAcceptance, STAGING_AI_ACCEPTANCE_COLLECTION,
} from "../../services/ai/stagingAiAcceptance.service.js";

const env = {
  NODE_ENV: "test", JWT_SECRET: TEST_JWT_SECRET, REFRESH_SECRET: TEST_REFRESH_SECRET,
  APP_ENV: "staging", STAGING_AI_ACCEPTANCE_ENABLED: "true",
  CLIENT_URL: "https://staging--htcoachingweb.netlify.app",
  PUBLIC_API_ORIGIN: "https://htcoachingweb-staging.onrender.com",
  RENDER_GIT_COMMIT: "a".repeat(40),
};
let mongo;
let app;
const makeBody = async (actorId, mode, overrides = {}) => {
  const body = { message: "Xin chào", requestId: randomUUID(), ...overrides };
  const runId = randomUUID();
  await User.updateOne({ _id: actorId }, { $set: { email: `ac009.${runId}@example.invalid` } });
  body.stagingAcceptance = issueStagingAiAcceptance({
    request: body, actorId, mode, releaseSha: env.RENDER_GIT_COMMIT, runId,
  });
  return body;
};
const events = (text) => text.split("\n\n").filter((frame) => frame.startsWith("data: "))
  .map((frame) => JSON.parse(frame.slice(6)));

beforeAll(async () => {
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { dbName: "htcoaching_staging" });
  const { default: routes } = await import("../../routes/ai.routes.js");
  app = createTestApp();
  app.use("/api/ai", routes);
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
      claims: await mongoose.connection.db.collection(STAGING_AI_ACCEPTANCE_COLLECTION).countDocuments(),
    }).toEqual({ guest: 403, noCsrf: 403, quota: 0, claims: 0 });
  });

  it("substitutes a fixed safe response only after the normal retrieval path", async () => {
    const { user, accessToken } = await createTestUser();
    retrieval.mockResolvedValue([{ _id: new mongoose.Types.ObjectId(), question: "Cách squat?",
      answer: "Kiến thức tổng hợp thử nghiệm.", similarity: 0.95, category: "training" }]);
    const body = await makeBody(user.id, "paced_response", { message: "Cách squat đúng?" });
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
    }).toEqual({ error: { type: "error", message: "Có lỗi xảy ra, vui lòng thử lại", retryable: true },
      messages: [], activeStreamId: null, recentRequestIds: [], count: 0, usageEvents: [], providerCalls: 0 });
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
    expect({ status: response.status, calls: provider.mock.calls.length,
      messages: (await ChatConversation.findById(foreign._id).lean()).messages.map((message) => message.content),
      quota: (await ServiceUsageBucket.findOne({ userId: user._id }).lean()).count,
    }).toEqual({ status: 404, calls: 0, messages: ["Private synthetic text"], quota: 0 });
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
});
