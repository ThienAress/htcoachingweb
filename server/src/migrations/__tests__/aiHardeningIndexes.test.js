import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { setupTestDB, teardownTestDB } from "../../__tests__/setup.js";
import AiToolConfirmation from "../../models/AiToolConfirmation.js";
import ServiceUsageBucket from "../../models/ServiceUsageBucket.js";
import {
  applyAiHardeningIndexes,
  assertCurrentReleaseBackup,
  getAiHardeningIndexContracts,
  inspectAiHardeningIndexes,
} from "../20260813-ai-hardening-indexes.js";

describe("AI hardening production index migration", () => {
  beforeAll(async () => {
    await setupTestDB();
    await Promise.all(
      [ServiceUsageBucket, AiToolConfirmation].map((model) =>
        model.createCollection().catch((error) => {
          if (error?.codeName !== "NamespaceExists") throw error;
        }),
      ),
    );
  });
  afterAll(teardownTestDB);

  it("derives every secondary index from the new model schemas", () => {
    expect(
      getAiHardeningIndexContracts().map(({ name }) => name).sort(),
    ).toEqual(
      [
        "service_usage_expiry_ttl",
        "service_usage_user_service",
        "service_usage_guest_service",
        "ai_tool_confirmation_owner_state",
        "ai_tool_confirmation_expiry_ttl",
      ].sort(),
    );
  });

  it("accounts for every index during read-only inspection", async () => {
    const reports = await inspectAiHardeningIndexes();

    expect(reports).toHaveLength(5);
    expect(
      reports.every(({ status }) =>
        ["present", "missing", "name_conflict"].includes(status),
      ),
    ).toBe(true);
  });

  it("creates missing contracts and keeps present contracts unchanged", async () => {
    const calls = [];
    const missing = getAiHardeningIndexContracts().map((contract) => ({
      contract: {
        ...contract,
        model: {
          collection: {
            createIndex: vi.fn(async (keys, options) => {
              calls.push({ keys, options });
              return options.name;
            }),
          },
        },
      },
      status: "missing",
    }));
    const created = await applyAiHardeningIndexes(missing);
    const rerun = await applyAiHardeningIndexes(
      missing.map((report) => ({ ...report, status: "present" })),
    );

    expect({
      created: created.filter(({ status }) => status === "created").length,
      calls: calls.length,
      unchanged: rerun.filter(({ status }) => status === "unchanged").length,
    }).toEqual({ created: 5, calls: 5, unchanged: 5 });
  });

  it("refuses to apply a conflicting named index", async () => {
    const [contract] = getAiHardeningIndexContracts();
    await expect(
      applyAiHardeningIndexes([{ contract, status: "name_conflict" }]),
    ).rejects.toThrow("blocked by preflight findings");
  });

  it("requires the production backup ID to match current release evidence", () => {
    const manifest = {
      schemaVersion: 1,
      policy: { releaseMaxAgeHours: 24, requireOffDeviceRecovery: true },
      latestVerifiedBackup: {
        backupId: "production-logical-backup-20260812T105458Z",
        completedAt: new Date(Date.now() - 60_000).toISOString(),
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
