import { describe, expect, it, vi } from "vitest";

import {
  applyStagingKnowledgeBaseRollback,
  applyStagingKnowledgeBaseTargetStates,
  buildStagingKnowledgeBaseReembedPlan,
  createKnowledgeContentHash,
  createKnowledgeVectorStateHash,
  extractKnowledgeVectorState,
} from "../stagingKnowledgeBaseReembed.js";

const NOW = new Date("2026-09-14T06:00:00.000Z");
const VECTOR = Array.from({ length: 768 }, (_, index) => index / 768);
const SECOND_VECTOR = Array.from(
  { length: 768 },
  (_, index) => (768 - index) / 768,
);
const legacyEntry = () => ({
  _id: "66e64e000000000000000001",
  question: "Creatine có tác dụng gì?",
  embedding: VECTOR,
  variants: [{ text: "Creatine dùng để làm gì?", embedding: SECOND_VECTOR }],
  embeddingStatus: "ready",
  embeddingVersion: "gemini-embedding-2:768",
  embeddingError: null,
  embeddingUpdatedAt: new Date("2026-09-11T01:00:00.000Z"),
  updatedAt: new Date("2026-09-11T01:00:00.000Z"),
});
const targetEntry = (entry) => ({
  ...entry,
  embedding: SECOND_VECTOR,
  variants: entry.variants.map((variant) => ({ ...variant, embedding: VECTOR })),
  embeddingVersion: "gemini-embedding-2:768:question-answering-v1",
  embeddingUpdatedAt: NOW,
  updatedAt: NOW,
});
const connection = (findOne, inventoryEntries) => {
  const inventories = Array.isArray(inventoryEntries?.[0])
    ? inventoryEntries
    : [inventoryEntries];
  const toArray = vi.fn();
  inventories.forEach((entries) => toArray.mockResolvedValueOnce(entries));
  const collection = {
    findOne,
    find: vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({ toArray }),
      }),
    }),
    updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }),
  };
  const session = {
    withTransaction: vi.fn((callback) => callback()),
    endSession: vi.fn(),
  };
  return {
    value: {
      collection: vi.fn().mockReturnValue(collection),
      startSession: vi.fn().mockResolvedValue(session),
    },
    collection,
    session,
  };
};

describe("Knowledge Base re-embed Mongo compare-and-set", () => {
  it("updates and verifies the complete corpus in one transaction", async () => {
    const original = legacyEntry();
    const target = targetEntry(original);
    const database = connection(vi.fn().mockResolvedValue(original), [
      [original],
      [target],
    ]);

    await expect(
      applyStagingKnowledgeBaseTargetStates({
        connection: database.value,
        plan: buildStagingKnowledgeBaseReembedPlan([original]),
        targetStates: [
          {
            id: String(original._id),
            contentHash: createKnowledgeContentHash(original),
            priorStateHash: createKnowledgeVectorStateHash(original),
            targetEntry: target,
            targetStateHash: createKnowledgeVectorStateHash(target),
          },
        ],
      }),
    ).resolves.toEqual({ documentsUpdated: 1 });
    expect(database.collection.updateOne).toHaveBeenCalledOnce();
  });

  it("rejects full-corpus drift before the first database write", async () => {
    const original = legacyEntry();
    const target = targetEntry(original);
    const inserted = {
      ...legacyEntry(),
      _id: "66e64e000000000000000002",
      question: "Document mới",
    };
    const database = connection(vi.fn().mockResolvedValue(original), [
      original,
      inserted,
    ]);

    await expect(
      applyStagingKnowledgeBaseTargetStates({
        connection: database.value,
        plan: buildStagingKnowledgeBaseReembedPlan([original]),
        targetStates: [
          {
            id: String(original._id),
            contentHash: createKnowledgeContentHash(original),
            priorStateHash: createKnowledgeVectorStateHash(original),
            targetEntry: target,
            targetStateHash: createKnowledgeVectorStateHash(target),
          },
        ],
      }),
    ).rejects.toThrowError(/KB_REEMBED_TRANSACTION_PLAN_DRIFT/);
    expect(database.collection.updateOne).not.toHaveBeenCalled();
  });

  it("rejects source drift before the first database write", async () => {
    const original = legacyEntry();
    const target = targetEntry(original);
    const drifted = { ...original, question: "Nội dung đã đổi" };
    const database = connection(vi.fn().mockResolvedValue(drifted), [original]);

    await expect(
      applyStagingKnowledgeBaseTargetStates({
        connection: database.value,
        plan: buildStagingKnowledgeBaseReembedPlan([original]),
        targetStates: [
          {
            id: String(original._id),
            contentHash: createKnowledgeContentHash(original),
            priorStateHash: createKnowledgeVectorStateHash(original),
            targetEntry: target,
            targetStateHash: createKnowledgeVectorStateHash(target),
          },
        ],
      }),
    ).rejects.toThrowError(/KB_REEMBED_CONTENT_DRIFT/);
    expect(database.collection.updateOne).not.toHaveBeenCalled();
    expect(database.session.endSession).toHaveBeenCalledOnce();
  });

  it("rejects rollback when live target vectors no longer match the snapshot", async () => {
    const original = legacyEntry();
    const target = targetEntry(original);
    const driftedTarget = { ...target, embedding: VECTOR };
    const database = connection(
      vi.fn().mockResolvedValue(driftedTarget),
      [driftedTarget],
    );

    await expect(
      applyStagingKnowledgeBaseRollback({
        connection: database.value,
        snapshot: {
          inventory: [
            {
              id: String(original._id),
              contentHash: createKnowledgeContentHash(original),
              priorStateHash: createKnowledgeVectorStateHash(original),
              expectedTargetStateHash: createKnowledgeVectorStateHash(target),
            },
          ],
          entries: [
            {
              id: String(original._id),
              contentHash: createKnowledgeContentHash(original),
              priorStateHash: createKnowledgeVectorStateHash(original),
              priorState: extractKnowledgeVectorState(original),
              targetStateHash: createKnowledgeVectorStateHash(target),
            },
          ],
        },
      }),
    ).rejects.toThrowError(/KB_REEMBED_ROLLBACK_TARGET_STATE_DRIFT/);
    expect(database.collection.updateOne).not.toHaveBeenCalled();
  });
});
