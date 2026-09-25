import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  recoverStagingAiChatAcceptance,
  runRecoveryCli,
  validateRecoveryConfig,
  writeRecoveryReport,
} from "../stagingAiChatAcceptance.recover.js";
import { knowledgeFixtureQueries } from "../stagingAiChatAcceptance.http.js";
import { normalizeKnowledgeQuestion } from "../../utils/knowledgeBase.js";

const RUN_ID = "69095c11-7fc9-4047-9414-1b39a2d188e2";
const SHA = "aa2d031d4420ba96d3e34e6fa87fba23e246755a";
let memory;
let db;
let mongoUri;

const intent = () => ({ schemaVersion: 1, kind: "staging-ai-chat-recovery-intent", releaseSha: SHA, runId: RUN_ID, marker: `htcoaching-acceptance:${RUN_ID}`, createdAt: "2026-09-15T11:07:14.376Z" });
const env = () => ({ APP_ENV: "staging", MONGO_URI: mongoUri, CLIENT_URL: "https://staging--htcoachingweb.netlify.app", PUBLIC_API_ORIGIN: "https://htcoachingweb-staging.onrender.com", RELEASE_SHA: SHA, RENDER_GIT_COMMIT: SHA, CONFIRM_STAGING_AI_ACCEPTANCE_RECOVERY: "yes", GITHUB_SHA: "b".repeat(40), GITHUB_ACTOR: "ThienAress", STAGING_AI_SOURCE_WORKFLOW_RUN_ID: "34961418907" });
const capability = () => ({
  STAGING_AI_ACCEPTANCE_COLLECTION: "staging_ai_acceptance_claims",
  revokeStagingAiAcceptanceRun: async (runId) => db.collection("staging_ai_acceptance_claims").updateOne(
    { _id: runId, recordType: "run", runId }, { $setOnInsert: { state: "revoked", revokedAt: new Date() } }, { upsert: true },
  ),
});
const receipt = (overrides = {}) => ({
  _id: "650e8400-e29b-41d4-a716-446655440000",
  recordType: "capability",
  receiptVersion: 2,
  runId: RUN_ID,
  actorId: new mongoose.Types.ObjectId(),
  receiptState: "issued",
  expiresAt: new Date(0),
  releaseSha: SHA,
  action: "ai_chat",
  purpose: "live_kb_provider",
  mode: "observe_only",
  ...overrides,
});
const fastRecovery = () => ({
  recoveryQuiescenceMs: 1,
  postCleanupQuiescenceMs: 1,
  wait: async () => {},
});
const fixtureRejectionEvidence = (overrides = {}) => ({
  schemaVersion: 1,
  kind: "staging-ai-fixture-rejection-evidence",
  proofMethod: "operator_attested_render_application_log",
  provider: "render",
  releaseSha: SHA,
  recoveryCodeSha: "b".repeat(40),
  runId: RUN_ID,
  sourceWorkflowRunId: 34961418907,
  operatorActor: "ThienAress",
  requestId: "1cba3e75-db0d-40dc-aa88-186ab6901fe9",
  event: "http.request",
  method: "POST",
  route: "/api/knowledge-base/",
  status: 400,
  observedAt: "2026-09-15T11:07:19.008Z",
  providerServiceDigest: createHash("sha256").update("srv-d9g8em61a83c73b4l61g").digest("hex"),
  providerDeployIdDigest: createHash("sha256").update("dep-dakiao1594qs73e61jkg").digest("hex"),
  providerLogIdDigest: createHash("sha256").update("log-exact").digest("hex"),
  providerMessageDigest: createHash("sha256").update(JSON.stringify({
    timestamp: "2026-09-15T11:07:19.008Z", level: "info", service: "htcoaching-api",
    event: "http.request", requestId: "1cba3e75-db0d-40dc-aa88-186ab6901fe9",
    traceId: "6984831b057a5acbc7262ea91db652d7", method: "POST", route: "/api/knowledge-base/",
    status: 400, durationMs: 1009.28,
  })).digest("hex"),
  verified: true,
  ...overrides,
});
const seedFixtureJournal = async () => db.collection("staging_ai_acceptance_claims").insertOne({
  _id: `${RUN_ID}:fixture-create`, recordType: "fixture_create", journalVersion: 1,
  runId: RUN_ID, releaseSha: SHA, actorId: String(new mongoose.Types.ObjectId()),
  questionDigest: createHash("sha256").update(normalizeKnowledgeQuestion(knowledgeFixtureQueries(intent().marker).question)).digest("hex"),
  state: "settled", startedAt: new Date(0), settledAt: new Date(1), knowledgeEntryId: String(new mongoose.Types.ObjectId()),
});

