import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  QUESTION_ANSWERING_EMBEDDING_VERSION,
  buildKnowledgeSnapshotPayload,
  buildStagingKnowledgeBaseReembedPlan,
  createEncryptedKnowledgeSnapshot,
  createKnowledgeContentHash,
  createKnowledgeVectorStateHash,
  readEncryptedKnowledgeSnapshot,
  validateStagingKnowledgeBaseReembedAuthorization,
} from "../stagingKnowledgeBaseReembed.js";

const NOW = new Date("2026-09-14T06:00:00.000Z");
const VECTOR = Array.from({ length: 768 }, (_, index) => index / 768);
const SECOND_VECTOR = Array.from(
  { length: 768 },
  (_, index) => (768 - index) / 768,
);
const validEnv = () => ({
  APP_ENV: "staging",
  MIGRATION_TARGET_DATABASE: "htcoaching_staging",
  MONGO_URI:
    "mongodb+srv://cluster.example/htcoaching_staging?retryWrites=true",
  CONFIRM_KB_REEMBED_STAGING: "yes",
  CONFIRM_KB_REEMBED_ROLLBACK_STAGING: "yes",
  KB_REEMBED_SNAPSHOT_KEY: "synthetic-test-key-that-is-longer-than-32-characters",
  KB_REEMBED_SNAPSHOT_DIR: path.join(os.tmpdir(), "ht-kb-reembed-tests"),
});
const legacyEntry = (overrides = {}) => ({
  _id: "66e64e000000000000000001",
  question: "Creatine có tác dụng gì?",
  embedding: VECTOR,
  variants: [
    {
      _id: "66e64e000000000000000011",
      text: "Creatine dùng để làm gì?",
      embedding: SECOND_VECTOR,
    },
  ],
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
  variants: entry.variants.map((variant) => ({
    ...variant,
    embedding: VECTOR,
  })),
  embeddingStatus: "ready",
  embeddingVersion: QUESTION_ANSWERING_EMBEDDING_VERSION,
  embeddingError: null,
  embeddingUpdatedAt: NOW,
  updatedAt: NOW,
});

describe("staging Knowledge Base re-embed authorization", () => {
  it("allows a read-only staging preflight without mutation secrets", () => {
    const env = validEnv();
    delete env.CONFIRM_KB_REEMBED_STAGING;
    delete env.KB_REEMBED_SNAPSHOT_KEY;
    delete env.KB_REEMBED_SNAPSHOT_DIR;

    expect(
      validateStagingKnowledgeBaseReembedAuthorization({
        argv: ["--target=staging"],
        env,
      }),
    ).toMatchObject({ apply: false, operation: "reembed" });
  });

  it("rejects every non-staging target before a connection is opened", () => {
    expect(() =>
      validateStagingKnowledgeBaseReembedAuthorization({
        argv: ["--target=production"],
        env: { ...validEnv(), APP_ENV: "production" },
      }),
    ).toThrowError(/KB_REEMBED_STAGING_TARGET_REQUIRED/);
  });

  it("requires confirmation, reviewed digest and snapshot custody for apply", () => {
    const env = validEnv();
    delete env.CONFIRM_KB_REEMBED_STAGING;
    delete env.KB_REEMBED_SNAPSHOT_KEY;
    delete env.KB_REEMBED_SNAPSHOT_DIR;

    expect(() =>
      validateStagingKnowledgeBaseReembedAuthorization({
        argv: ["--target=staging", "--apply"],
        env,
      }),
    ).toThrowError(
      /KB_REEMBED_STAGING_CONFIRMATION_REQUIRED.*KB_REEMBED_PLAN_DIGEST_REQUIRED.*KB_REEMBED_SNAPSHOT_DIR_REQUIRED.*KB_REEMBED_SNAPSHOT_KEY_REQUIRED/,
    );
  });
});

