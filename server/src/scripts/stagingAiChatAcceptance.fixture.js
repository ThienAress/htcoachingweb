import { createHash, randomUUID } from "node:crypto";
import mongoose from "mongoose";
import {
  buildKnowledgeFixturePayload,
  createKnowledgeFixture,
  knowledgeFixtureQueries,
} from "./stagingAiChatAcceptance.http.js";
import { normalizeKnowledgeQuestion } from "../utils/knowledgeBase.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA = /^[0-9a-f]{40}$/;
const V1_KEYS = ["_id", "recordType", "journalVersion", "runId", "releaseSha", "actorId", "questionDigest", "state", "startedAt", "settledAt", "knowledgeEntryId"];
const V2_KEYS = [
  "_id", "recordType", "journalVersion", "runId", "releaseSha", "actorId", "questionDigest",
  "requestId", "payloadDigest", "state", "outcome", "startedAt", "settledAt",
  "knowledgeEntryId", "responseStatus", "responseCode",
];
const unknown = () => Object.assign(new Error("Fixture creation has no durable terminal proof; retain the run tombstone and fixtures"), {
  code: "STAGING_AI_RECOVERY_FIXTURE_UNKNOWN",
});
export const fixtureCreateJournalId = (runId) => `${runId}:fixture-create`;
const questionDigest = (marker) => createHash("sha256").update(normalizeKnowledgeQuestion(knowledgeFixtureQueries(marker).question)).digest("hex");
const canonicalJson = (value) => Array.isArray(value)
  ? `[${value.map(canonicalJson).join(",")}]`
  : value && typeof value === "object"
    ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`
    : JSON.stringify(value);
const payloadDigest = (payload) => createHash("sha256").update(canonicalJson(payload)).digest("hex");

const hasExactKeys = (journal, keys) => journal && Object.keys(journal).length === keys.length &&
  Object.keys(journal).every((key) => keys.includes(key));
const hasCommonBinding = (journal, { runId, releaseSha, marker }) =>
  journal?.recordType === "fixture_create" && journal.runId === runId && journal.releaseSha === releaseSha &&
  marker === `htcoaching-acceptance:${runId}` && UUID.test(runId || "") && SHA.test(releaseSha || "") &&
  mongoose.isObjectIdOrHexString(journal.actorId) && journal.questionDigest === questionDigest(marker) &&
  journal.startedAt && Number.isFinite(new Date(journal.startedAt).getTime());

// This runner-written journal is not a tenth counter-producing request receipt.
// It proves only that the fixture POST reached one allowlisted terminal outcome.
export const assertFixtureCreateTerminal = async ({ collection, runId, releaseSha, marker }) => {
  const journal = await collection.findOne({ _id: fixtureCreateJournalId(runId) });
  if (!hasCommonBinding(journal, { runId, releaseSha, marker })) throw unknown();
  if (journal.journalVersion === 1) {
    if (!hasExactKeys(journal, V1_KEYS) || journal.state !== "settled" ||
        !mongoose.isObjectIdOrHexString(journal.knowledgeEntryId) || !journal.settledAt ||
        !Number.isFinite(new Date(journal.settledAt).getTime()) ||
        new Date(journal.settledAt).getTime() < new Date(journal.startedAt).getTime()) throw unknown();
    return journal;
  }
  const created = journal.outcome === "created" && journal.responseStatus === 201 &&
    journal.responseCode == null && mongoose.isObjectIdOrHexString(journal.knowledgeEntryId);
  const rejected = journal.outcome === "rejected" && journal.responseStatus === 400 &&
    journal.responseCode === "KNOWLEDGE_QUERY_SENSITIVE" && journal.knowledgeEntryId == null;
  if (!hasExactKeys(journal, V2_KEYS) || journal.journalVersion !== 2 || !UUID.test(journal.requestId || "") ||
      !/^[0-9a-f]{64}$/.test(journal.payloadDigest || "") || journal.state !== "terminal" ||
      (!created && !rejected) || !journal.settledAt ||
      !Number.isFinite(new Date(journal.settledAt).getTime()) ||
      new Date(journal.settledAt).getTime() < new Date(journal.startedAt).getTime()) throw unknown();
  return journal;
};

export const assertFixtureCreateSettled = async (options) => {
  const journal = await assertFixtureCreateTerminal(options);
  if (journal.journalVersion === 2 && journal.outcome !== "created") throw unknown();
  return journal;
};

export const assertFixtureCreatePending = async ({ collection, runId, releaseSha, marker }) => {
  const journal = await collection.findOne({ _id: fixtureCreateJournalId(runId) });
  if (!hasCommonBinding(journal, { runId, releaseSha, marker })) throw unknown();
  const legacyPending = journal.journalVersion === 1 && hasExactKeys(journal, V1_KEYS) &&
    journal.state === "pending" && journal.settledAt == null && journal.knowledgeEntryId == null;
  const currentPending = journal.journalVersion === 2 && hasExactKeys(journal, V2_KEYS) &&
    UUID.test(journal.requestId || "") && /^[0-9a-f]{64}$/.test(journal.payloadDigest || "") &&
    journal.state === "pending" && journal.outcome == null && journal.settledAt == null &&
    journal.knowledgeEntryId == null && journal.responseStatus == null && journal.responseCode == null;
  if (!legacyPending && !currentPending) throw unknown();
  return journal;
};

export const createTrackedKnowledgeFixture = async ({ collection, api, marker, sourceUrl, runId, releaseSha, actorId }) => {
  if (!UUID.test(runId || "") || !SHA.test(releaseSha || "") ||
      marker !== `htcoaching-acceptance:${runId}` || !mongoose.isObjectIdOrHexString(actorId)) throw unknown();
  const revoked = () => collection.findOne({ _id: runId, recordType: "run", runId, state: "revoked" }, { projection: { _id: 1 } });
  if (await revoked()) throw unknown();
  const requestId = randomUUID();
  const payload = buildKnowledgeFixturePayload({ marker, sourceUrl });
  const journal = {
    _id: fixtureCreateJournalId(runId), recordType: "fixture_create", journalVersion: 2,
    runId, releaseSha, actorId: String(actorId), questionDigest: questionDigest(marker),
    requestId, payloadDigest: payloadDigest(payload), state: "pending", outcome: null,
    startedAt: new Date(), settledAt: null, knowledgeEntryId: null,
    responseStatus: null, responseCode: null,
  };
  // No request is sent without an acknowledged, unique durable pending record.
  const inserted = await collection.insertOne(journal, { timeoutMS: 1_000 });
  if (inserted.acknowledged !== true || await revoked()) throw unknown();
  let fixture;
  try {
    fixture = await createKnowledgeFixture({ api, marker, sourceUrl, requestId, payload });
  } catch (error) {
    if (error?.remoteOutcomeKnown === true && error.requestId === requestId &&
        error.httpStatus === 400 && error.responseCode === "KNOWLEDGE_QUERY_SENSITIVE") {
      const rejected = await collection.updateOne(journal, {
        $set: {
          state: "terminal", outcome: "rejected", settledAt: new Date(),
          responseStatus: 400, responseCode: "KNOWLEDGE_QUERY_SENSITIVE",
        },
      }, { timeoutMS: 1_000 });
      if (rejected.acknowledged !== true || rejected.modifiedCount !== 1) throw unknown();
    }
    throw error;
  }
  const settled = await collection.updateOne(journal, {
    $set: {
      state: "terminal", outcome: "created", settledAt: new Date(), knowledgeEntryId: fixture.id,
      responseStatus: 201, responseCode: null,
    },
  }, { timeoutMS: 1_000 });
  if (settled.acknowledged !== true || settled.modifiedCount !== 1) throw unknown();
  return fixture;
};

export const deleteTerminalFixtureJournal = async (options) => {
  const journal = await assertFixtureCreateTerminal(options);
  const result = await options.collection.deleteOne(journal, { timeoutMS: 1_000 });
  if (result.acknowledged !== true || result.deletedCount !== 1) throw unknown();
};

export const deleteSettledFixtureJournal = deleteTerminalFixtureJournal;

export const deletePendingFixtureJournal = async (options) => {
  const journal = await assertFixtureCreatePending(options);
  const result = await options.collection.deleteOne(journal, { timeoutMS: 1_000 });
  if (result.acknowledged !== true || result.deletedCount !== 1) throw unknown();
};