beforeAll(async () => {
  memory = await MongoMemoryServer.create();
  mongoUri = memory.getUri("htcoaching_staging");
  await mongoose.connect(mongoUri);
  db = mongoose.connection.db;
});
beforeEach(async () => {
  const names = await db.listCollections({}, { nameOnly: true }).toArray();
  await Promise.all(names.map(({ name }) => db.collection(name).deleteMany({})));
});
afterAll(async () => { await mongoose.disconnect(); await memory.stop(); });

describe("AC-009 hard-kill recovery", () => {
  beforeEach(seedFixtureJournal);
  it("keeps tombstone and actors when a fixture POST has no durable terminal proof", async () => {
    const actor = new mongoose.Types.ObjectId();
    await db.collection("users").insertOne({
      _id: actor, email: `ac009-admin.${RUN_ID}@example.invalid`, role: "admin",
    });
    await db.collection("staging_ai_acceptance_claims").updateOne({ _id: `${RUN_ID}:fixture-create` }, {
      $set: { state: "pending", settledAt: null, knowledgeEntryId: null },
    });
    await expect(recoverStagingAiChatAcceptance({
      env: env(), intent: intent(), db, capability: capability(), ...fastRecovery(),
    })).rejects.toMatchObject({ code: "STAGING_AI_RECOVERY_FIXTURE_UNKNOWN" });
    expect(await db.collection("users").findOne({ _id: actor })).toBeTruthy();
    expect(await db.collection("staging_ai_acceptance_claims")
      .findOne({ _id: RUN_ID, state: "revoked" })).toBeTruthy();
  });

  it("repairs a v2 pending journal when exactly one marker-bound published entry proves creation", async () => {
    const actor = new mongoose.Types.ObjectId();
    const { question } = knowledgeFixtureQueries(intent().marker);
    const normalizedQuestion = normalizeKnowledgeQuestion(question);
    await db.collection("users").insertOne({
      _id: actor, email: `ac009-admin.${RUN_ID}@example.invalid`, role: "admin",
    });
    await db.collection("staging_ai_acceptance_claims").replaceOne({ _id: `${RUN_ID}:fixture-create` }, {
      _id: `${RUN_ID}:fixture-create`, recordType: "fixture_create", journalVersion: 2,
      runId: RUN_ID, releaseSha: SHA, actorId: String(actor),
      questionDigest: createHash("sha256").update(normalizedQuestion).digest("hex"),
      requestId: "1cba3e75-db0d-40dc-aa88-186ab6901fe9", payloadDigest: "c".repeat(64),
      state: "pending", outcome: null, startedAt: new Date("2026-09-15T00:00:04.000Z"),
      settledAt: null, knowledgeEntryId: null, responseStatus: null, responseCode: null,
    }, { upsert: true });
    const entryId = new mongoose.Types.ObjectId();
    await db.collection("knowledgeentries").insertOne({
      _id: entryId, normalizedQuestion, status: "published", reviewStatus: "reviewed",
      embeddingStatus: "failed",
    });
    const report = await recoverStagingAiChatAcceptance({
      env: env(), intent: intent(), db, capability: capability(), ...fastRecovery(),
    });
    expect(report).toMatchObject({ verified: true, residue: 0, alreadyClean: false });
    expect(await db.collection("users").findOne({ _id: actor })).toBeNull();
    expect(await db.collection("knowledgeentries").findOne({ _id: entryId })).toBeNull();
  });

  it("recovers a legacy pending journal only with exact operator-attested Render rejection evidence", async () => {
    const actor = new mongoose.Types.ObjectId();
    await db.collection("users").insertOne({
      _id: actor, email: `ac009-admin.${RUN_ID}@example.invalid`, role: "admin",
    });
    await db.collection("staging_ai_acceptance_claims").updateOne({ _id: `${RUN_ID}:fixture-create` }, {
      $set: {
        actorId: String(actor), state: "pending", startedAt: new Date("2026-09-15T11:07:14.376Z"),
        settledAt: null, knowledgeEntryId: null,
      },
    });
    const report = await recoverStagingAiChatAcceptance({
      env: env(), intent: intent(), db, capability: capability(),
      fixtureRejectionEvidence: fixtureRejectionEvidence(), ...fastRecovery(),
    });
    expect({
      report,
      actor: await db.collection("users").findOne({ _id: actor }),
      journal: await db.collection("staging_ai_acceptance_claims").findOne({ _id: `${RUN_ID}:fixture-create` }),
    }).toEqual({
      report: expect.objectContaining({
        schemaVersion: 2,
        verified: true,
        residue: 0,
        alreadyClean: false,
        fixtureRejectionProof: {
          proofMethod: "operator_attested_render_application_log",
          evidenceDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      }),
      actor: null,
      journal: null,
    });
  });

  it("does not delete legacy residue when rejection evidence is cross-run or outside the journal window", async () => {
    const actor = new mongoose.Types.ObjectId();
    await db.collection("users").insertOne({
      _id: actor, email: `ac009-admin.${RUN_ID}@example.invalid`, role: "admin",
    });
    await db.collection("staging_ai_acceptance_claims").updateOne({ _id: `${RUN_ID}:fixture-create` }, {
      $set: {
        actorId: String(actor), state: "pending", startedAt: new Date("2026-09-15T11:07:14.376Z"),
        settledAt: null, knowledgeEntryId: null,
      },
    });
    await expect(recoverStagingAiChatAcceptance({
      env: env(), intent: intent(), db, capability: capability(),
      fixtureRejectionEvidence: fixtureRejectionEvidence({ observedAt: "2026-09-15T00:02:05.000Z" }),
      ...fastRecovery(),
    })).rejects.toMatchObject({ code: "STAGING_AI_FIXTURE_REJECTION_EVIDENCE_INVALID" });
    expect(await db.collection("users").findOne({ _id: actor })).toBeTruthy();
  });

  it("recovers a durable v2 terminal rejection without inventing a Knowledge Entry ID", async () => {
    const actor = new mongoose.Types.ObjectId();
    await db.collection("users").insertOne({
      _id: actor, email: `ac009-admin.${RUN_ID}@example.invalid`, role: "admin",
    });
    await db.collection("staging_ai_acceptance_claims").replaceOne({ _id: `${RUN_ID}:fixture-create` }, {
      _id: `${RUN_ID}:fixture-create`, recordType: "fixture_create", journalVersion: 2,
      runId: RUN_ID, releaseSha: SHA, actorId: String(actor),
      questionDigest: createHash("sha256").update(normalizeKnowledgeQuestion(knowledgeFixtureQueries(intent().marker).question)).digest("hex"),
      requestId: "1cba3e75-db0d-40dc-aa88-186ab6901fe9", payloadDigest: "c".repeat(64),
      state: "terminal", outcome: "rejected", startedAt: new Date("2026-09-15T00:00:04.000Z"),
      settledAt: new Date("2026-09-15T00:00:05.000Z"), knowledgeEntryId: null,
      responseStatus: 400, responseCode: "KNOWLEDGE_QUERY_SENSITIVE",
    });
    const report = await recoverStagingAiChatAcceptance({
      env: env(), intent: intent(), db, capability: capability(), ...fastRecovery(),
    });
    expect(report).toMatchObject({ verified: true, residue: 0, alreadyClean: false });
  });

  it.each([
    "1cba3e75-db0d-40dc-aa88-186ab6901fe9",
    "650e8400-e29b-41d4-a716-446655440000",
  ])("retains a v2 pending journal even with attested rejection request %s", async (requestId) => {
    const actor = new mongoose.Types.ObjectId();
    await db.collection("users").insertOne({
      _id: actor, email: `ac009-admin.${RUN_ID}@example.invalid`, role: "admin",
    });
    await db.collection("staging_ai_acceptance_claims").replaceOne({ _id: `${RUN_ID}:fixture-create` }, {
      _id: `${RUN_ID}:fixture-create`, recordType: "fixture_create", journalVersion: 2,
      runId: RUN_ID, releaseSha: SHA, actorId: String(actor),
      questionDigest: createHash("sha256").update(normalizeKnowledgeQuestion(knowledgeFixtureQueries(intent().marker).question)).digest("hex"),
      requestId: "1cba3e75-db0d-40dc-aa88-186ab6901fe9", payloadDigest: "c".repeat(64),
      state: "pending", outcome: null, startedAt: new Date("2026-09-15T00:00:04.000Z"),
      settledAt: null, knowledgeEntryId: null, responseStatus: null, responseCode: null,
    });
    await expect(recoverStagingAiChatAcceptance({
      env: env(), intent: intent(), db, capability: capability(),
      fixtureRejectionEvidence: fixtureRejectionEvidence({ requestId }), ...fastRecovery(),
    })).rejects.toMatchObject({ code: "STAGING_AI_RECOVERY_FIXTURE_UNKNOWN" });
    expect({
      actor: await db.collection("users").findOne({ _id: actor }),
      journal: await db.collection("staging_ai_acceptance_claims").findOne({ _id: `${RUN_ID}:fixture-create` }),
      tombstone: await db.collection("staging_ai_acceptance_claims").findOne({ _id: RUN_ID, state: "revoked" }),
    }).toMatchObject({ actor: { _id: actor }, journal: { state: "pending" }, tombstone: { state: "revoked" } });
  });

  it("rejects invalid intent and SHA before any delete", async () => {
    const bad = { ...intent(), releaseSha: "bad" };
    expect(validateRecoveryConfig(env(), bad).valid).toBe(false);
    await db.collection("users").insertOne({ email: "unrelated@example.invalid" });
    await expect(recoverStagingAiChatAcceptance({ env: env(), intent: { ...intent(), marker: "wrong" }, db, capability: capability() })).rejects.toMatchObject({ code: "STAGING_AI_RECOVERY_INTENT_INVALID" });
    await expect(recoverStagingAiChatAcceptance({ env: { ...env(), RELEASE_SHA: "b".repeat(40) }, intent: intent(), db, capability: capability() })).rejects.toMatchObject({ code: "STAGING_AI_RECOVERY_REJECTED" });
    expect(await db.collection("users").countDocuments({ email: "unrelated@example.invalid" })).toBe(1);
  });

  it("recovers only exact synthetic ownership and produces a sanitized report", async () => {
    const actor = new mongoose.Types.ObjectId();
    const foreign = new mongoose.Types.ObjectId();
    const { question } = knowledgeFixtureQueries(intent().marker);
    await db.collection("users").insertMany([{ _id: actor, email: `ac009.${RUN_ID}@example.invalid`, role: "user" }, { _id: foreign, email: "unrelated@example.invalid", role: "user" }]);
    await db.collection("knowledgeentries").insertMany([{ normalizedQuestion: normalizeKnowledgeQuestion(question) }, { normalizedQuestion: "unrelated question" }]);
    await db.collection("staging_ai_acceptance_claims").insertOne(receipt({ actorId: actor, expiresAt: new Date(0) }));
    const report = await recoverStagingAiChatAcceptance({ env: env(), intent: intent(), db,
      capability: capability(), cleanupOptions: { expirySkewMs: 0 }, ...fastRecovery() });
    expect(report).toEqual(expect.objectContaining({ verified: true, residue: 0, recoveredReceiptCount: 1 }));
    expect(JSON.stringify(report)).not.toContain(mongoUri);
    expect(await db.collection("users").findOne({ _id: foreign })).toBeTruthy();
    expect(await db.collection("knowledgeentries").countDocuments({ normalizedQuestion: "unrelated question" })).toBe(1);
  });

  it("is idempotent after a clean recovery", async () => {
    const report = await recoverStagingAiChatAcceptance({ env: env(), intent: intent(), db,
      capability: capability(), cleanupOptions: { expirySkewMs: 0 }, ...fastRecovery() });
    expect(report).toEqual(expect.objectContaining({ verified: true, residue: 0, alreadyClean: true }));
    const repeated = await recoverStagingAiChatAcceptance({ env: env(), intent: intent(), db,
      capability: capability(), priorVerifiedReport: report, cleanupOptions: { expirySkewMs: 0 }, ...fastRecovery() });
    expect(repeated).toMatchObject({ verified: true, residue: 0, alreadyClean: true });
  });

  it("preserves an attested v2 fixture proof from a trusted prior report", async () => {
    const prior = {
      schemaVersion: 2,
      kind: "staging-ai-chat-recovery-report",
      releaseSha: SHA,
      runId: RUN_ID,
      recoveredReceiptCount: 0,
      alreadyClean: true,
      residue: 0,
      verified: true,
      fixtureRejectionProof: {
        proofMethod: "operator_attested_render_application_log",
        evidenceDigest: "f".repeat(64),
      },
    };
    await db.collection("staging_ai_acceptance_claims").deleteOne({ _id: `${RUN_ID}:fixture-create` });
    const repeated = await recoverStagingAiChatAcceptance({ env: env(), intent: intent(), db,
      capability: capability(), priorVerifiedReport: prior, cleanupOptions: { expirySkewMs: 0 }, ...fastRecovery() });
    expect(repeated.fixtureRejectionProof).toEqual(prior.fixtureRejectionProof);
  });

  it("refuses missing fixture proof without an exact prior verified recovery report", async () => {
    await db.collection("staging_ai_acceptance_claims").deleteOne({ _id: `${RUN_ID}:fixture-create` });
    await expect(recoverStagingAiChatAcceptance({ env: env(), intent: intent(), db,
      capability: capability(), ...fastRecovery() }))
      .rejects.toMatchObject({ code: "STAGING_AI_RECOVERY_FIXTURE_UNKNOWN" });
  });

  it("recovers hard-kill residue created before capability registration", async () => {
    const actor = new mongoose.Types.ObjectId();
    await db.collection("users").insertOne({ _id: actor, email: `ac009.${RUN_ID}@example.invalid`, role: "user" });
    const report = await recoverStagingAiChatAcceptance({ env: env(), intent: intent(), db,
      capability: capability(), cleanupOptions: { expirySkewMs: 0 }, ...fastRecovery() });
    expect(report).toEqual(expect.objectContaining({ verified: true, residue: 0 }));
    expect(await db.collection("users").findOne({ _id: actor })).toBeNull();
  });

  it("waits for late KB and capability writes, then inventories them before cleanup", async () => {
    const actor = new mongoose.Types.ObjectId();
    const { question } = knowledgeFixtureQueries(intent().marker);
    let waits = 0;
    const report = await recoverStagingAiChatAcceptance({
      env: env(),
      intent: intent(),
      db,
      capability: capability(),
      cleanupOptions: { expirySkewMs: 0 },
      recoveryQuiescenceMs: 1,
      postCleanupQuiescenceMs: 1,
      wait: async () => {
        waits += 1;
        if (waits === 1) {
          await db.collection("users").insertOne({
            _id: actor,
            email: `ac009.${RUN_ID}@example.invalid`,
            role: "user",
          });
          await db.collection("knowledgeentries").insertOne({
            normalizedQuestion: normalizeKnowledgeQuestion(question),
          });
          await db.collection("staging_ai_acceptance_claims").insertOne(receipt({ actorId: actor }));
        }
      },
    });
    expect(report).toMatchObject({ verified: true, residue: 0, recoveredReceiptCount: 1 });
  });

  it("keeps the tombstone while a second scan catches post-cleanup writes", async () => {
    const actor = new mongoose.Types.ObjectId();
    let waits = 0;
    const report = await recoverStagingAiChatAcceptance({
      env: env(),
      intent: intent(),
      db,
      capability: capability(),
      cleanupOptions: { expirySkewMs: 0 },
      recoveryQuiescenceMs: 1,
      postCleanupQuiescenceMs: 1,
      wait: async () => {
        waits += 1;
        if (waits === 2) {
          expect(await db.collection("staging_ai_acceptance_claims")
            .findOne({ _id: RUN_ID, state: "revoked" })).toBeTruthy();
          await db.collection("users").insertOne({
            _id: actor,
            email: `ac009.${RUN_ID}@example.invalid`,
            role: "user",
          });
          await db.collection("staging_ai_acceptance_claims").insertOne(receipt({ actorId: actor }));
        }
      },
    });
    expect(report).toMatchObject({ verified: true, residue: 0, recoveredReceiptCount: 1 });
    expect(await db.collection("staging_ai_acceptance_claims").findOne({ _id: RUN_ID })).toBeNull();
  });

  it("rejects receipts with a different release or action-role binding without deleting data", async () => {
    const actor = new mongoose.Types.ObjectId();
    await db.collection("users").insertOne({
      _id: actor,
      email: `ac009.${RUN_ID}@example.invalid`,
      role: "user",
    });
    await db.collection("staging_ai_acceptance_claims").insertOne(receipt({
      actorId: actor,
      releaseSha: "b".repeat(40),
    }));
    await expect(recoverStagingAiChatAcceptance({
      env: env(), intent: intent(), db, capability: capability(), ...fastRecovery(),
    })).rejects.toMatchObject({ code: "STAGING_AI_RECOVERY_RECEIPT_INVALID" });
    expect(await db.collection("users").findOne({ _id: actor })).toBeTruthy();

    await db.collection("staging_ai_acceptance_claims").deleteOne({ recordType: "capability" });
    await db.collection("staging_ai_acceptance_claims").insertOne(receipt({
      actorId: actor,
      action: "kb_search",
      purpose: "kb_search_root",
      mode: "observe_only",
    }));
    await expect(recoverStagingAiChatAcceptance({
      env: env(), intent: intent(), db, capability: capability(), ...fastRecovery(),
    })).rejects.toMatchObject({ code: "STAGING_AI_RECOVERY_OWNERSHIP_INVALID" });
    expect(await db.collection("users").findOne({ _id: actor })).toBeTruthy();
  });

  it("reuses only a valid immutable report for an idempotent CLI output path", async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "ac009-recovery-report-"));
    const filename = path.join(directory, "report.json");
    const first = {
      schemaVersion: 1,
      kind: "staging-ai-chat-recovery-report",
      releaseSha: SHA,
      runId: RUN_ID,
      recoveredReceiptCount: 1,
      alreadyClean: false,
      residue: 0,
      verified: true,
    };
    try {
      await writeRecoveryReport(filename, first);
      const persisted = await writeRecoveryReport(filename, {
        ...first,
        recoveredReceiptCount: 0,
        alreadyClean: true,
      });
      expect(persisted).toEqual(first);
      await expect(writeRecoveryReport(filename, { ...first, runId: "650e8400-e29b-41d4-a716-446655440000" }))
        .rejects.toMatchObject({ code: "STAGING_AI_RECOVERY_REPORT_INVALID" });
      const v2Filename = path.join(directory, "v2-report.json");
      await expect(writeRecoveryReport(v2Filename, {
        ...first,
        schemaVersion: 2,
        fixtureRejectionProof: { proofMethod: "untrusted", evidenceDigest: "a".repeat(64) },
      })).rejects.toMatchObject({ code: "STAGING_AI_RECOVERY_REPORT_INVALID" });
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects a missing or malformed separate prior report before connecting", async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "ac009-recovery-prior-"));
    const intentFile = path.join(directory, "intent.json");
    const priorFile = path.join(directory, "prior.json");
    await fs.writeFile(intentFile, JSON.stringify(intent()));
    const cliEnv = (priorReport) => ({
      ...env(),
      STAGING_AI_ACCEPTANCE_RECOVERY_INTENT: intentFile,
      STAGING_AI_ACCEPTANCE_PRIOR_RECOVERY_REPORT: priorReport,
      STAGING_AI_ACCEPTANCE_RECOVERY_REPORT_OUTPUT: path.join(directory, "recovery", "report.json"),
      MONGO_URI: "mongodb://127.0.0.1:1/htcoaching_staging",
    });
    try {
      await expect(runRecoveryCli({ env: cliEnv(priorFile) }))
        .rejects.toMatchObject({ code: "STAGING_AI_RECOVERY_REPORT_INVALID" });
      await fs.writeFile(priorFile, "{");
      await expect(runRecoveryCli({ env: cliEnv(priorFile) }))
        .rejects.toMatchObject({ code: "STAGING_AI_RECOVERY_REPORT_INVALID" });
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  });
});
