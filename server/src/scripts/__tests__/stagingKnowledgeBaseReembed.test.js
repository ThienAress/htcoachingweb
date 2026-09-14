import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  clearCollections,
  setupTestDB,
  teardownTestDB,
} from "../../__tests__/setup.js";

import {
  QUESTION_ANSWERING_EMBEDDING_VERSION,
  applyStagingKnowledgeBaseRollback,
  applyStagingKnowledgeBaseTargetStates,
  buildKnowledgeSnapshotPayload,
  buildStagingKnowledgeBaseReembedPlan,
  createEncryptedKnowledgeSnapshot,
  createKnowledgeContentHash,
  createKnowledgeVectorStateHash,
  loadStagingKnowledgeEntries,
  readEncryptedKnowledgeSnapshot,
  validateStagingKnowledgeBaseReembedAuthorization,
  verifyKnowledgeRollbackPreState,
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

describe("staging Knowledge Base rollback prior-state compatibility", () => {
  beforeAll(setupTestDB);
  afterEach(clearCollections);
  afterAll(teardownTestDB);

  const applyWithSnapshot = async (overrides) => {
    const original = legacyEntry({
      _id: new mongoose.Types.ObjectId(),
      embeddingVersion: QUESTION_ANSWERING_EMBEDDING_VERSION,
      ...overrides,
    });
    await mongoose.connection.collection("knowledgeentries").insertOne(original);
    const before = await loadStagingKnowledgeEntries({
      connection: mongoose.connection,
    });
    const plan = buildStagingKnowledgeBaseReembedPlan(before);
    const target = targetEntry(before[0]);
    const targetStates = [
      {
        id: String(original._id),
        contentHash: createKnowledgeContentHash(before[0]),
        priorStateHash: createKnowledgeVectorStateHash(before[0]),
        targetEntry: target,
        targetStateHash: createKnowledgeVectorStateHash(target),
      },
    ];
    const snapshot = buildKnowledgeSnapshotPayload({
      plan,
      entries: before,
      targetStates,
      snapshotId: `kb-reembed-staging-20260914T060000Z-${plan.planDigest.slice(0, 8)}`,
      now: NOW,
    });

    await applyStagingKnowledgeBaseTargetStates({
      connection: mongoose.connection,
      plan,
      targetStates,
    });
    return { before, targetStates, snapshot };
  };

  it.each(["failed", "pending"])(
    "restores exact target-version %s prior state after apply",
    async (embeddingStatus) => {
      const { before, targetStates, snapshot } = await applyWithSnapshot({
        embedding: [],
        variants: [{ text: "Creatine dùng để làm gì?", embedding: [] }],
        embeddingStatus,
        embeddingError:
          embeddingStatus === "failed" ? "EMBEDDING_UNAVAILABLE" : null,
        embeddingUpdatedAt:
          embeddingStatus === "failed"
            ? null
            : new Date("2026-09-11T01:00:00.000Z"),
      });
      const applied = await loadStagingKnowledgeEntries({
        connection: mongoose.connection,
      });
      expect(
        verifyKnowledgeRollbackPreState({ snapshot, entries: applied }),
      ).toEqual({ valid: true, documentsVerified: 1 });
      await applyStagingKnowledgeBaseRollback({
        connection: mongoose.connection,
        snapshot,
      });
      const after = await loadStagingKnowledgeEntries({
        connection: mongoose.connection,
      });

      expect({
        entry: after[0],
        contentHash: createKnowledgeContentHash(after[0]),
        vectorStateHash: createKnowledgeVectorStateHash(after[0]),
      }).toEqual({
        entry: before[0],
        contentHash: targetStates[0].contentHash,
        vectorStateHash: targetStates[0].priorStateHash,
      });
    },
  );

  it.each(["failed", "pending"])(
    "round-trips an encrypted snapshot and restores %s root and variant state",
    async (embeddingStatus) => {
      const temporaryDirectory = await mkdtemp(
        path.join(os.tmpdir(), "ht-kb-reembed-rollback-"),
      );
      try {
        const original = legacyEntry({
          _id: new mongoose.Types.ObjectId(),
          embedding: [],
          variants: [{ text: "Creatine dùng để làm gì?", embedding: [] }],
          embeddingStatus,
          embeddingVersion: QUESTION_ANSWERING_EMBEDDING_VERSION,
          embeddingError:
            embeddingStatus === "failed" ? "EMBEDDING_UNAVAILABLE" : null,
          embeddingUpdatedAt:
            embeddingStatus === "failed"
              ? null
              : new Date("2026-09-11T01:00:00.000Z"),
        });
        await mongoose.connection.collection("knowledgeentries").insertOne(original);
        const before = await loadStagingKnowledgeEntries({
          connection: mongoose.connection,
        });
        const plan = buildStagingKnowledgeBaseReembedPlan(before);
        const target = targetEntry(before[0]);
        const targetStates = [{
          id: String(before[0]._id),
          contentHash: createKnowledgeContentHash(before[0]),
          priorStateHash: createKnowledgeVectorStateHash(before[0]),
          targetEntry: target,
          targetStateHash: createKnowledgeVectorStateHash(target),
        }];
        const payload = buildKnowledgeSnapshotPayload({
          plan,
          entries: before,
          targetStates,
          snapshotId: `kb-reembed-staging-20260914T060000Z-${plan.planDigest.slice(0, 8)}`,
          now: NOW,
        });
        const written = await createEncryptedKnowledgeSnapshot({
          directory: temporaryDirectory,
          secret: validEnv().KB_REEMBED_SNAPSHOT_KEY,
          payload,
        });
        const snapshot = await readEncryptedKnowledgeSnapshot({
          filePath: written.filePath,
          secret: validEnv().KB_REEMBED_SNAPSHOT_KEY,
        });

        await applyStagingKnowledgeBaseTargetStates({
          connection: mongoose.connection,
          plan,
          targetStates,
        });
        await applyStagingKnowledgeBaseRollback({
          connection: mongoose.connection,
          snapshot,
        });
        const after = await loadStagingKnowledgeEntries({
          connection: mongoose.connection,
        });
        await rm(temporaryDirectory, { recursive: true, force: true });

        expect({
          priorStateHash: createKnowledgeVectorStateHash(before[0]),
          restoredStateHash: createKnowledgeVectorStateHash(after[0]),
          embeddingStatus: after[0].embeddingStatus,
          embedding: after[0].embedding,
          variantEmbeddings: after[0].variants.map((variant) => variant.embedding),
          snapshotDirectoryRemoved: await access(temporaryDirectory)
            .then(() => false)
            .catch(() => true),
        }).toEqual({
          priorStateHash: targetStates[0].priorStateHash,
          restoredStateHash: targetStates[0].priorStateHash,
          embeddingStatus,
          embedding: [],
          variantEmbeddings: [[]],
          snapshotDirectoryRemoved: true,
        });
      } finally {
        await rm(temporaryDirectory, { recursive: true, force: true });
      }
    },
  );

  it.each([
    ["empty root", { embedding: [] }, /KB_REEMBED_TARGET_VECTOR_STATE_INVALID/],
    [
      "empty variant",
      { variants: [{ text: "Biến thể?", embedding: [] }] },
      /KB_REEMBED_TARGET_VECTOR_STATE_INVALID/,
    ],
    ["wrong dimension", { embedding: [1, 2, 3] }, /KB_REEMBED_VECTOR_STATE_INVALID/],
    [
      "non-finite component",
      { embedding: VECTOR.map(() => NaN) },
      /KB_REEMBED_VECTOR_STATE_INVALID/,
    ],
  ])(
    "rejects a ready prior state with %s without changing the target",
    async (_label, overrides, error) => {
      const { snapshot, targetStates } = await applyWithSnapshot(overrides);
      const applied = await loadStagingKnowledgeEntries({
        connection: mongoose.connection,
      });

      expect(() =>
        verifyKnowledgeRollbackPreState({ snapshot, entries: applied }),
      ).toThrowError(error);

      await expect(
        applyStagingKnowledgeBaseRollback({
          connection: mongoose.connection,
          snapshot,
        }),
      ).rejects.toThrowError(error);
      const after = await loadStagingKnowledgeEntries({
        connection: mongoose.connection,
      });

      expect(createKnowledgeVectorStateHash(after[0])).toBe(
        targetStates[0].targetStateHash,
      );
    },
  );

  it.each(["failed", "pending"])(
    "rejects forward apply of a %s target state",
    async (embeddingStatus) => {
      const original = legacyEntry({ _id: new mongoose.Types.ObjectId() });
      await mongoose.connection.collection("knowledgeentries").insertOne(original);
      const target = { ...targetEntry(original), embeddingStatus };
      const priorStateHash = createKnowledgeVectorStateHash(original);

      await expect(
        applyStagingKnowledgeBaseTargetStates({
          connection: mongoose.connection,
          plan: buildStagingKnowledgeBaseReembedPlan([original]),
          targetStates: [
            {
              id: String(original._id),
              contentHash: createKnowledgeContentHash(original),
              priorStateHash,
              targetEntry: target,
              targetStateHash: createKnowledgeVectorStateHash(target),
            },
          ],
        }),
      ).rejects.toThrowError(/KB_REEMBED_TARGET_VECTOR_STATE_INVALID/);
      const after = await loadStagingKnowledgeEntries({
        connection: mongoose.connection,
      });

      expect(createKnowledgeVectorStateHash(after[0])).toBe(priorStateHash);
    },
  );

  it.each([
    [
      "invalid date",
      { embeddingUpdatedAt: "not-a-date" },
      /KB_REEMBED_VECTOR_STATE_DATE_INVALID/,
    ],
    [
      "variant count drift",
      { variantEmbeddings: [] },
      /KB_REEMBED_VARIANT_COUNT_DRIFT/,
    ],
  ])(
    "rejects prior-state %s during preflight and rollback",
    async (_label, overrides, error) => {
      const { snapshot, targetStates } = await applyWithSnapshot({
        embeddingStatus: "pending",
        embedding: [],
        variants: [{ text: "Creatine dùng để làm gì?", embedding: [] }],
      });
      Object.assign(snapshot.entries[0].priorState, overrides);
      const applied = await loadStagingKnowledgeEntries({
        connection: mongoose.connection,
      });

      expect(() =>
        verifyKnowledgeRollbackPreState({ snapshot, entries: applied }),
      ).toThrowError(error);
      await expect(
        applyStagingKnowledgeBaseRollback({
          connection: mongoose.connection,
          snapshot,
        }),
      ).rejects.toThrowError(error);
      const after = await loadStagingKnowledgeEntries({
        connection: mongoose.connection,
      });

      expect(createKnowledgeVectorStateHash(after[0])).toBe(
        targetStates[0].targetStateHash,
      );
    },
  );
});
