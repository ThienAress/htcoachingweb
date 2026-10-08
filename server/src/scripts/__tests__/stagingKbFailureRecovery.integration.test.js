import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildCompletedKbFailureProof, kbFailureProofDigest } from "../stagingAiChatAcceptance.kbFailure.js";
import { proofInputs } from "./stagingKbFailure.fixture.js";
import { deleteArchivedKbFailure } from "../stagingAiChatAcceptance.kbFailureRecovery.js";
import { createHash } from "node:crypto";
import { recoverStagingAiChatAcceptance } from "../stagingAiChatAcceptance.recover.js";
import { knowledgeFixtureQueries } from "../stagingAiChatAcceptance.http.js";
import { normalizeKnowledgeQuestion } from "../../utils/knowledgeBase.js";

let memory;
let db;
let options;

beforeAll(async () => {
  memory = await MongoMemoryServer.create();
  await mongoose.connect(memory.getUri("htcoaching_staging"));
  db = mongoose.connection.db;
});
afterAll(async () => {
  await mongoose.disconnect();
  await memory.stop();
});
beforeEach(async () => {
  await db.dropDatabase();
  const inputs = proofInputs();
  const proof = buildCompletedKbFailureProof(inputs);
  options = {
    db, intent: inputs.intent, evidence: proof,
    archive: { artifactId: 123, workflowRunId: 456, runAttempt: 1, evidenceDigest: kbFailureProofDigest(proof) },
    env: { GITHUB_SHA: inputs.recoveryCodeSha, GITHUB_ACTOR: inputs.operatorActor,
      GITHUB_RUN_ID: "456", GITHUB_RUN_ATTEMPT: "1", STAGING_AI_SOURCE_WORKFLOW_RUN_ID: "37758558812" },
    now: () => Date.parse("2026-10-08T10:00:00Z"),
  };
  await db.collection("staging_ai_acceptance_claims").insertMany([
    inputs.receipt,
    { _id: inputs.intent.runId, runId: inputs.intent.runId, recordType: "run", state: "revoked" },
    { _id: "foreign", recordType: "capability", runId: "another-run" },
  ]);
  await db.collection("users").insertOne({ _id: new mongoose.Types.ObjectId(proof.actorId),
    role: "admin", email: `ac009-admin.${inputs.intent.runId}@example.invalid` });
});

