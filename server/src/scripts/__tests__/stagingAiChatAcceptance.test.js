import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  EXPECTED_API_ORIGIN,
  EXPECTED_CLIENT_URL,
  validateAcceptanceConfig,
} from "../stagingAiChatAcceptance.config.js";
import { assertHealthyVectorTopology, buildSafeEvidence, metricDelta } from "../stagingAiChatAcceptance.evidence.js";
import { createExactCleanup } from "../stagingAiChatAcceptance.cleanup.js";
import {
  selectNewReconciledAssistant,
  STAGING_AI_CHAT_ATTEMPT_PLAN,
} from "../stagingAiChatAcceptance.browser.js";
import {
  buildStagingAiRecoveryIntent,
  runStagingAiChatAcceptance,
  waitForSettledReceipts,
} from "../stagingAiChatAcceptance.js";
import { createApiClient, createKnowledgeFixture, searchKnowledgeFixture } from "../stagingAiChatAcceptance.http.js";
import { validateKnowledgeEntryPrivacy } from "../../services/ai/knowledgePrivacy.js";
import { parseKnowledgeEntryPayload, validateKnowledgePublication } from "../../utils/knowledgeBase.js";

const SHA = "a".repeat(40);
const validEnv = () => ({
  APP_ENV: "staging",
  MONGO_URI: "mongodb://localhost:27017/htcoaching_staging",
  CLIENT_URL: EXPECTED_CLIENT_URL,
  PUBLIC_API_ORIGIN: EXPECTED_API_ORIGIN,
  RELEASE_SHA: SHA,
  RENDER_GIT_COMMIT: SHA,
  CONFIRM_STAGING_AI_ACCEPTANCE: "yes",
  STAGING_AI_ACCEPTANCE_ENABLED: "true",
  EXPECTED_KB_EMBEDDING_VERSION: "gemini-embedding-2:768:question-answering-v1",
  STAGING_AI_ACCEPTANCE_OUTPUT: "evidence.json",
  STAGING_AI_ACCEPTANCE_RECOVERY_OUTPUT: "recovery.json",
  BACKGROUND_JOBS_ENABLED: "false",
  MORNING_HEALTH_REMINDER_ENABLED: "false",
  EMAIL_DELIVERY_MODE: "disabled",
  F1_RETENTION_ENFORCE: "false",
  ALLOWED_ORIGINS: EXPECTED_CLIENT_URL,
});

describe("staging AI acceptance config", () => {
  it.each([
    ["production env", { APP_ENV: "production" }],
    ["non-exact staging env", { APP_ENV: "STAGING" }],
    ["wrong database", { MONGO_URI: "mongodb://localhost:27017/other" }],
    ["wrong client", { CLIENT_URL: "https://example.invalid" }],
    ["wrong api", { PUBLIC_API_ORIGIN: "https://example.invalid" }],
    ["bad sha", { RELEASE_SHA: "abc" }],
    ["missing runtime sha", { RENDER_GIT_COMMIT: "" }],
    ["sha drift", { RENDER_GIT_COMMIT: "b".repeat(40) }],
    ["missing confirmation", { CONFIRM_STAGING_AI_ACCEPTANCE: "" }],
    ["disabled capability", { STAGING_AI_ACCEPTANCE_ENABLED: "false" }],
    ["wrong embedding version", { EXPECTED_KB_EMBEDDING_VERSION: "question-answering-v1" }],
  ])("fails closed for %s", (_name, override) => {
    expect(validateAcceptanceConfig({ ...validEnv(), ...override }).valid).toBe(false);
  });

  it("accepts the exact staging identity", () => {
    expect(validateAcceptanceConfig(validEnv())).toMatchObject({ valid: true });
  });

});