describe("staging Knowledge Base re-embed planning", () => {
  it("creates a deterministic plan over root and variant vectors", () => {
    const first = buildStagingKnowledgeBaseReembedPlan([legacyEntry()]);
    const second = buildStagingKnowledgeBaseReembedPlan([legacyEntry()]);

    expect(first).toMatchObject({
      planDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
      summary: {
        documents: 1,
        documentsToUpdate: 1,
        rootEmbeddingsToGenerate: 1,
        variantEmbeddingsToGenerate: 1,
        providerCalls: 2,
      },
    });
    expect(second.planDigest).toBe(first.planDigest);
    expect(first.entries[0]).toMatchObject({
      id: "66e64e000000000000000001",
      contentHash: createKnowledgeContentHash(legacyEntry()),
      priorStateHash: createKnowledgeVectorStateHash(legacyEntry()),
      needsUpdate: true,
    });
  });

  it("is an idempotent no-op when every vector already uses the target profile", () => {
    expect(buildStagingKnowledgeBaseReembedPlan([targetEntry()]).summary).toEqual({
      documents: 1,
      documentsToUpdate: 0,
      rootEmbeddingsToGenerate: 0,
      variantEmbeddingsToGenerate: 0,
      providerCalls: 0,
    });
  });
});

describe("encrypted Knowledge Base snapshot", () => {
  let temporaryDirectory;

  afterEach(async () => {
    if (temporaryDirectory) {
      await rm(temporaryDirectory, { recursive: true, force: true });
      temporaryDirectory = null;
    }
  });

  it("round-trips an authenticated encrypted snapshot without plaintext", async () => {
    temporaryDirectory = await mkdtemp(
      path.join(os.tmpdir(), "ht-kb-reembed-snapshot-"),
    );
    const original = legacyEntry();
    const target = targetEntry(original);
    const plan = buildStagingKnowledgeBaseReembedPlan([original]);
    const payload = buildKnowledgeSnapshotPayload({
      plan,
      entries: [original],
      targetStates: [
        {
          id: String(original._id),
          contentHash: createKnowledgeContentHash(original),
          priorStateHash: createKnowledgeVectorStateHash(original),
          targetEntry: target,
          targetStateHash: createKnowledgeVectorStateHash(target),
        },
      ],
      snapshotId: `kb-reembed-staging-20260914T060000Z-${plan.planDigest.slice(0, 8)}`,
      now: NOW,
    });

    const written = await createEncryptedKnowledgeSnapshot({
      directory: temporaryDirectory,
      secret: validEnv().KB_REEMBED_SNAPSHOT_KEY,
      payload,
    });
    const rawFile = await readFile(written.filePath, "utf8");
    const restored = await readEncryptedKnowledgeSnapshot({
      filePath: written.filePath,
      secret: validEnv().KB_REEMBED_SNAPSHOT_KEY,
    });

    expect(restored).toEqual(payload);
    expect(rawFile).not.toContain("Creatine");
    expect(rawFile).not.toContain(String(VECTOR[767]));
  });

  it("rejects an incomplete rollback inventory before writing the snapshot", async () => {
    temporaryDirectory = await mkdtemp(
      path.join(os.tmpdir(), "ht-kb-reembed-snapshot-"),
    );
    const original = legacyEntry();
    const target = targetEntry(original);
    const plan = buildStagingKnowledgeBaseReembedPlan([original]);
    const payload = buildKnowledgeSnapshotPayload({
      plan,
      entries: [original],
      targetStates: [
        {
          id: String(original._id),
          contentHash: createKnowledgeContentHash(original),
          priorStateHash: createKnowledgeVectorStateHash(original),
          targetEntry: target,
          targetStateHash: createKnowledgeVectorStateHash(target),
        },
      ],
      snapshotId: `kb-reembed-staging-20260914T060000Z-${plan.planDigest.slice(0, 8)}`,
      now: NOW,
    });
    payload.entries = [];

    await expect(createEncryptedKnowledgeSnapshot({
      directory: temporaryDirectory,
      secret: validEnv().KB_REEMBED_SNAPSHOT_KEY,
      payload,
    })).rejects.toThrowError(/KB_REEMBED_SNAPSHOT_INCOMPLETE/);
  });
});
