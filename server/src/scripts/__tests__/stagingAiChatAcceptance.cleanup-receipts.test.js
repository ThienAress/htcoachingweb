import { createHash } from "node:crypto";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createExactCleanup } from "../stagingAiChatAcceptance.cleanup.js";
import { recoverStagingAiChatAcceptance } from "../stagingAiChatAcceptance.recover.js";
import { knowledgeFixtureQueries } from "../stagingAiChatAcceptance.http.js";
import { normalizeKnowledgeQuestion } from "../../utils/knowledgeBase.js";

const RUN_ID = "550e8400-e29b-41d4-a716-446655440000";
const SHA = "a".repeat(40);
let memory;
let db;
let mongoUri;

const intent = () => ({ schemaVersion: 1, kind: "staging-ai-chat-recovery-intent", releaseSha: SHA, runId: RUN_ID, marker: `htcoaching-acceptance:${RUN_ID}`, createdAt: "2026-09-15T00:00:00.000Z" });
const env = () => ({ APP_ENV: "staging", MONGO_URI: mongoUri, CLIENT_URL: "https://staging--htcoachingweb.netlify.app", PUBLIC_API_ORIGIN: "https://htcoachingweb-staging.onrender.com", RELEASE_SHA: SHA, RENDER_GIT_COMMIT: SHA, CONFIRM_STAGING_AI_ACCEPTANCE_RECOVERY: "yes" });
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