describe("staging AI acceptance evidence", () => {
  it("keeps only the safe schema and redacts forbidden values", () => {
    const rawRuntimeId = randomUUID();
    const evidence = buildSafeEvidence({
      releaseSha: SHA,
      runId: randomUUID(),
      syntheticIds: { userId: "u1", adminUserId: "a1", kbEntryId: "k1", capabilityJtis: ["j1"] },
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      status: "failed",
      sourceUrl: "https://www.who.int/news-room/fact-sheets/detail/physical-activity",
      assertions: [{ name: "failure lane", passed: false }],
      lanes: [{ name: "retry", passed: false, token: "must-not-leak", output: "raw" }],
      metricsDelta: { "kb.vector_fallbacks": 0, secret: 12 },
      cleanup: { verified: true, residue: 0, collections: { users: 0 } },
      runtimeBinding: {
        proof: "request_cohort", releaseSha: SHA,
        runtimeFingerprint: "f".repeat(64), metricsBeforeAt: new Date().toISOString(), metricsAfterAt: new Date().toISOString(),
        runtimeInstanceId: rawRuntimeId, attempts: [{
          purpose: "live_kb_provider", action: "ai_chat", mode: "observe_only", outcome: "completed",
          jti: randomUUID(), requestId: randomUUID(), releaseSha: SHA, runtimeFingerprint: "f".repeat(64),
          admittedAt: new Date().toISOString(), settledAt: new Date().toISOString(), receiptState: "settled", runtimeInstanceId: rawRuntimeId,
        }],
      },
      error: new Error("mongodb://secret token=abc raw conversation"),
    });
    expect(JSON.stringify(evidence)).not.toContain("must-not-leak");
    expect(JSON.stringify(evidence)).toEqual(expect.not.stringMatching(/secret|token=|conversation/i));
    expect(evidence).toMatchObject({ schemaVersion: 2, metricsDelta: { "kb.vector_fallbacks": 0 } });
    expect(JSON.stringify(evidence)).not.toContain(rawRuntimeId);
    expect(evidence.runtimeBinding).toMatchObject({ proof: "request_cohort", attempts: [{ receiptState: "settled" }] });
  });

  it("fails metrics closed without matching runtime identity", () => {
    expect(() => metricDelta(
      { uptimeSeconds: 10, counters: {} },
      { uptimeSeconds: 20, counters: {} },
    )).toThrowError(/stable runtime instance/);
  });

  it("blocks combined fallback even when root and variant fallback stay zero", () => {
    expect(() => assertHealthyVectorTopology({
      "kb.vector_fallbacks": 1,
      "kb.vector_root_fallbacks": 0,
      "kb.vector_variant_fallbacks": 0,
      "kb.vector_combined_fallbacks": 1,
    })).toThrowError(/combined_fallbacks|vector_fallbacks/);
  });
});

describe("staging AI browser reconciliation", () => {
  it("does not reuse an earlier assistant when a recovery has no new matching response", () => {
    const items = [{ assistantId: "initial", questionDigest: "same-question" }];
    expect(selectNewReconciledAssistant(items, 1, "same-question")).toBeNull();
  });

  it("locks the seven browser attempts into failure-then-recovery chronology", () => {
    expect(STAGING_AI_CHAT_ATTEMPT_PLAN).toEqual([
      { purpose: "live_kb_provider", mode: "observe_only" },
      { purpose: "paced_conversation", mode: "paced_response" },
      { purpose: "stop", mode: "paced_response" },
      { purpose: "provider_failure_retry", mode: "provider_failure_before_llm" },
      { purpose: "recovery_retry", mode: "observe_only" },
      { purpose: "provider_failure_edit", mode: "provider_failure_before_llm" },
      { purpose: "recovery_edit", mode: "observe_only" },
    ]);
  });
});

