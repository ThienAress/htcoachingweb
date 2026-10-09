import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const { retrieval } = vi.hoisted(() => ({ retrieval: vi.fn() }));
vi.mock("../../services/ai/embedding.service.js", () => ({ searchKnowledgeBase: retrieval }));
import { createTestApp, createTestUser, TEST_JWT_SECRET, TEST_REFRESH_SECRET, withAuth } from "../../__tests__/setup.js";
import {
  issueStagingAiAcceptance,
  claimStagingAiAcceptance,
  registerStagingAiAcceptanceCapability,
  STAGING_AI_ACCEPTANCE_COLLECTION,
} from "../../services/ai/stagingAiAcceptance.service.js";

import { settleStagingAiAcceptanceHandler } from "../../middlewares/stagingAiAcceptance.js";

const env = {
  NODE_ENV: "test",
  JWT_SECRET: TEST_JWT_SECRET,
  REFRESH_SECRET: TEST_REFRESH_SECRET,
  APP_ENV: "staging",
  STAGING_AI_ACCEPTANCE_ENABLED: "true",
  CLIENT_URL: "https://staging--htcoachingweb.netlify.app",
  PUBLIC_API_ORIGIN: "https://htcoachingweb-staging.onrender.com",
  RENDER_GIT_COMMIT: "a".repeat(40),
};
let mongo;
let app;
const collection = () => mongoose.connection.db.collection(STAGING_AI_ACCEPTANCE_COLLECTION);
const prepareSearch = async () => {
  const runId = randomUUID();
  const { user, accessToken } = await createTestUser({
    role: "admin",
    email: `ac009-admin.${runId}@example.invalid`,
  });
  const requestId = randomUUID();
  const query = { q: "Huong dan tap squat", limit: "3" };
  const token = issueStagingAiAcceptance({
    request: { query, requestId }, actorId: user.id, runId,
    releaseSha: env.RENDER_GIT_COMMIT, action: "kb_search",
    purpose: "kb_search_root", mode: "observe_only",
  });
  await registerStagingAiAcceptanceCapability(token, { env });
  const send = () => withAuth(request(app).get("/api/knowledge-base/search").query(query), accessToken)
    .set("Origin", env.CLIENT_URL)
    .set("X-Staging-Ai-Acceptance", token)
    .set("X-Staging-Ai-Request-Id", requestId);
  return { requestId, send };
};

beforeAll(async () => {
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { dbName: "htcoaching_staging" });
  const { default: routes } = await import("../../routes/knowledgeBase.routes.js");
  app = createTestApp();
  app.use("/api/knowledge-base", routes);
});
afterEach(async () => {
  retrieval.mockReset();
  const collections = await mongoose.connection.db.listCollections().toArray();
  for (const entry of collections) await mongoose.connection.db.collection(entry.name).deleteMany({});
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
  vi.unstubAllEnvs();
});

describe("completed read-only KB failure through the authenticated route", () => {
  it("keeps HTTP503 and settles a completed provider timeout as failed", async () => {
    retrieval.mockRejectedValue(Object.assign(new Error("synthetic timeout"), { code: "DEEPSEEK_TIMEOUT" }));
    const { requestId, send } = await prepareSearch();
    const response = await send();
    await vi.waitFor(async () => {
      const receipt = await collection().findOne({ requestId });
      expect({ status: response.status, code: response.body.code, state: receipt?.receiptState,
        outcome: receipt?.outcome }).toEqual({
        status: 503, code: "DEEPSEEK_TIMEOUT", state: "settled", outcome: "failed",
      });
    });
  });

  it("retains an unexpected throwing KB handler as unknown", async () => {
    retrieval.mockRejectedValue(new Error("synthetic unexpected retrieval failure"));
    const { requestId, send } = await prepareSearch();
    const response = await send();
    const receipt = await collection().findOne({ requestId });
    expect({ status: response.status, state: receipt?.receiptState, outcome: receipt?.outcome })
      .toEqual({ status: 500, state: "admitted", outcome: undefined });
  });

  it("does not settle a completed chat503 using the KB exception", async () => {
    const runId = randomUUID();
    const { user } = await createTestUser({ email: `ac009.${runId}@example.invalid` });
    const body = { message: "Xin chao", requestId: randomUUID() };
    const token = issueStagingAiAcceptance({
      request: body, actorId: user.id, runId, releaseSha: env.RENDER_GIT_COMMIT,
      action: "ai_chat", purpose: "live_kb_provider", mode: "observe_only",
    });
    await registerStagingAiAcceptanceCapability(token, { env });
    const claims = await claimStagingAiAcceptance(token, {
      request: body, actorId: user.id, origin: env.CLIENT_URL,
    });
    const req = { stagingAiAcceptance: claims };
    const res = { statusCode: 503, writableEnded: true };
    await settleStagingAiAcceptanceHandler(async () => {})(req, res, () => {});
    expect((await collection().findOne({ requestId: body.requestId }))?.receiptState).toBe("admitted");
  });
  it("leaves the receipt admitted while the provider remains in flight", async () => {
    let finish;
    const pendingProvider = new Promise((resolve) => { finish = resolve; });
    retrieval.mockImplementation(() => pendingProvider);
    const { requestId, send } = await prepareSearch();
    const pendingRequest = send().then((response) => response);
    try {
      await vi.waitFor(async () => expect((await collection().findOne({ requestId }))?.receiptState)
        .toBe("admitted"));
      expect((await collection().findOne({ requestId }))?.settledAt).toBeUndefined();
    } finally {
      finish([]);
      await pendingRequest;
    }
  });
});
