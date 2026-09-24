import { describe, expect, it } from "vitest";

import {
  QUESTION_ANSWERING_EMBEDDING_VERSION,
  buildStagingKnowledgeBaseReembedPlan,
  createKnowledgeContentHash,
  createKnowledgeVectorStateHash,
  extractKnowledgeVectorState,
  verifyKnowledgeReembedPostState,
  verifyKnowledgeRollbackPostState,
  verifyKnowledgeRollbackPreState,
} from "../stagingKnowledgeBaseReembed.js";

const NOW = new Date("2026-09-14T06:00:00.000Z");
const VECTOR = Array.from({ length: 768 }, (_, index) => index / 768);
const SECOND_VECTOR = Array.from(
  { length: 768 },
  (_, index) => (768 - index) / 768,
);
const legacyEntry = (overrides = {}) => ({
  _id: "66e64e000000000000000001",
  question: "Creatine có tác dụng gì?",
  embedding: VECTOR,
  variants: [{ text: "Creatine dùng để làm gì?", embedding: SECOND_VECTOR }],
  embeddingStatus: "ready",
  embeddingVersion: "gemini-embedding-2:768",
  embeddingError: null,
  embeddingUpdatedAt: new Date("2026-09-11T01:00:00.000Z"),
  updatedAt: new Date("2026-09-11T01:00:00.000Z"),
  ...overrides,
});
const targetEntry = (entry = legacyEntry()) => ({
  ...entry,
  embedding: SECOND_VECTOR,
  variants: entry.variants.map((variant) => ({ ...variant, embedding: VECTOR })),
  embeddingVersion: QUESTION_ANSWERING_EMBEDDING_VERSION,
  embeddingUpdatedAt: NOW,
  updatedAt: NOW,
});

describe("Knowledge Base re-embed state verification", () => {
  it("rejects content drift even when vector dimensions look valid", () => {
    const original = legacyEntry();
    const plan = buildStagingKnowledgeBaseReembedPlan([original]);
    const changed = targetEntry({
      ...original,
      question: "Creatine có tác dụng gì cho người mới?",
    });

    expect(() =>
      verifyKnowledgeReembedPostState({ plan, entries: [changed] }),
    ).toThrowError(/KB_REEMBED_CONTENT_DRIFT/);
  });

  it("verifies exact target and restored vector-state fingerprints", () => {
    const original = legacyEntry();
    const target = targetEntry(original);
    const plan = buildStagingKnowledgeBaseReembedPlan([original]);
    const targetState = {
      id: String(original._id),
      contentHash: createKnowledgeContentHash(original),
      priorStateHash: createKnowledgeVectorStateHash(original),
      targetEntry: target,
      targetStateHash: createKnowledgeVectorStateHash(target),
    };
    const snapshot = {
      planDigest: plan.planDigest,
      inventory: [
        {
          id: targetState.id,
          contentHash: targetState.contentHash,
          priorStateHash: targetState.priorStateHash,
          expectedTargetStateHash: targetState.targetStateHash,
        },
      ],
      entries: [
        {
          id: targetState.id,
          contentHash: targetState.contentHash,
          priorStateHash: targetState.priorStateHash,
          priorState: extractKnowledgeVectorState(original),
          targetStateHash: targetState.targetStateHash,
        },
      ],
    };

    expect(
      verifyKnowledgeReembedPostState({
        plan,
        targetStates: [targetState],
        entries: [target],
      }),
    ).toEqual({ valid: true, documentsVerified: 1 });
    expect(
      verifyKnowledgeRollbackPreState({ snapshot, entries: [target] }),
    ).toEqual({ valid: true, documentsVerified: 1 });
    expect(
      verifyKnowledgeRollbackPostState({ snapshot, entries: [original] }),
    ).toEqual({ valid: true, documentsVerified: 1 });
  });
});