describe("staging AI hard-kill intent", () => {
  it("emits the complete closed recovery schema without secret-adjacent fields", () => {
    const runId = randomUUID();
    const createdAt = new Date().toISOString();
    const value = buildStagingAiRecoveryIntent({
      releaseSha: SHA,
      runId,
      marker: `htcoaching-acceptance:${runId}`,
      createdAt,
    });
    expect(value).toEqual({
      schemaVersion: 1,
      kind: "staging-ai-chat-recovery-intent",
      releaseSha: SHA,
      runId,
      marker: `htcoaching-acceptance:${runId}`,
      createdAt,
    });
    expect(JSON.stringify(value)).not.toMatch(/token|cookie|mongo|prompt|output/i);
  });
});

describe("staging AI remote mutation outcomes", () => {
  it("builds a fixture payload accepted by the real KB write guards", async () => {
    const api = { request: vi.fn(async (requestPath, options) => {
      const parsed = parseKnowledgeEntryPayload(options.body);
      expect({
        requestPath,
        method: options.method,
        parseError: parsed.error || null,
        privacy: parsed.value ? validateKnowledgeEntryPrivacy(parsed.value) : null,
        publication: parsed.value ? validateKnowledgePublication(parsed.value) : null,
      }).toEqual({
        requestPath: "/api/knowledge-base",
        method: "POST",
        parseError: null,
        privacy: { valid: true },
        publication: { valid: true },
      });
      return { data: {
        _id: String(new mongoose.Types.ObjectId()), status: "published", reviewStatus: "reviewed",
        embeddingStatus: "ready", embeddingVersion: "locked-target",
      } };
    }) };
    await createKnowledgeFixture({
      api,
      marker: `htcoaching-acceptance:${randomUUID()}`,
      sourceUrl: "https://www.who.int/news-room/fact-sheets/detail/physical-activity",
    });
    expect(api.request).toHaveBeenCalledOnce();
  });

  it.each([502, 504])("does not call HTTP %i a terminal remote outcome", async (status) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({ status, json: async () => ({}) });
    const api = createApiClient({ origin: EXPECTED_API_ORIGIN, accessToken: "synthetic", csrfToken: "csrf" });
    let failure;
    try {
      await api.request("/api/knowledge-base", { method: "POST", body: {} });
    } catch (error) {
      failure = error;
    }
    expect({ code: failure?.code, outcomeKnown: failure?.remoteOutcomeKnown === true })
      .toEqual({ code: "STAGING_AI_API_CONTRACT_FAILED", outcomeKnown: false });
    vi.restoreAllMocks();
  });

  it("recognizes only the exact pre-write privacy rejection as a known remote outcome", async () => {
    const requestId = randomUUID();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      status: 400,
      headers: { get: (name) => name.toLowerCase() === "x-request-id" ? requestId : null },
      json: async () => ({ success: false, code: "KNOWLEDGE_QUERY_SENSITIVE" }),
    });
    const api = createApiClient({ origin: EXPECTED_API_ORIGIN, accessToken: "synthetic", csrfToken: "csrf" });
    let failure;
    try {
      await api.request("/api/knowledge-base", {
        method: "POST",
        body: {},
        headers: { "X-Request-Id": requestId },
      });
    } catch (error) {
      failure = error;
    }
    expect({
      code: failure?.code,
      outcomeKnown: failure?.remoteOutcomeKnown === true,
      httpStatus: failure?.httpStatus,
      responseCode: failure?.responseCode,
      requestId: failure?.requestId,
    }).toEqual({
      code: "STAGING_AI_API_CONTRACT_FAILED",
      outcomeKnown: true,
      httpStatus: 400,
      responseCode: "KNOWLEDGE_QUERY_SENSITIVE",
      requestId,
    });
    vi.restoreAllMocks();
  });

  it.each([
    [400, "VALIDATION_ERROR", "matching"],
    [400, "KNOWLEDGE_QUERY_SENSITIVE", "mismatch"],
    [409, "KNOWLEDGE_QUERY_SENSITIVE", "matching"],
  ])("keeps HTTP %i/%s with %s request ID outcome unknown", async (status, code, requestIdMode) => {
    const requestId = randomUUID();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      status,
      headers: { get: () => requestIdMode === "matching" ? requestId : randomUUID() },
      json: async () => ({ success: false, code }),
    });
    const api = createApiClient({ origin: EXPECTED_API_ORIGIN, accessToken: "synthetic", csrfToken: "csrf" });
    let failure;
    try {
      await api.request("/api/knowledge-base", {
        method: "POST",
        body: {},
        headers: { "X-Request-Id": requestId },
      });
    } catch (error) {
      failure = error;
    }
    expect(failure?.remoteOutcomeKnown === true).toBe(false);
    vi.restoreAllMocks();
  });

  it("does not call malformed JSON from a successful mutation a terminal outcome", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      status: 201,
      json: async () => { throw new SyntaxError("malformed JSON"); },
    });
    const api = createApiClient({ origin: EXPECTED_API_ORIGIN, accessToken: "synthetic", csrfToken: "csrf" });
    let failure;
    try {
      await createKnowledgeFixture({
        api,
        marker: `htcoaching-acceptance:${randomUUID()}`,
        sourceUrl: "https://www.who.int/news-room/fact-sheets/detail/physical-activity",
      });
    } catch (error) {
      failure = error;
    }
    expect({ code: failure?.code, outcomeKnown: failure?.remoteOutcomeKnown === true })
      .toEqual({ code: "STAGING_AI_KB_FIXTURE_FAILED", outcomeKnown: false });
  });

  it("sends the exact staging client origin with a capability-bound KB search", async () => {
    const request = vi.fn().mockResolvedValue({ success: true, data: [] });
    await searchKnowledgeFixture({
      api: { request },
      clientOrigin: EXPECTED_CLIENT_URL,
      query: "  squat   cơ bản ",
      token: "synthetic-capability",
      requestId: randomUUID(),
    });
    expect(request).toHaveBeenCalledWith(
      "/api/knowledge-base/search?q=squat%20c%C6%A1%20b%E1%BA%A3n&threshold=0.75&limit=3",
      { headers: expect.objectContaining({ Origin: EXPECTED_CLIENT_URL }) },
    );
  });
});

