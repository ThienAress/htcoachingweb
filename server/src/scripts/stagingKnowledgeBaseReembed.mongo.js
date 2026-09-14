import mongoose from "mongoose";

import {
  buildKnowledgeVectorUpdateSet,
  buildStagingKnowledgeBaseReembedPlan,
  createKnowledgeContentHash,
  createKnowledgeVectorStateHash,
  extractKnowledgeVectorState,
  verifyKnowledgeReembedPostState,
  verifyKnowledgeRollbackPostState,
  verifyKnowledgeRollbackPreState,
} from "./stagingKnowledgeBaseReembed.state.js";

const COLLECTION_NAME = "knowledgeentries";
const MAX_DOCUMENTS = 5000;
const PROJECTION = {
  question: 1,
  embedding: 1,
  variants: 1,
  embeddingStatus: 1,
  embeddingVersion: 1,
  embeddingError: 1,
  embeddingUpdatedAt: 1,
};

const fail = (code, message = code) =>
  Object.assign(new Error(`${code}: ${message}`), { code });

const toDatabaseId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw fail("KB_REEMBED_ENTRY_ID_INVALID");
  }
  return new mongoose.Types.ObjectId(id);
};

const assertLiveState = ({
  liveEntry,
  contentHash,
  stateHash,
  contentError,
  stateError,
}) => {
  if (!liveEntry) throw fail("KB_REEMBED_DOCUMENT_MISSING");
  if (createKnowledgeContentHash(liveEntry) !== contentHash) {
    throw fail(contentError);
  }
  if (createKnowledgeVectorStateHash(liveEntry) !== stateHash) {
    throw fail(stateError);
  }
};

const loadCollectionEntries = async (collection, { session } = {}) => {
  const entries = await collection
    .find({}, { projection: PROJECTION, ...(session && { session }) })
    .sort({ _id: 1 })
    .limit(MAX_DOCUMENTS + 1)
    .toArray();
  if (entries.length > MAX_DOCUMENTS) {
    throw fail("KB_REEMBED_DOCUMENT_LIMIT_EXCEEDED");
  }
  return entries;
};

const transactUpdates = async ({
  connection,
  updates,
  rollback = false,
  plan,
  snapshot,
}) => {
  if (updates.length === 0) return { documentsUpdated: 0 };
  const collection = connection.collection(COLLECTION_NAME);
  const session = await connection.startSession();
  try {
    await session.withTransaction(
      async () => {
        const initialEntries = await loadCollectionEntries(collection, {
          session,
        });
        if (rollback) {
          verifyKnowledgeRollbackPreState({ snapshot, entries: initialEntries });
        } else if (
          buildStagingKnowledgeBaseReembedPlan(initialEntries).planDigest !==
          plan?.planDigest
        ) {
          throw fail("KB_REEMBED_TRANSACTION_PLAN_DRIFT");
        }
        for (const update of updates) {
          const databaseId = toDatabaseId(update.id);
          const liveEntry = await collection.findOne(
            { _id: databaseId },
            { projection: PROJECTION, session },
          );
          assertLiveState({
            liveEntry,
            contentHash: update.contentHash,
            stateHash: rollback
              ? update.targetStateHash
              : update.priorStateHash,
            contentError: rollback
              ? "KB_REEMBED_ROLLBACK_CONTENT_DRIFT"
              : "KB_REEMBED_CONTENT_DRIFT",
            stateError: rollback
              ? "KB_REEMBED_ROLLBACK_TARGET_STATE_DRIFT"
              : "KB_REEMBED_SOURCE_STATE_DRIFT",
          });
          const nextState = rollback
            ? update.priorState
            : extractKnowledgeVectorState(update.targetEntry);
          const updateSet = buildKnowledgeVectorUpdateSet(liveEntry, nextState, {
            rollback,
          });
          const result = await collection.updateOne(
            { _id: databaseId },
            { $set: updateSet },
            { session },
          );
          if (result.matchedCount !== 1) {
            throw fail("KB_REEMBED_CAS_UPDATE_MISSED");
          }
          const updatedEntry = { ...liveEntry, ...updateSet };
          const expectedHash = rollback
            ? update.priorStateHash
            : update.targetStateHash;
          if (createKnowledgeVectorStateHash(updatedEntry) !== expectedHash) {
            throw fail(
              rollback
                ? "KB_REEMBED_ROLLBACK_WRITE_MISMATCH"
                : "KB_REEMBED_TARGET_WRITE_MISMATCH",
            );
          }
        }
        const finalEntries = await loadCollectionEntries(collection, { session });
        if (rollback) {
          verifyKnowledgeRollbackPostState({ snapshot, entries: finalEntries });
        } else {
          verifyKnowledgeReembedPostState({
            plan,
            targetStates: updates,
            entries: finalEntries,
          });
        }
      },
      {
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
      },
    );
  } finally {
    await session.endSession();
  }
  return { documentsUpdated: updates.length };
};

export const loadStagingKnowledgeEntries = async ({ connection }) =>
  loadCollectionEntries(connection.collection(COLLECTION_NAME));

export const applyStagingKnowledgeBaseTargetStates = async ({
  connection,
  plan,
  targetStates,
}) => transactUpdates({ connection, updates: targetStates, plan });

export const applyStagingKnowledgeBaseRollback = async ({
  connection,
  snapshot,
}) =>
  transactUpdates({
    connection,
    updates: snapshot.entries,
    rollback: true,
    snapshot,
  });