describe("archived completed read-only KB recovery", () => {
  it("integrates with canonical cleanup and reports archived proof with residue zero", async () => {
    const marker = `htcoaching-acceptance:${options.intent.runId}`;
    const normalized = normalizeKnowledgeQuestion(knowledgeFixtureQueries(marker).question);
    const knowledgeId = new mongoose.Types.ObjectId();
    const claims = db.collection("staging_ai_acceptance_claims");
    await db.collection("knowledgeentries").insertOne({ _id: knowledgeId, normalizedQuestion: normalized });
    await claims.insertOne({ _id: `${options.intent.runId}:fixture-create`, recordType: "fixture_create",
      journalVersion: 1, runId: options.intent.runId, releaseSha: options.intent.releaseSha,
      actorId: options.evidence.actorId, questionDigest: createHash("sha256").update(normalized).digest("hex"),
      state: "settled", startedAt: new Date(0), settledAt: new Date(1), knowledgeEntryId: String(knowledgeId) });
    const capability = { STAGING_AI_ACCEPTANCE_COLLECTION: "staging_ai_acceptance_claims",
      revokeStagingAiAcceptanceRun: async () => true };
    const report = await recoverStagingAiChatAcceptance({ db, capability,
      intent: { ...options.intent, schemaVersion: 1, kind: "staging-ai-chat-recovery-intent", marker },
      env: { ...options.env, APP_ENV: "staging", MONGO_URI: memory.getUri("htcoaching_staging"),
        CLIENT_URL: "https://staging--htcoachingweb.netlify.app",
        PUBLIC_API_ORIGIN: "https://htcoachingweb-staging.onrender.com",
        RELEASE_SHA: options.intent.releaseSha, RENDER_GIT_COMMIT: options.intent.releaseSha,
        CONFIRM_STAGING_AI_ACCEPTANCE_RECOVERY: "yes" },
      kbFailureEvidence: options.evidence, kbFailureArchive: options.archive,
      recoveryQuiescenceMs: 1, postCleanupQuiescenceMs: 1, wait: async () => {},
    });
    expect(report).toMatchObject({ schemaVersion: 3, residue: 0, verified: true,
      recoveredReceiptCount: 1, kbFailureProof: { artifactId: 123 } });
    expect(await claims.findOne({ _id: "foreign" })).toBeTruthy();
  });

  it("refuses a receipt changed between validation and CAS", async () => {
    const collection = db.collection("staging_ai_acceptance_claims");
    const proxy = { databaseName: db.databaseName, collection: (name) => {
      if (name !== "staging_ai_acceptance_claims") return db.collection(name);
      return { findOne: (...args) => collection.findOne(...args), deleteOne: async (filter) => {
        await collection.updateOne({ _id: options.evidence.jti }, { $set: { payloadDigest: "f".repeat(64) } });
        return collection.deleteOne(filter);
      } };
    } };
    await expect(deleteArchivedKbFailure({ ...options, db: proxy })).rejects
      .toMatchObject({ code: "STAGING_KB_FAILURE_RECOVERY_REJECTED" });
    expect(await collection.countDocuments()).toBe(3);
  });

  it("deletes only the registered receipt and leaves the tombstone and foreign data", async () => {
    await expect(deleteArchivedKbFailure(options)).resolves.toMatchObject({ deleted: true, artifactId: 123 });
    expect(await db.collection("staging_ai_acceptance_claims").countDocuments()).toBe(2);
    expect(await db.collection("users").countDocuments()).toBe(1);
  });

  it.each([
    ["missing archive", (o) => { o.archive = null; }],
    ["wrong archive digest", (o) => { o.archive.evidenceDigest = "a".repeat(64); }],
    ["foreign workflow", (o) => { o.archive.workflowRunId = 999; }],
    ["wrong database", (o) => { o.db = { databaseName: "gym-app" }; }],
    ["wrong run", (o) => { o.intent = { ...o.intent, runId: "another-run" }; }],
    ["wrong code SHA", (o) => { o.env.GITHUB_SHA = "a".repeat(40); }],
    ["wrong operator", (o) => { o.env.GITHUB_ACTOR = "another-user"; }],
    ["not expired", (o) => { o.now = () => Date.parse("2026-10-08T09:45:46Z"); }],
  ])("refuses %s before deletion", async (_, change) => {
    change(options);
    await expect(deleteArchivedKbFailure(options)).rejects.toMatchObject({ code: "STAGING_KB_FAILURE_RECOVERY_REJECTED" });
    expect(await db.collection("staging_ai_acceptance_claims").countDocuments()).toBe(3);
  });

  it.each([
    ["missing tombstone", async () => db.collection("staging_ai_acceptance_claims")
      .deleteOne({ recordType: "run" })],
    ["wrong actor", async () => db.collection("users").updateOne({}, { $set: { role: "user" } })],
    ["changed receipt", async () => db.collection("staging_ai_acceptance_claims")
      .updateOne({ recordType: "capability", _id: options.evidence.jti }, { $set: { payloadDigest: "f".repeat(64) } })],
    ["missing receipt", async () => db.collection("staging_ai_acceptance_claims")
      .deleteOne({ _id: options.evidence.jti })],
  ])("refuses %s and preserves remaining data", async (_, change) => {
    await change();
    const before = await db.collection("staging_ai_acceptance_claims").countDocuments();
    await expect(deleteArchivedKbFailure(options)).rejects.toMatchObject({ code: "STAGING_KB_FAILURE_RECOVERY_REJECTED" });
    expect(await db.collection("staging_ai_acceptance_claims").countDocuments()).toBe(before);
  });
});
