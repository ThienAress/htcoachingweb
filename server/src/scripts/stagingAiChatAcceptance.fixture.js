import { createHash } from "node:crypto";
import mongoose from "mongoose";
import { createKnowledgeFixture, knowledgeFixtureQueries } from "./stagingAiChatAcceptance.http.js";
import { normalizeKnowledgeQuestion } from "../utils/knowledgeBase.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA = /^[0-9a-f]{40}$/;
const KEYS = ["_id", "recordType", "journalVersion", "runId", "releaseSha", "actorId", "questionDigest", "state", "startedAt", "settledAt", "knowledgeEntryId"];
const unknown = () => Object.assign(new Error("Fixture creation has no durable terminal proof; retain the run tombstone and fixtures"), {
  code: "STAGING_AI_RECOVERY_FIXTURE_UNKNOWN",
});
export const fixtureCreateJournalId = (runId) => `${runId}:fixture-create`;
const questionDigest = (marker) => createHash("sha256").update(normalizeKnowledgeQuestion(knowledgeFixtureQueries(marker).question)).digest("hex");

// This runner-written journal is not a tenth counter-producing request receipt.
// It proves only that the fixture POST returned a fully validated terminal 201.
export const assertFixtureCreateSettled = async ({ collection, runId, releaseSha, marker }) => {
  const journal = await collection.findOne({ _id: fixtureCreateJournalId(runId) });
  if (!journal || Object.keys(journal).length !== KEYS.length || Object.keys(journal).some((key) => !KEYS.includes(key)) ||
      journal.recordType !== "fixture_create" || journal.journalVersion !== 1 ||
      journal.runId !== runId || journal.releaseSha !== releaseSha ||
      marker !== `htcoaching-acceptance:${runId}` ||
      !UUID.test(runId || "") || !SHA.test(releaseSha || "") ||
      !mongoose.isObjectIdOrHexString(journal.actorId) || journal.questionDigest !== questionDigest(marker) ||
      journal.state !== "settled" || !mongoose.isObjectIdOrHexString(journal.knowledgeEntryId) ||
      !journal.startedAt || !Number.isFinite(new Date(journal.startedAt).getTime()) || !journal.settledAt ||
      new Date(journal.settledAt).getTime() < new Date(journal.startedAt).getTime() ||
      !Number.isFinite(new Date(journal.settledAt).getTime())) throw unknown();
  return journal;
};

export const createTrackedKnowledgeFixture = async ({ collection, api, marker, sourceUrl, runId, releaseSha, actorId }) => {
  if (!UUID.test(runId || "") || !SHA.test(releaseSha || "") ||
      marker !== `htcoaching-acceptance:${runId}` || !mongoose.isObjectIdOrHexString(actorId)) throw unknown();
  const revoked = () => collection.findOne({ _id: runId, recordType: "run", runId, state: "revoked" }, { projection: { _id: 1 } });
  if (await revoked()) throw unknown();
  const journal = {
    _id: fixtureCreateJournalId(runId), recordType: "fixture_create", journalVersion: 1,
    runId, releaseSha, actorId: String(actorId), questionDigest: questionDigest(marker),
    state: "pending", startedAt: new Date(), settledAt: null, knowledgeEntryId: null,
  };
  // No request is sent without an acknowledged, unique durable pending record.
  const inserted = await collection.insertOne(journal, { timeoutMS: 1_000 });
  if (inserted.acknowledged !== true || await revoked()) throw unknown();
  const fixture = await createKnowledgeFixture({ api, marker, sourceUrl });
  const settled = await collection.updateOne(journal, {
    $set: { state: "settled", settledAt: new Date(), knowledgeEntryId: fixture.id },
  }, { timeoutMS: 1_000 });
  if (settled.acknowledged !== true || settled.modifiedCount !== 1) throw unknown();
  return fixture;
};

export const deleteSettledFixtureJournal = async (options) => {
  const journal = await assertFixtureCreateSettled(options);
  const result = await options.collection.deleteOne(journal, { timeoutMS: 1_000 });
  if (result.acknowledged !== true || result.deletedCount !== 1) throw unknown();
};
