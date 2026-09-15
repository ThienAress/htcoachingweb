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
  validateTopologyEvidence,
} from "../stagingAiChatAcceptance.config.js";
import { assertHealthyVectorTopology, buildSafeEvidence, metricDelta } from "../stagingAiChatAcceptance.evidence.js";
import { createExactCleanup } from "../stagingAiChatAcceptance.cleanup.js";
import { selectNewReconciledAssistant } from "../stagingAiChatAcceptance.browser.js";
import { runStagingAiChatAcceptance } from "../stagingAiChatAcceptance.js";
import { createApiClient, createKnowledgeFixture } from "../stagingAiChatAcceptance.http.js";

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
  STAGING_RENDER_TOPOLOGY_EVIDENCE: "topology.json",
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

  it("accepts only fresh closed single-instance topology evidence", () => {
    const now = Date.now();
    expect(validateTopologyEvidence({
      schemaVersion: 1,
      kind: "render-single-instance-topology",
      releaseSha: SHA,
      checkedAt: new Date(now - 1_000).toISOString(),
      serviceTopology: { configuredInstances: 1, currentInstances: 1 },
    }, SHA, { now })).toMatchObject({ topology: "single_instance" });
  });

  it("rejects stale or multi-instance topology evidence", () => {
    expect(() => validateTopologyEvidence({
      schemaVersion: 1,
      kind: "render-single-instance-topology",
      releaseSha: SHA,
      checkedAt: new Date(Date.now() - 16 * 60_000).toISOString(),
      serviceTopology: { configuredInstances: 1, currentInstances: 2 },
    }, SHA)).toThrowError(/not single-instance/);
  });

  it("writes sanitized failure evidence when topology initialization fails safely", async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "ac009-evidence-"));
    const topology = path.join(directory, "topology.json");
    const output = path.join(directory, "evidence.json");
    const recoveryOutput = path.join(directory, "recovery.json");
    await fs.writeFile(topology, "{}\n");
    await expect(runStagingAiChatAcceptance({ env: {
      ...validEnv(),
      JWT_SECRET: "synthetic.jwt.fixture.value.for.tests",
      ADMIN_EMAIL: "admin@example.invalid",
      STAGING_RENDER_TOPOLOGY_EVIDENCE: topology,
      STAGING_AI_ACCEPTANCE_OUTPUT: output,
      STAGING_AI_ACCEPTANCE_RECOVERY_OUTPUT: recoveryOutput,
    } })).rejects.toThrowError(/topology evidence/i);
    const evidence = JSON.parse(await fs.readFile(output, "utf8"));
    const recovery = JSON.parse(await fs.readFile(recoveryOutput, "utf8"));
    expect({ evidence, recovery }).toMatchObject({
      evidence: { status: "failed", error: { code: "STAGING_AI_TOPOLOGY_INCONCLUSIVE" } },
      recovery: {
        kind: "staging-ai-chat-recovery-intent",
        releaseSha: SHA,
        runId: evidence.runId,
      },
    });
    await fs.rm(directory, { recursive: true, force: true });
  });
});

describe("staging AI acceptance evidence", () => {
  it("keeps only the safe schema and redacts forbidden values", () => {
    const evidence = buildSafeEvidence({
      releaseSha: SHA,
      runId: randomUUID(),
      syntheticIds: { userId: "u1", kbEntryId: "k1", capabilityJtis: ["j1"] },
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      status: "failed",
      sourceUrl: "https://www.who.int/news-room/fact-sheets/detail/physical-activity",
      assertions: [{ name: "failure lane", passed: false }],
      lanes: [{ name: "retry", passed: false, token: "must-not-leak", output: "raw" }],
      metricsDelta: { "kb.vector_fallbacks": 0, secret: 12 },
      cleanup: { verified: true, residue: 0, collections: { users: 0 } },
      error: new Error("mongodb://secret token=abc raw conversation"),
    });
    expect(JSON.stringify(evidence)).not.toContain("must-not-leak");
    expect(JSON.stringify(evidence)).toEqual(expect.not.stringMatching(/secret|token=|conversation/i));
    expect(evidence.metricsDelta).toEqual({ "kb.vector_fallbacks": 0 });
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
});

describe("staging AI remote mutation outcomes", () => {
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
      { _id: "owned", runId },
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
