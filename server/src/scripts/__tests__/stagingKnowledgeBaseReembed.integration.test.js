import { afterAll, beforeAll, describe, expect, it } from "vitest";
import mongoose from "mongoose";

import { setupTestDB, teardownTestDB } from "../../__tests__/setup.js";
import {
  applyStagingKnowledgeBaseRollback,
  applyStagingKnowledgeBaseTargetStates,
  buildKnowledgeSnapshotPayload,
  buildStagingKnowledgeBaseReembedPlan,
  createKnowledgeContentHash,
  createKnowledgeVectorStateHash,
  loadStagingKnowledgeEntries,
  verifyKnowledgeRollbackPostState,
} from "../stagingKnowledgeBaseReembed.js";

const NOW = new Date("2026-09-14T06:00:00.000Z");
const OLD_VECTOR = Array.from({ length: 768 }, (_, index) => index / 768);
const NEW_VECTOR = Array.from({ length: 768 }, (_, index) => (768 - index) / 768);
const COLLECTION = "knowledgeentries";

describe("staging re-embed on an isolated Mongo replica set", () => {
  beforeAll(setupTestDB);
  afterAll(teardownTestDB);

  it("applies root and variant vectors, then restores exact previous state", async () => {
    const original = {
      _id: new mongoose.Types.ObjectId(),
      question: "Câu hỏi synthetic về creatine?",
      embedding: OLD_VECTOR,
      variants: [{ text: "Biến thể synthetic?", embedding: OLD_VECTOR }],
      embeddingStatus: "ready",
      embeddingVersion: "gemini-embedding-2:768",
      embeddingError: null,
      embeddingUpdatedAt: new Date("2026-09-11T01:00:00.000Z"),
      updatedAt: new Date("2026-09-11T01:00:00.000Z"),
    };
    await mongoose.connection.collection(COLLECTION).insertOne(original);
    const before = await loadStagingKnowledgeEntries({ connection: mongoose.connection });
    const plan = buildStagingKnowledgeBaseReembedPlan(before);
    const targetEntry = {
      ...before[0],
      embedding: NEW_VECTOR,
      variants: before[0].variants.map((variant) => ({
        ...variant,
        embedding: NEW_VECTOR,
      })),
      embeddingVersion: "gemini-embedding-2:768:question-answering-v1",
      embeddingUpdatedAt: NOW,
      updatedAt: NOW,
    };
    const targetState = {
      id: String(original._id),
      contentHash: createKnowledgeContentHash(before[0]),
      priorStateHash: createKnowledgeVectorStateHash(before[0]),
      targetEntry,
      targetStateHash: createKnowledgeVectorStateHash(targetEntry),
    };
    const snapshot = buildKnowledgeSnapshotPayload({
      plan,
      entries: before,
      targetStates: [targetState],
      snapshotId: "kb-reembed-staging-20260914T060000Z-12345678",
      now: NOW,
    });

    const applied = await applyStagingKnowledgeBaseTargetStates({
      connection: mongoose.connection,
      plan,
      targetStates: [targetState],
    });
    await mongoose.connection.collection(COLLECTION).updateOne(
      { _id: original._id },
      { $set: { updatedAt: new Date("2026-09-14T07:00:00.000Z") } },
    );
    const rolledBack = await applyStagingKnowledgeBaseRollback({
      connection: mongoose.connection,
      snapshot,
    });
    const after = await loadStagingKnowledgeEntries({ connection: mongoose.connection });
    const retainedUpdateTime = await mongoose.connection.collection(COLLECTION).findOne(
      { _id: original._id },
      { projection: { updatedAt: 1 } },
    );

    expect({ applied, rolledBack, updatedAt: retainedUpdateTime.updatedAt.toISOString(), verification: verifyKnowledgeRollbackPostState({ snapshot, entries: after }) }).toEqual({
      applied: { documentsUpdated: 1 },
      rolledBack: { documentsUpdated: 1 },
      updatedAt: "2026-09-14T07:00:00.000Z",
      verification: { valid: true, documentsVerified: 1 },
    });
  });
});
