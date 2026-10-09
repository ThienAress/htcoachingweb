import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import {
  parseReliabilityRecoveryIntent,
  recoverStagingAiReliability,
  validateReliabilityRecoveryConfig,
} from "../recoverStagingAiReliability.js";

const RUN_ID = "11111111-1111-4111-8111-111111111111";
const SHA = "a".repeat(40);
let memory;
let db;
let mongoUri;
const intent = () => ({ schemaVersion: 1, kind: "staging-ai-reliability-recovery-intent", releaseSha: SHA,
  runId: RUN_ID, userId: "aaaaaaaaaaaaaaaaaaaaaaaa", adminUserId: "bbbbbbbbbbbbbbbbbbbbbbbb",
  seededConversationId: "cccccccccccccccccccccccc", createdAt: "2026-09-24T00:00:00.000Z" });
const env = () => ({ APP_ENV: "staging", MONGO_URI: mongoUri,
  CLIENT_URL: "https://staging--htcoachingweb.netlify.app", PUBLIC_API_ORIGIN: "https://htcoachingweb-staging.onrender.com",
  ALLOWED_ORIGINS: "https://staging--htcoachingweb.netlify.app", BACKGROUND_JOBS_ENABLED: "false",
  EMAIL_DELIVERY_MODE: "disabled", F1_RETENTION_ENFORCE: "false", CONFIRM_STAGING_AI_RELIABILITY_RECOVERY: "yes",
  RELEASE_SHA: SHA, RENDER_GIT_COMMIT: SHA });

beforeAll(async () => {
  memory = await MongoMemoryServer.create();
  mongoUri = memory.getUri("htcoaching_staging");
  await mongoose.connect(mongoUri);
  db = mongoose.connection.db;
});
beforeEach(async () => {
  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  await Promise.all(collections.map(({ name }) => db.collection(name).deleteMany({})));
});
afterAll(async () => { await mongoose.disconnect(); await memory.stop(); });

describe("staging reliability recovery", () => {
  test("requires exact intent schema and staging SHA/confirmation", () => {
    expect(() => parseReliabilityRecoveryIntent({ ...intent(), userId: "bad" })).toThrowError();
    expect(validateReliabilityRecoveryConfig({ ...env(), RENDER_GIT_COMMIT: "b".repeat(40) }, intent()).valid).toBe(false);
  });

  test("deletes only exact synthetic ownership and reports residue zero", async () => {
    const targetUser = new mongoose.Types.ObjectId(intent().userId);
    const targetAdmin = new mongoose.Types.ObjectId(intent().adminUserId);
    const foreign = new mongoose.Types.ObjectId();
    await db.collection("users").insertMany([
      { _id: targetUser, email: `reliability.${RUN_ID}@example.invalid`, role: "user" },
      { _id: targetAdmin, email: `reliability-admin.${RUN_ID}@example.invalid`, role: "admin" },
      { _id: foreign, email: "foreign@example.invalid", role: "user" },
    ]);
    await db.collection("chatconversations").insertMany([
      { _id: new mongoose.Types.ObjectId(intent().seededConversationId), userId: targetUser, activeStreamId: null },
      { userId: foreign, activeStreamId: null },
    ]);
    for (const name of ["serviceusagebuckets", "aimemories", "aimemorypreferences", "aitoolconfirmations", "aimoderationstates"]) {
      await db.collection(name).insertOne({ userId: targetUser });
      await db.collection(name).insertOne({ userId: foreign });
    }
    const report = await recoverStagingAiReliability({ env: env(), intent: intent(), db });
    expect(report).toMatchObject({ verified: true, residue: 0, alreadyClean: false });
    expect(await db.collection("users").findOne({ _id: foreign })).toBeTruthy();
    expect(await db.collection("chatconversations").countDocuments({ userId: foreign })).toBe(1);
    expect(await db.collection("users").countDocuments({ _id: { $in: [targetUser, targetAdmin] } })).toBe(0);
  });

  test("refuses active streams and leaves all data untouched", async () => {
    const targetUser = new mongoose.Types.ObjectId(intent().userId);
    await db.collection("users").insertOne({ _id: targetUser, email: `reliability.${RUN_ID}@example.invalid`, role: "user" });
    await db.collection("chatconversations").insertOne({ userId: targetUser, activeStreamId: "stream-active" });
    await expect(recoverStagingAiReliability({ env: env(), intent: intent(), db })).rejects
      .toMatchObject({ code: "STAGING_AI_RELIABILITY_RECOVERY_ACTIVE_STREAM" });
    expect(await db.collection("users").findOne({ _id: targetUser })).toBeTruthy();
  });

  test("refuses capability/run control residue before deletion", async () => {
    await db.collection("staging_ai_acceptance_claims").insertOne({ runId: RUN_ID, recordType: "run", state: "revoked" });
    await expect(recoverStagingAiReliability({ env: env(), intent: intent(), db })).rejects
      .toMatchObject({ code: "STAGING_AI_RELIABILITY_RECOVERY_CONTROL_RESIDUE" });
  });
});