describe("AC-009 cleanup receipt fence", () => {
  it.each(["before cleanup", "during receipt expiry wait"])("retains conflicting rejected-fixture data %s", async (phase) => {
    const actor = new mongoose.Types.ObjectId();
    const normalizedQuestion = normalizeKnowledgeQuestion(knowledgeFixtureQueries(intent().marker).question);
    await db.collection("users").insertOne({ _id: actor });
    await db.collection("staging_ai_acceptance_claims").insertMany([
      {
        _id: `${RUN_ID}:fixture-create`, recordType: "fixture_create", journalVersion: 2,
        runId: RUN_ID, releaseSha: SHA, actorId: String(actor),
        questionDigest: createHash("sha256").update(normalizedQuestion).digest("hex"),
        requestId: "650e8400-e29b-41d4-a716-446655440000", payloadDigest: "c".repeat(64),
        state: "terminal", outcome: "rejected", startedAt: new Date(0), settledAt: new Date(1),
        knowledgeEntryId: null, responseStatus: 400, responseCode: "KNOWLEDGE_QUERY_SENSITIVE",
      },
      receipt({ actorId: actor, expiresAt: new Date(10) }),
    ]);
    const insertConflict = () => db.collection("knowledgeentries").insertOne({ normalizedQuestion });
    if (phase === "before cleanup") await insertConflict();
    let tick = 0;
    const cleanup = createExactCleanup({ db, runId: RUN_ID, releaseSha: SHA,
      retainRunTombstone: true, requireFixtureCreateProof: true, expirySkewMs: 0,
      now: () => tick, wait: async (ms) => {
        tick += ms;
        if (phase === "during receipt expiry wait") await insertConflict();
      },
    });
    cleanup.registerUser(actor);
    cleanup.registerKnowledgeQuestion(normalizedQuestion);
    cleanup.registerCapabilityJti("650e8400-e29b-41d4-a716-446655440000", 10);
    await expect(cleanup.cleanup()).rejects.toMatchObject({ code: "STAGING_AI_RECOVERY_FIXTURE_REJECTION_CONFLICT" });
    expect({
      actor: await db.collection("users").findOne({ _id: actor }),
      knowledgeCount: await db.collection("knowledgeentries").countDocuments({ normalizedQuestion }),
      journal: await db.collection("staging_ai_acceptance_claims").findOne({ _id: `${RUN_ID}:fixture-create` }),
      tombstone: await db.collection("staging_ai_acceptance_claims").findOne({ _id: RUN_ID, state: "revoked" }),
    }).toMatchObject({ actor: { _id: actor }, knowledgeCount: 1, journal: { outcome: "rejected" }, tombstone: { state: "revoked" } });
  });

  it("waits for a delayed admitted receipt to settle before deleting fixtures", async () => {
    const actor = new mongoose.Types.ObjectId();
    await db.collection("staging_ai_acceptance_claims").insertMany([{ _id: RUN_ID, recordType: "run", runId: RUN_ID, state: "revoked" }, receipt({ actorId: actor, receiptState: "admitted", expiresAt: new Date(0) })]);
    await db.collection("users").insertOne({ _id: actor, email: `ac009.${RUN_ID}@example.invalid`, role: "user" });
    let tick = 0;
    const cleanup = createExactCleanup({ db, runId: RUN_ID, settlementWaitMs: 50, settlementPollMs: 1, now: () => tick, wait: async () => {
      tick += 1;
      await db.collection("staging_ai_acceptance_claims").updateOne({ _id: "650e8400-e29b-41d4-a716-446655440000" }, { $set: { receiptState: "settled" } });
    } });
    cleanup.registerUser(actor);
    cleanup.registerCapabilityJti("650e8400-e29b-41d4-a716-446655440000", 0);
    await cleanup.cleanup();
    expect((await cleanup.verify()).residue).toBe(0);
  });

  it("keeps tombstone and fixtures when admitted receipt times out", async () => {
    const actor = new mongoose.Types.ObjectId();
    const kb = new mongoose.Types.ObjectId();
    await db.collection("staging_ai_acceptance_claims").insertMany([{ _id: RUN_ID, recordType: "run", runId: RUN_ID, state: "revoked" }, receipt({ actorId: actor, receiptState: "admitted", expiresAt: new Date(0) })]);
    await db.collection("users").insertOne({ _id: actor });
    await db.collection("knowledgeentries").insertOne({ _id: kb, normalizedQuestion: "owned question" });
    let tick = 0;
    const cleanup = createExactCleanup({ db, runId: RUN_ID, settlementWaitMs: 2, settlementPollMs: 1, now: () => tick, wait: async () => { tick += 1; } });
    cleanup.registerUser(actor); cleanup.registerKnowledgeEntry(kb); cleanup.registerCapabilityJti("650e8400-e29b-41d4-a716-446655440000", 0);
    await expect(cleanup.cleanup()).rejects.toMatchObject({ code: "STAGING_AI_RECOVERY_ADMITTED_UNKNOWN" });
    expect(await db.collection("staging_ai_acceptance_claims").findOne({ _id: RUN_ID, state: "revoked" })).toBeTruthy();
    expect(await db.collection("users").findOne({ _id: actor })).toBeTruthy();
    expect(await db.collection("knowledgeentries").findOne({ _id: kb })).toBeTruthy();
  });

  it("honors exact expiry for issued and missing reserved receipts", async () => {
    await db.collection("staging_ai_acceptance_claims").insertMany([{ _id: RUN_ID, recordType: "run", runId: RUN_ID, state: "revoked" }, receipt({ _id: "850e8400-e29b-41d4-a716-446655440000", expiresAt: new Date(10) })]);
    let tick = 0;
    const cleanup = createExactCleanup({ db, runId: RUN_ID, expirySkewMs: 2, now: () => tick, wait: async (ms) => { tick += ms; } });
    cleanup.registerCapabilityJti("750e8400-e29b-41d4-a716-446655440000", 10);
    cleanup.registerCapabilityJti("850e8400-e29b-41d4-a716-446655440000", 10);
    await cleanup.cleanup();
    expect(tick).toBe(12);
  });

  it("retains synthetic actors until capability receipt deletion is acknowledged", async () => {
    const actor = new mongoose.Types.ObjectId();
    await db.collection("staging_ai_acceptance_claims").insertMany([
      { _id: RUN_ID, recordType: "run", runId: RUN_ID, state: "revoked" },
      receipt({ actorId: actor, receiptState: "settled", outcome: "completed" }),
    ]);
    await db.collection("users").insertOne({
      _id: actor,
      email: `ac009.${RUN_ID}@example.invalid`,
      role: "user",
    });
    const faultDb = {
      listCollections: (...args) => db.listCollections(...args),
      collection: (name) => {
        const collection = db.collection(name);
        if (name !== "staging_ai_acceptance_claims") return collection;
        return new Proxy(collection, {
          get: (target, property) => property === "deleteMany"
            ? async () => { throw new Error("synthetic control deletion failure"); }
            : typeof target[property] === "function"
              ? target[property].bind(target)
              : target[property],
        });
      },
    };
    const cleanup = createExactCleanup({
      db: faultDb,
      runId: RUN_ID,
      expirySkewMs: 0,
      retainRunTombstone: true,
    });
    cleanup.registerUser(actor);
    cleanup.registerCapabilityJti("650e8400-e29b-41d4-a716-446655440000", 0);
    await expect(cleanup.cleanup()).rejects.toThrow("synthetic control deletion failure");
    expect(await db.collection("users").findOne({ _id: actor })).toBeTruthy();

    await seedFixtureJournal();
    const report = await recoverStagingAiChatAcceptance({
      env: env(),
      intent: intent(),
      db,
      capability: capability(),
      cleanupOptions: { expirySkewMs: 0 },
      ...fastRecovery(),
    });
    expect(report).toMatchObject({ verified: true, residue: 0 });
  });

  it("fails closed when the exact recovery tombstone is already missing", async () => {
    await db.collection("staging_ai_acceptance_claims").insertOne({
      _id: "unrelated",
      recordType: "run",
      runId: "650e8400-e29b-41d4-a716-446655440000",
      state: "revoked",
    });
    const cleanup = createExactCleanup({
      db,
      runId: RUN_ID,
      retainRunTombstone: true,
    });

    await expect(cleanup.deleteRunTombstone()).rejects.toMatchObject({
      code: "STAGING_AI_RECOVERY_TOMBSTONE_DELETE_FAILED",
    });
  });
});
