import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  QUESTION_ANSWERING_EMBEDDING_VERSION,
  buildStagingKnowledgeBaseReembedPlan,
  createKnowledgeContentHash,
  createKnowledgeVectorStateHash,
  assertStagingKnowledgeBackupReady,
  extractKnowledgeVectorState,
  runStagingKnowledgeBaseReembed,
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
  MONGO_URI: "mongodb+srv://cluster.example/htcoaching_staging?retryWrites=true",
  CONFIRM_KB_REEMBED_STAGING: "yes",
  CONFIRM_KB_REEMBED_ROLLBACK_STAGING: "yes",
  KB_REEMBED_SNAPSHOT_KEY: "synthetic-test-key-that-is-longer-than-32-characters",
  KB_REEMBED_SNAPSHOT_DIR: path.join(os.tmpdir(), "ht-kb-reembed-tests"),
});
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
const targetEntry = (entry = legacyEntry()) => ({
  ...entry,
  embedding: SECOND_VECTOR,
  variants: entry.variants.map((variant) => ({ ...variant, embedding: VECTOR })),
  embeddingVersion: QUESTION_ANSWERING_EMBEDDING_VERSION,
  embeddingUpdatedAt: NOW,
  updatedAt: NOW,
});
const dependencies = (entries = [legacyEntry()]) => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  assertConnectedTarget: vi.fn(),
  assertBackupReady: vi.fn(),
  loadEntries: vi.fn().mockResolvedValue(entries),
  generateTargetStates: vi.fn().mockResolvedValue([
    {
      id: String(entries[0]._id),
      contentHash: createKnowledgeContentHash(entries[0]),
      priorStateHash: createKnowledgeVectorStateHash(entries[0]),
      targetEntry: targetEntry(entries[0]),
      targetStateHash: createKnowledgeVectorStateHash(targetEntry(entries[0])),
    },
  ]),
  createSnapshot: vi.fn().mockResolvedValue({
    snapshotId: "kb-reembed-staging-20260914T060000Z-12345678",
    filePath: "C:/private/snapshot.enc.json",
    snapshotDigest: "b".repeat(64),
  }),
  applyTargetStates: vi.fn(),
  applyRollback: vi.fn(),
  readSnapshot: vi.fn(),
});
const rollbackSnapshot = () => {
  const original = legacyEntry();
  const target = targetEntry(original);
  const plan = buildStagingKnowledgeBaseReembedPlan([original]);
  return {
    schemaVersion: 1,
    snapshotId: "kb-reembed-staging-20260914T060000Z-12345678",
    targetDatabase: "htcoaching_staging",
    planDigest: plan.planDigest,
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
  };
};

