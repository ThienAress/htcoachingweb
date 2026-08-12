import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { setupTestDB, teardownTestDB } from "../../__tests__/setup.js";
import AiMemory from "../../models/AiMemory.js";
import AiMemoryPreference from "../../models/AiMemoryPreference.js";
import {
  applyAiMemoryIndexes,
  assertCurrentReleaseBackup,
  getAiMemoryIndexContracts,
  inspectAiMemoryIndexes,
} from "../20260812-ai-memory-indexes.js";

describe("AI Memory production index migration", () => {
  beforeAll(async () => {
    await setupTestDB();
    await Promise.all(
      [AiMemory, AiMemoryPreference].map((model) =>
        model.createCollection().catch((error) => {
          if (error?.codeName !== "NamespaceExists") throw error;
        }),
      ),
    );
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  test("derives all required contracts from the model schemas", () => {
    expect(getAiMemoryIndexContracts().map(({ name }) => name)).toEqual([
      "uniq_active_ai_memory_kind",
      "ai_memory_owner_status_updated",
      "ai_memory_expiry_ttl",
      "uniq_ai_memory_preference_user",
    ]);
  });

  test("creates missing indexes and is idempotent on the next inspection", async () => {
    await Promise.all(
      [AiMemory, AiMemoryPreference].map((model) =>
        model.collection.dropIndexes(),
      ),
    );

    const firstInspection = await inspectAiMemoryIndexes();
    const created = await applyAiMemoryIndexes(firstInspection);
    const secondInspection = await inspectAiMemoryIndexes();
    const rerun = await applyAiMemoryIndexes(secondInspection);

    expect({
      accountedFor:
        firstInspection.filter(({ status }) => status === "present").length +
        created.filter(({ status }) => status === "created").length,
      present: secondInspection.filter(({ status }) => status === "present")
        .length,
      unchanged: rerun.filter(({ status }) => status === "unchanged").length,
    }).toEqual({ accountedFor: 4, present: 4, unchanged: 4 });
  });

  test("reports duplicate active values before creating the unique index", async () => {
    await AiMemory.collection.dropIndexes();
    const userId = new mongoose.Types.ObjectId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60_000);
    await AiMemory.collection.insertMany([
      {
        userId,
        kind: "response_style",
        value: "concise",
        status: "active",
        version: 1,
        source: "explicit_user",
        consentVersion: "2026-08",
        lastConfirmedAt: now,
        expiresAt,
      },
      {
        userId,
        kind: "response_style",
        value: "balanced",
        status: "active",
        version: 2,
        source: "explicit_user",
        consentVersion: "2026-08",
        lastConfirmedAt: now,
        expiresAt,
      },
    ]);

    const reports = await inspectAiMemoryIndexes();
    const target = reports.find(
      ({ contract }) => contract.name === "uniq_active_ai_memory_kind",
    );

    expect(target.duplicateGroupCount).toBe(1);
  });

  test("refuses to apply when preflight reports a name conflict", async () => {
    const [contract] = getAiMemoryIndexContracts();

    await expect(
      applyAiMemoryIndexes([
        { contract, duplicateGroupCount: 0, status: "name_conflict" },
      ]),
    ).rejects.toThrow("blocked by preflight findings");
  });

  test("requires the production backup ID to match fresh release evidence", () => {
    const completedAt = new Date(Date.now() - 60_000).toISOString();
    const manifest = {
      schemaVersion: 1,
      policy: { releaseMaxAgeHours: 24, requireOffDeviceRecovery: true },
      latestVerifiedBackup: {
        backupId: "production-logical-backup-20260812T105458Z",
        completedAt,
        backupType: "logical_mongodump",
        archiveIntegrityVerified: true,
        isolatedRestoreVerified: true,
        sourceFingerprintMatched: true,
        continuousRecoveryAvailable: false,
        offDeviceRecoveryVerified: false,
        evidence:
          "docs/operations/production/production-backup-record-2026-08-12.md",
      },
    };

    expect(() =>
      assertCurrentReleaseBackup({
        manifest,
        env: { MIGRATION_BACKUP_SNAPSHOT_ID: "production-stale-backup" },
      }),
    ).toThrow("does not match current evidence");
  });
});