describe("staging AI acceptance cleanup", () => {
  let memory;
  beforeAll(async () => {
    memory = await MongoMemoryServer.create();
    await mongoose.connect(memory.getUri("htcoaching_staging"));
  });
  afterAll(async () => {
    await mongoose.disconnect();
    await memory.stop();
  });

  it("rejects a settled receipt outside the exact run inventory", async () => {
    const db = mongoose.connection.db;
    const runId = randomUUID();
    const runtimeInstanceId = randomUUID();
    const attempt = {
      purpose: "kb_search_root",
      action: "kb_search",
      mode: "observe_only",
      outcome: "completed",
      jti: randomUUID(),
      requestId: randomUUID(),
    };
    const receipt = (item) => ({
      _id: item.jti,
      recordType: "capability",
      receiptVersion: 2,
      receiptState: "settled",
      runId,
      action: item.action,
      purpose: item.purpose,
      mode: item.mode,
      outcome: item.outcome,
      requestId: item.requestId,
      releaseSha: SHA,
      runtimeInstanceId,
      admittedAt: new Date(),
      settledAt: new Date(),
    });
    await db.collection("staging_ai_acceptance_claims").insertMany([
      receipt(attempt),
      receipt({ ...attempt, purpose: "kb_search_variant", jti: randomUUID(), requestId: randomUUID() }),
    ]);

    await expect(waitForSettledReceipts({
      collection: db.collection("staging_ai_acceptance_claims"),
      runId,
      attempts: [attempt],
      runtimeInstanceId,
      releaseSha: SHA,
    })).rejects.toMatchObject({ code: "STAGING_AI_REQUEST_INVENTORY_FAILED" });
  });

  it("returns receipt proof in the registered request order", async () => {
    const db = mongoose.connection.db;
    const runId = randomUUID();
    const runtimeInstanceId = randomUUID();
    const attempts = ["kb_search_root", "kb_search_variant"].map((purpose) => ({
      purpose,
      action: "kb_search",
      mode: "observe_only",
      outcome: "completed",
      jti: randomUUID(),
      requestId: randomUUID(),
    }));
    const documents = [...attempts].reverse().map((item) => ({
      _id: item.jti,
      recordType: "capability",
      receiptVersion: 2,
      receiptState: "settled",
      runId,
      action: item.action,
      purpose: item.purpose,
      mode: item.mode,
      outcome: item.outcome,
      requestId: item.requestId,
      releaseSha: SHA,
      runtimeInstanceId,
      admittedAt: new Date(),
      settledAt: new Date(),
    }));
    await db.collection("staging_ai_acceptance_claims").insertMany(documents);

    const result = await waitForSettledReceipts({
      collection: db.collection("staging_ai_acceptance_claims"),
      runId,
      attempts,
      runtimeInstanceId,
      releaseSha: SHA,
    });
    expect(result.map((item) => item.purpose)).toEqual(["kb_search_root", "kb_search_variant"]);
  });

  it("deletes only registered exact IDs and proves zero residue", async () => {
    const db = mongoose.connection.db;
    const runId = randomUUID();
    const userId = new mongoose.Types.ObjectId();
    const otherUserId = new mongoose.Types.ObjectId();
    const kbId = new mongoose.Types.ObjectId();
    await db.collection("users").insertMany([
      { _id: userId, email: `${userId}@example.invalid` },
      { _id: otherUserId, email: `${otherUserId}@example.invalid` },
    ]);
    await db.collection("knowledgeentries").insertOne({ _id: kbId });
    await db.collection("chatconversations").insertMany([{ userId }, { userId: otherUserId }]);
    await db.collection("staging_ai_acceptance_claims").insertMany([
      { _id: runId, recordType: "run", runId, state: "revoked" },
      { _id: "owned", runId, receiptState: "settled", expiresAt: new Date(Date.now() - 1) },
      { _id: "other", runId: randomUUID() },
    ]);

    const exact = createExactCleanup({ db, runId });
    exact.registerUser(userId);
    exact.registerKnowledgeEntry(kbId);
    exact.registerCapabilityJti("owned");
    await exact.cleanup();

    expect({ report: await exact.verify(), other: await db.collection("users").countDocuments({ _id: otherUserId }) })
      .toEqual({ report: expect.objectContaining({ residue: 0 }), other: 1 });
  });

  it("retains the tombstone and actors when a capability appears after inventory", async () => {
    const db = mongoose.connection.db;
    const runId = randomUUID();
    const userId = new mongoose.Types.ObjectId();
    await db.collection("users").insertOne({
      _id: userId,
      email: `${userId}@example.invalid`,
    });
    await db.collection("staging_ai_acceptance_claims").insertMany([
      { _id: runId, recordType: "run", runId, state: "revoked" },
      {
        _id: "registered",
        recordType: "capability",
        runId,
        receiptState: "settled",
        expiresAt: new Date(Date.now() - 1),
      },
      {
        _id: "late-extra",
        recordType: "capability",
        runId,
        receiptState: "settled",
        expiresAt: new Date(Date.now() - 1),
      },
    ]);
    const exact = createExactCleanup({ db, runId });
    exact.registerUser(userId);
    exact.registerCapabilityJti("registered");

    await expect(exact.cleanup()).rejects.toMatchObject({
      code: "STAGING_AI_CLEANUP_UNEXPECTED_CAPABILITY",
    });
    expect({
      actor: await db.collection("users").countDocuments({ _id: userId }),
      tombstone: await db.collection("staging_ai_acceptance_claims")
        .countDocuments({ _id: runId, state: "revoked" }),
      lateReceipt: await db.collection("staging_ai_acceptance_claims")
        .countDocuments({ _id: "late-extra" }),
    }).toEqual({ actor: 1, tombstone: 1, lateReceipt: 1 });
  });

  it("refuses cleanup before every exact receipt is terminal", async () => {
    const db = mongoose.connection.db;
    const runId = randomUUID();
    await db.collection("staging_ai_acceptance_claims").insertMany([
      { _id: runId, recordType: "run", runId, state: "revoked" },
      { _id: "unsettled", runId, receiptState: "admitted", expiresAt: new Date(Date.now() - 1) },
    ]);
    const exact = createExactCleanup({ db, runId, settlementWaitMs: 0 });
    exact.registerCapabilityJti("unsettled");
    await expect(exact.cleanup()).rejects.toMatchObject({ code: "STAGING_AI_RECOVERY_ADMITTED_UNKNOWN" });
    expect(await db.collection("staging_ai_acceptance_claims").countDocuments({ _id: "unsettled" })).toBe(1);
  });

  it("retains actors and tombstone when admission wins the atomic capability deletion race", async () => {
    const db = mongoose.connection.db;
    const runId = randomUUID();
    const actor = new mongoose.Types.ObjectId();
    const jti = randomUUID();
    await db.collection("users").insertOne({ _id: actor });
    await db.collection("staging_ai_acceptance_claims").insertOne({
      _id: jti, recordType: "capability", runId, receiptState: "issued", expiresAt: new Date(0),
    });
    const raceDb = {
      listCollections: (...args) => db.listCollections(...args),
      collection: (name) => {
        const collection = db.collection(name);
        if (name !== "staging_ai_acceptance_claims") return collection;
        return new Proxy(collection, {
          get: (target, property) => property === "deleteMany" ? async (...args) => {
            await target.updateOne({ _id: jti }, { $set: { receiptState: "admitted" } });
            return target.deleteMany(...args);
          } : typeof target[property] === "function" ? target[property].bind(target) : target[property],
        });
      },
    };
    const exact = createExactCleanup({ db: raceDb, runId });
    exact.registerUser(actor);
    exact.registerCapabilityJti(jti, 0);
    await expect(exact.cleanup()).rejects.toMatchObject({ code: "STAGING_AI_RECOVERY_ADMITTED_UNKNOWN" });
    expect({
      actor: await db.collection("users").countDocuments({ _id: actor }),
      receipt: await db.collection("staging_ai_acceptance_claims").countDocuments({ _id: jti, receiptState: "admitted" }),
      tombstone: await db.collection("staging_ai_acceptance_claims").countDocuments({ _id: runId, state: "revoked" }),
    }).toEqual({ actor: 1, receipt: 1, tombstone: 1 });
  });

  it("waits through the latest exact capability expiry before removing settled receipts", async () => {
    const db = mongoose.connection.db;
    const runId = randomUUID();
    const now = Date.now();
    const waits = [];
    await db.collection("staging_ai_acceptance_claims").insertMany([
      { _id: runId, recordType: "run", runId, state: "revoked" },
      { _id: "expiry-one", runId, receiptState: "settled", expiresAt: new Date(now + 10) },
      { _id: "expiry-two", runId, receiptState: "settled", expiresAt: new Date(now + 40) },
    ]);
    const exact = createExactCleanup({ db, runId, expirySkewMs: 0,
      now: () => now, wait: async (ms) => { waits.push(ms); } });
    exact.registerCapabilityJti("expiry-one");
    exact.registerCapabilityJti("expiry-two");
    await exact.cleanup();
    expect(waits).toEqual([40]);
    expect(await db.collection("staging_ai_acceptance_claims").countDocuments({ runId })).toBe(0);
  });

  it("rechecks receipt state after expiry before deleting a raced admission", async () => {
    const db = mongoose.connection.db;
    const runId = randomUUID();
    let tick = 0;
    const waits = [];
    await db.collection("staging_ai_acceptance_claims").insertMany([
      { _id: runId, recordType: "run", runId, state: "revoked" },
      { _id: "raced-admission", recordType: "capability", runId,
        receiptState: "issued", expiresAt: new Date(10) },
    ]);
    const exact = createExactCleanup({
      db,
      runId,
      settlementWaitMs: 50,
      settlementPollMs: 1,
      expirySkewMs: 0,
      now: () => tick,
      wait: async (ms) => {
        waits.push(ms);
        tick += ms;
        await db.collection("staging_ai_acceptance_claims").updateOne(
          { _id: "raced-admission" },
          { $set: { receiptState: tick === 10 ? "admitted" : "settled" } },
        );
      },
    });
    exact.registerCapabilityJti("raced-admission", 10);
    await exact.cleanup();
    expect({ waits, report: await exact.verify() }).toEqual({
      waits: [10, 1],
      report: expect.objectContaining({ residue: 0 }),
    });
  });

  it("cleans an issued capability that the runtime rejected before admission", async () => {
    const db = mongoose.connection.db;
    const runId = randomUUID();
    const userId = new mongoose.Types.ObjectId();
    await db.collection("users").insertOne({ _id: userId, email: `${userId}@example.invalid` });
    await db.collection("staging_ai_acceptance_claims").insertMany([
      { _id: runId, recordType: "run", runId, state: "revoked" },
      { _id: "issued-only", runId, receiptState: "issued", expiresAt: new Date(Date.now() - 1) },
    ]);
    const exact = createExactCleanup({ db, runId });
    exact.registerUser(userId);
    exact.registerCapabilityJti("issued-only");
    await exact.cleanup();
    expect(await exact.verify()).toMatchObject({ residue: 0 });
  });

  it("cleans exact fixtures when capability reservation has an unknown write outcome", async () => {
    const db = mongoose.connection.db;
    const runId = randomUUID();
    const userId = new mongoose.Types.ObjectId();
    await db.collection("users").insertOne({ _id: userId, email: `${userId}@example.invalid` });
    await db.collection("staging_ai_acceptance_claims").insertOne({
      _id: runId, recordType: "run", runId, state: "revoked",
    });
    const exact = createExactCleanup({ db, runId });
    exact.registerUser(userId);
    exact.registerCapabilityJti("missing-reservation", Date.now() - 1);
    await exact.cleanup();
    expect(await exact.verify()).toMatchObject({ residue: 0 });
  });

  it("discovers a response-lost KB id only through its pre-registered exact question", async () => {
    const db = mongoose.connection.db;
    const exactQuestion = `response-lost-${randomUUID()}`;
    const exact = createExactCleanup({ db, runId: randomUUID() });
    exact.registerKnowledgeQuestion(exactQuestion);
    await db.collection("knowledgeentries").insertMany([
      { normalizedQuestion: exactQuestion },
      { normalizedQuestion: `${exactQuestion}-unregistered` },
    ]);
    await exact.cleanup();
    expect(await db.collection("knowledgeentries").countDocuments({})).toBe(1);
  });

  it("waits through an outcome-unknown window before discovering a late KB write", async () => {
    const db = mongoose.connection.db;
    const exactQuestion = `late-${randomUUID()}`;
    const exact = createExactCleanup({ db, runId: randomUUID(), unknownOutcomeWaitMs: 80 });
    exact.registerKnowledgeQuestion(exactQuestion);
    exact.markMutationStart();
    setTimeout(() => {
      void db.collection("knowledgeentries").insertOne({ normalizedQuestion: exactQuestion });
    }, 30);
    await exact.cleanup();
    await expect(exact.verify()).rejects.toThrowError(/terminal remote mutation outcome/);
    expect(await db.collection("knowledgeentries").countDocuments({ normalizedQuestion: exactQuestion })).toBe(0);
  });
});