describe("staging Knowledge Base re-embed runner", () => {
  it("rejects a stale off-device backup before opening a connection", async () => {
    const runtime = dependencies();
    runtime.assertBackupReady.mockImplementation(() =>
      assertStagingKnowledgeBackupReady({
        now: NOW,
        backupManifest: {
          schemaVersion: 1,
          policy: { releaseMaxAgeHours: 24, requireOffDeviceRecovery: true },
          latestVerifiedBackup: {
            backupId: "production-logical-backup-20260911T054030Z",
            completedAt: "2026-09-11T05:41:39.116Z",
            backupType: "logical_mongodump",
            archiveIntegrityVerified: true,
            isolatedRestoreVerified: true,
            sourceFingerprintMatched: true,
            continuousRecoveryAvailable: false,
            offDeviceRecoveryVerified: true,
            evidence: "docs/operations/production/production-backup-record-2026-09-11.md",
          },
        },
      }),
    );
    const plan = buildStagingKnowledgeBaseReembedPlan([legacyEntry()]);
    await expect(runStagingKnowledgeBaseReembed({
      argv: ["--target=staging", "--apply", `--plan-digest=${plan.planDigest}`],
      env: validEnv(), dependencies: runtime, now: NOW,
    })).rejects.toThrowError(/KB_REEMBED_FRESH_OFF_DEVICE_BACKUP_REQUIRED/);
    expect(runtime.connect).not.toHaveBeenCalled();
  });
  it("keeps the default preflight read-only", async () => {
    const runtime = dependencies();
    const result = await runStagingKnowledgeBaseReembed({
      argv: ["--target=staging"], env: validEnv(), dependencies: runtime, now: NOW,
    });
    expect(result).toMatchObject({ mode: "preflight", success: true });
    expect(runtime.generateTargetStates).not.toHaveBeenCalled();
    expect(runtime.createSnapshot).not.toHaveBeenCalled();
    expect(runtime.applyTargetStates).not.toHaveBeenCalled();
    expect(runtime.disconnect).toHaveBeenCalledOnce();
  });

  it("keeps the connection open until the preflight read completes", async () => {
    let completeRead;
    const readGate = new Promise((resolve) => {
      completeRead = resolve;
    });
    const order = [];
    const runtime = dependencies();
    runtime.loadEntries.mockImplementation(async () => {
      order.push("read:start");
      await readGate;
      order.push("read:end");
      return [legacyEntry()];
    });
    runtime.disconnect.mockImplementation(() => {
      order.push("disconnect");
    });

    const resultPromise = runStagingKnowledgeBaseReembed({
      argv: ["--target=staging"], env: validEnv(), dependencies: runtime, now: NOW,
    });
    await vi.waitFor(() => expect(runtime.loadEntries).toHaveBeenCalledOnce());
    const orderBeforeReadCompleted = [...order];
    completeRead();
    await resultPromise;

    expect(orderBeforeReadCompleted).toEqual(["read:start"]);
    expect(order).toEqual(["read:start", "read:end", "disconnect"]);
  });

  it("rejects a drifted reviewed digest before provider calls or writes", async () => {
    const runtime = dependencies();
    await expect(runStagingKnowledgeBaseReembed({
      argv: ["--target=staging", "--apply", `--plan-digest=${"f".repeat(64)}`],
      env: validEnv(), dependencies: runtime, now: NOW,
    })).rejects.toThrowError(/KB_REEMBED_PLAN_DIGEST_MISMATCH/);
    expect(runtime.generateTargetStates).not.toHaveBeenCalled();
    expect(runtime.createSnapshot).not.toHaveBeenCalled();
    expect(runtime.applyTargetStates).not.toHaveBeenCalled();
  });

  it("enforces the reviewed provider-call budget before generation", async () => {
    const runtime = dependencies();
    const plan = buildStagingKnowledgeBaseReembedPlan([legacyEntry()]);
    await expect(runStagingKnowledgeBaseReembed({
      argv: ["--target=staging", "--apply", `--plan-digest=${plan.planDigest}`],
      env: { ...validEnv(), KB_REEMBED_MAX_PROVIDER_CALLS: "1" },
      dependencies: runtime, now: NOW,
    })).rejects.toThrowError(/KB_REEMBED_PROVIDER_CALL_LIMIT_EXCEEDED/);
    expect(runtime.generateTargetStates).not.toHaveBeenCalled();
    expect(runtime.createSnapshot).not.toHaveBeenCalled();
  });

  it("verifies the encrypted snapshot before applying generated vectors", async () => {
    const runtime = dependencies();
    const plan = buildStagingKnowledgeBaseReembedPlan([legacyEntry()]);
    runtime.loadEntries
      .mockResolvedValueOnce([legacyEntry()])
      .mockResolvedValueOnce([targetEntry()]);
    const result = await runStagingKnowledgeBaseReembed({
      argv: ["--target=staging", "--apply", `--plan-digest=${plan.planDigest}`],
      env: validEnv(), dependencies: runtime, now: NOW,
    });
    expect(runtime.generateTargetStates).toHaveBeenCalledBefore(runtime.createSnapshot);
    expect(runtime.createSnapshot).toHaveBeenCalledBefore(runtime.applyTargetStates);
    expect(result).toMatchObject({
      mode: "apply", success: true,
      verification: { valid: true, documentsVerified: 1 },
      snapshot: {
        snapshotId: "kb-reembed-staging-20260914T060000Z-12345678",
        snapshotDigest: "b".repeat(64),
      },
    });
    expect(result.snapshot).not.toHaveProperty("filePath");
  });

  it("performs no snapshot or database write when vector generation fails", async () => {
    const runtime = dependencies();
    const plan = buildStagingKnowledgeBaseReembedPlan([legacyEntry()]);
    runtime.generateTargetStates.mockRejectedValue(new Error("synthetic provider failure"));
    await expect(runStagingKnowledgeBaseReembed({
      argv: ["--target=staging", "--apply", `--plan-digest=${plan.planDigest}`],
      env: validEnv(), dependencies: runtime, now: NOW,
    })).rejects.toThrowError(/synthetic provider failure/);
    expect(runtime.createSnapshot).not.toHaveBeenCalled();
    expect(runtime.applyTargetStates).not.toHaveBeenCalled();
  });

  it("retains a safe snapshot ID if the transaction or post-check fails", async () => {
    const runtime = dependencies();
    const plan = buildStagingKnowledgeBaseReembedPlan([legacyEntry()]);
    runtime.applyTargetStates.mockRejectedValue(new Error("synthetic transaction fail"));
    await expect(runStagingKnowledgeBaseReembed({
      argv: ["--target=staging", "--apply", `--plan-digest=${plan.planDigest}`],
      env: validEnv(), dependencies: runtime, now: NOW,
    })).rejects.toMatchObject({
      message: "synthetic transaction fail",
      snapshotId: "kb-reembed-staging-20260914T060000Z-12345678",
    });
  });

  it("keeps rollback preflight read-only and returns the snapshot digest", async () => {
    const snapshot = rollbackSnapshot();
    const runtime = dependencies([targetEntry()]);
    runtime.readSnapshot.mockResolvedValue(snapshot);
    const result = await runStagingKnowledgeBaseReembed({
      argv: ["--target=staging", "--rollback", "--snapshot=C:/private/snapshot.enc.json"],
      env: validEnv(), dependencies: runtime, now: NOW,
    });
    expect(result).toMatchObject({
      mode: "preflight",
      operation: "rollback",
      planDigest: snapshot.planDigest,
      verification: { valid: true, documentsVerified: 1 },
    });
    expect(runtime.applyRollback).not.toHaveBeenCalled();
  });

  it("applies rollback only with the reviewed original digest", async () => {
    const snapshot = rollbackSnapshot();
    const runtime = dependencies([targetEntry()]);
    runtime.readSnapshot.mockResolvedValue(snapshot);
    runtime.loadEntries
      .mockResolvedValueOnce([targetEntry()])
      .mockResolvedValueOnce([legacyEntry()]);
    const result = await runStagingKnowledgeBaseReembed({
      argv: [
        "--target=staging", "--rollback", "--apply",
        "--snapshot=C:/private/snapshot.enc.json",
        `--plan-digest=${snapshot.planDigest}`,
      ],
      env: validEnv(), dependencies: runtime, now: NOW,
    });
    expect(runtime.applyRollback).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      mode: "apply",
      operation: "rollback",
      success: true,
      verification: { valid: true, documentsVerified: 1 },
    });
  });
});
