import mongoose from "mongoose";
import { assertFixtureCreateTerminal, fixtureCreateJournalId } from "./stagingAiChatAcceptance.fixture.js";
import { knowledgeFixtureQueries } from "./stagingAiChatAcceptance.http.js";
import { normalizeKnowledgeQuestion } from "../utils/knowledgeBase.js";

const oid = (value) =>
  value instanceof mongoose.Types.ObjectId ? value : new mongoose.Types.ObjectId(String(value));

export const createExactCleanup = ({
  db,
  runId,
  controlCollection = "staging_ai_acceptance_claims",
  unknownOutcomeWaitMs = 125_000,
  settlementWaitMs = 95_000,
  settlementPollMs = 250,
  expirySkewMs = 1_000,
  retainRunTombstone = false,
  requireFixtureCreateProof = false,
  releaseSha,
  now = () => Date.now(),
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) => {
  const ids = {
    users: new Set(),
    knowledge: new Set(),
    knowledgeQuestions: new Set(),
    jtis: new Set(),
    capabilityExpiries: new Map(),
  };
  const registerUser = (value) => ids.users.add(String(value));
  const registerKnowledgeEntry = (value) => ids.knowledge.add(String(value));
  const registerKnowledgeQuestion = (value) => ids.knowledgeQuestions.add(String(value));
  const registerCapabilityJti = (value, expiresAt) => {
    const jti = String(value);
    ids.jtis.add(jti);
    if (Number.isFinite(expiresAt)) ids.capabilityExpiries.set(jti, expiresAt);
  };
  let uncertainMutationStartedAt = null;
  let outcomeUnknown = false;
  const markMutationStart = () => {
    uncertainMutationStartedAt = now();
    outcomeUnknown = true;
  };
  const markMutationSettled = () => {
    uncertainMutationStartedAt = null;
    outcomeUnknown = false;
  };
  const fixtureNormalizedQuestion = normalizeKnowledgeQuestion(
    knowledgeFixtureQueries(`htcoaching-acceptance:${runId}`).question,
  );
  let fixtureCreateJournal = null;

  const filters = () => {
    const userIds = [...ids.users].map(oid);
    const knowledgeIds = [...ids.knowledge].map(oid);
    const capabilityJtis = [...ids.jtis];
    return {
      [controlCollection]: {
        runId,
        _id: { $in: capabilityJtis },
        receiptState: { $in: ["issued", "settled"] },
      },
      knowledgeentries: { _id: { $in: knowledgeIds } },
      chatconversations: { userId: { $in: userIds } },
      serviceusagebuckets: { userId: { $in: userIds } },
      aimemories: { userId: { $in: userIds } },
      aimemorypreferences: { userId: { $in: userIds } },
      aitoolconfirmations: { userId: { $in: userIds } },
      aimoderationstates: { userId: { $in: userIds } },
      users: { _id: { $in: userIds } },
    };
  };

  const existing = async () => new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((x) => x.name));
  const ensureRevokedTombstone = async (available) => {
    if (!available.has(controlCollection)) return;
    await db.collection(controlCollection).updateOne(
      { _id: runId, recordType: "run", runId },
      { $setOnInsert: { state: "revoked", revokedAt: new Date(now()) } },
      { upsert: true, timeoutMS: 1_000 },
    );
  };
  const assertReceiptsTerminalAndExpired = async (available) => {
    if (!ids.jtis.size || !available.has(controlCollection)) return;
    const revoked = await db.collection(controlCollection).findOne({
      _id: runId,
      recordType: "run",
      runId,
      state: "revoked",
    }, { projection: { _id: 1 } });
    const receiptFilter = { runId, _id: { $in: [...ids.jtis] } };
    const deadline = now() + settlementWaitMs;
    let receipts = [];
    let expiryWindowClosed = false;
    while (true) {
      receipts = await db.collection(controlCollection).find(receiptFilter, {
        projection: { _id: 1, receiptState: 1, expiresAt: 1 },
      }).toArray();
      const admitted = receipts.some((item) => item.receiptState === "admitted");
      const invalid = receipts.some((item) => !["issued", "settled", "admitted"].includes(item.receiptState));
      if (invalid) {
        const error = new Error("Cleanup refuses a receipt that is neither issued nor settled");
        error.code = "STAGING_AI_CLEANUP_RECEIPT_UNSETTLED";
        throw error;
      }
      if (admitted) {
        if (now() >= deadline) {
          const error = new Error("Cleanup retained staging fixtures because an admitted receipt did not settle");
          error.code = "STAGING_AI_RECOVERY_ADMITTED_UNKNOWN";
          throw error;
        }
        await wait(Math.min(settlementPollMs, Math.max(1, deadline - now())));
        continue;
      }
      if (expiryWindowClosed) break;
      const receiptsById = new Map(receipts.map((item) => [String(item._id), item]));
      const expiries = [...ids.jtis].map((jti) => {
        const receipt = receiptsById.get(jti);
        return receipt ? new Date(receipt.expiresAt).getTime() : ids.capabilityExpiries.get(jti);
      });
      const latestExpiry = Math.max(...expiries);
      if (!Number.isFinite(latestExpiry)) {
        const error = new Error("Cleanup refuses receipt without an exact expiry");
        error.code = "STAGING_AI_CLEANUP_RECEIPT_EXPIRY_INVALID";
        throw error;
      }
      const remaining = latestExpiry + expirySkewMs - now();
      if (remaining > 0) await wait(remaining);
      expiryWindowClosed = true;
    }
    if (!revoked) {
      const error = new Error("Cleanup requires a revoked staging acceptance run tombstone");
      error.code = "STAGING_AI_CLEANUP_TOMBSTONE_MISSING";
      throw error;
    }
  };
  const assertNoUnexpectedCapabilities = async (available) => {
    if (!available.has(controlCollection)) return;
    const receipts = await db.collection(controlCollection).find(
      { runId, recordType: "capability" },
      { projection: { _id: 1 } },
    ).toArray();
    const unexpected = receipts.some((item) => !ids.jtis.has(String(item._id)));
    if (unexpected) {
      const error = new Error("Cleanup refuses a capability outside the exact run inventory");
      error.code = "STAGING_AI_CLEANUP_UNEXPECTED_CAPABILITY";
      throw error;
    }
  };
  const assertRejectedFixtureHasNoKnowledge = async (available) => {
    if (fixtureCreateJournal?.journalVersion !== 2 || fixtureCreateJournal.outcome !== "rejected" ||
        !available.has("knowledgeentries")) return;
    if (await db.collection("knowledgeentries").countDocuments({
      normalizedQuestion: fixtureNormalizedQuestion,
    }) !== 0) {
      const error = new Error("Rejected fixture proof conflicts with a persisted Knowledge Entry");
      error.code = "STAGING_AI_RECOVERY_FIXTURE_REJECTION_CONFLICT";
      throw error;
    }
  };
  const cleanup = async () => {
    if (uncertainMutationStartedAt) {
      const remaining = unknownOutcomeWaitMs - (now() - uncertainMutationStartedAt);
      if (remaining > 0) await wait(remaining);
    }
    const available = await existing();
    await ensureRevokedTombstone(available);
    if (requireFixtureCreateProof) {
      fixtureCreateJournal = await assertFixtureCreateTerminal({
        collection: db.collection(controlCollection), runId, releaseSha,
        marker: `htcoaching-acceptance:${runId}`,
      });
      if (fixtureCreateJournal.journalVersion === 2 && fixtureCreateJournal.outcome === "rejected") {
        registerKnowledgeQuestion(fixtureNormalizedQuestion);
      }
    }
    await assertRejectedFixtureHasNoKnowledge(available);
    await assertReceiptsTerminalAndExpired(available);
    await assertNoUnexpectedCapabilities(available);
    await assertRejectedFixtureHasNoKnowledge(available);
    if (available.has("knowledgeentries") && ids.knowledgeQuestions.size &&
        fixtureCreateJournal?.outcome !== "rejected") {
      const discovered = await db.collection("knowledgeentries")
        .find({ normalizedQuestion: { $in: [...ids.knowledgeQuestions] } }, { projection: { _id: 1 } })
        .toArray();
      for (const entry of discovered) registerKnowledgeEntry(entry._id);
    }
    const all = filters();
    // Delete capability receipts before their synthetic actors. If this phase
    // is interrupted, a subsequent recovery can still authenticate every
    // remaining receipt against its actor while the run tombstone blocks replay.
    for (const name of [controlCollection, "knowledgeentries", "chatconversations", "serviceusagebuckets", "aimemories", "aimemorypreferences", "aitoolconfirmations", "aimoderationstates", "users"]) {
      await assertRejectedFixtureHasNoKnowledge(available);
      if (available.has(name)) await db.collection(name).deleteMany(all[name]);
      if (name === controlCollection) {
        await assertNoUnexpectedCapabilities(available);
        if (await db.collection(controlCollection).countDocuments({ runId, recordType: "capability" }) !== 0) {
          const error = new Error("Cleanup retained actors because a capability admission raced deletion");
          error.code = "STAGING_AI_RECOVERY_ADMITTED_UNKNOWN";
          throw error;
        }
      }
    }
    if (!retainRunTombstone && !requireFixtureCreateProof && available.has(controlCollection)) {
      await db.collection(controlCollection).deleteOne({ _id: runId, recordType: "run", runId, state: "revoked" });
    }
  };
  const verify = async ({ allowFixtureJournal = false } = {}) => {
    const available = await existing();
    const all = filters();
    all[controlCollection] = retainRunTombstone
      ? { runId, _id: { $nin: allowFixtureJournal
          ? [runId, fixtureCreateJournalId(runId)] : [runId] } }
      : { runId };
    const collections = {};
    for (const [name, filter] of Object.entries(all)) {
      collections[name] = available.has(name)
        ? await db.collection(name).countDocuments(filter)
        : 0;
    }
    if (available.has("knowledgeentries") && ids.knowledgeQuestions.size) {
      collections.knowledgeQuestionDiscovery = await db.collection("knowledgeentries")
        .countDocuments({ normalizedQuestion: { $in: [...ids.knowledgeQuestions] } });
    }
    if (outcomeUnknown) {
      const error = new Error("Cleanup cannot prove a terminal remote mutation outcome");
      error.code = "STAGING_AI_CLEANUP_OUTCOME_UNKNOWN";
      throw error;
    }
    return { residue: Object.values(collections).reduce((sum, n) => sum + n, 0), collections };
  };
  const deleteRunTombstone = async () => {
    if (!retainRunTombstone) return false;
    const available = await existing();
    if (!available.has(controlCollection)) {
      const error = new Error("Recovery could not find its run tombstone collection");
      error.code = "STAGING_AI_RECOVERY_TOMBSTONE_DELETE_FAILED";
      throw error;
    }
    const lateReceipts = await db.collection(controlCollection).countDocuments({
      runId,
      recordType: "capability",
    });
    if (lateReceipts !== 0) {
      const error = new Error("Recovery retained its tombstone because late capability receipts appeared");
      error.code = "STAGING_AI_RECOVERY_LATE_RECEIPT";
      throw error;
    }
    const result = await db.collection(controlCollection).deleteOne({
      _id: runId,
      recordType: "run",
      runId,
      state: "revoked",
    });
    if (result.acknowledged !== true) {
      const error = new Error("Recovery could not acknowledge tombstone deletion");
      error.code = "STAGING_AI_RECOVERY_TOMBSTONE_DELETE_FAILED";
      throw error;
    }
    if (result.deletedCount !== 1) {
      const error = new Error("Recovery could not delete the exact run tombstone");
      error.code = "STAGING_AI_RECOVERY_TOMBSTONE_DELETE_FAILED";
      throw error;
    }
    return true;
  };
  return {
    registerUser,
    registerKnowledgeEntry,
    registerKnowledgeQuestion,
    registerCapabilityJti,
    markMutationStart,
    markMutationSettled,
    cleanup,
    verify,
    deleteRunTombstone,
    ids,
  };
};
