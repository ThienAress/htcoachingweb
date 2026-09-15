import mongoose from "mongoose";

const oid = (value) =>
  value instanceof mongoose.Types.ObjectId ? value : new mongoose.Types.ObjectId(String(value));

export const createExactCleanup = ({
  db,
  runId,
  controlCollection = "staging_ai_acceptance_claims",
  unknownOutcomeWaitMs = 125_000,
}) => {
  const ids = { users: new Set(), knowledge: new Set(), knowledgeQuestions: new Set(), jtis: new Set() };
  const registerUser = (value) => ids.users.add(String(value));
  const registerKnowledgeEntry = (value) => ids.knowledge.add(String(value));
  const registerKnowledgeQuestion = (value) => ids.knowledgeQuestions.add(String(value));
  const registerCapabilityJti = (value) => ids.jtis.add(String(value));
  let uncertainMutationStartedAt = null;
  let outcomeUnknown = false;
  const markMutationStart = () => {
    uncertainMutationStartedAt = Date.now();
    outcomeUnknown = true;
  };
  const markMutationSettled = () => {
    uncertainMutationStartedAt = null;
    outcomeUnknown = false;
  };

  const filters = () => {
    const userIds = [...ids.users].map(oid);
    const knowledgeIds = [...ids.knowledge].map(oid);
    const capabilityJtis = [...ids.jtis];
    return {
      [controlCollection]: capabilityJtis.length ? { runId, _id: { $in: capabilityJtis } } : { _id: { $in: [] } },
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
  const cleanup = async () => {
    if (uncertainMutationStartedAt) {
      const remaining = unknownOutcomeWaitMs - (Date.now() - uncertainMutationStartedAt);
      if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
    }
    const available = await existing();
    if (available.has("knowledgeentries") && ids.knowledgeQuestions.size) {
      const discovered = await db.collection("knowledgeentries")
        .find({ normalizedQuestion: { $in: [...ids.knowledgeQuestions] } }, { projection: { _id: 1 } })
        .toArray();
      for (const entry of discovered) registerKnowledgeEntry(entry._id);
    }
    const all = filters();
    for (const name of [controlCollection, "knowledgeentries", "chatconversations", "serviceusagebuckets", "aimemories", "aimemorypreferences", "aitoolconfirmations", "aimoderationstates", "users"]) {
      if (available.has(name)) await db.collection(name).deleteMany(all[name]);
    }
  };
  const verify = async () => {
    const available = await existing();
    const all = filters();
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
  return {
    registerUser,
    registerKnowledgeEntry,
    registerKnowledgeQuestion,
    registerCapabilityJti,
    markMutationStart,
    markMutationSettled,
    cleanup,
    verify,
    ids,
  };
};
