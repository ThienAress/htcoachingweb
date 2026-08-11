import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateBackupReadiness,
  exitCodeForMode,
  validateBackupManifest,
} from "./lib/backup-readiness.mjs";

const manifest = (overrides = {}) => ({
  schemaVersion: 1,
  policy: {
    releaseMaxAgeHours: 24,
    requireOffDeviceRecovery: true,
  },
  latestVerifiedBackup: {
    backupId: "production-logical-backup-20260811T010000Z",
    completedAt: "2026-08-11T01:00:00.000Z",
    backupType: "logical_mongodump",
    archiveIntegrityVerified: true,
    isolatedRestoreVerified: true,
    sourceFingerprintMatched: true,
    continuousRecoveryAvailable: false,
    offDeviceRecoveryVerified: true,
    evidence: "docs/operations/production/backup-record.md",
    ...overrides,
  },
});

test("fresh verified backup passes release and disaster-recovery gates", () => {
  const result = evaluateBackupReadiness(manifest(), {
    now: new Date("2026-08-11T12:00:00.000Z"),
  });

  assert.equal(result.releaseReady, true);
  assert.equal(result.disasterRecoveryReady, true);
  assert.equal(result.ageHours, 11);
  assert.deepEqual(result.blockers, []);
  assert.deepEqual(result.warnings.map(({ code }) => code), [
    "CONTINUOUS_RECOVERY_UNAVAILABLE",
  ]);
});

test("stale backup fails closed without exposing private backup metadata", () => {
  const result = evaluateBackupReadiness(
    manifest({
      backupId: "production-logical-backup-20260724T051142Z",
      completedAt: "2026-07-24T05:11:42.000Z",
      offDeviceRecoveryVerified: false,
    }),
    { now: new Date("2026-08-11T12:00:00.000Z") },
  );

  assert.equal(result.releaseReady, false);
  assert.equal(result.disasterRecoveryReady, false);
  assert.deepEqual(result.blockers.map(({ code }) => code), [
    "BACKUP_STALE",
    "OFF_DEVICE_RECOVERY_UNVERIFIED",
  ]);
  assert.equal("manifest" in result, false);
});

test("failed integrity or isolated restore blocks release readiness", () => {
  const result = evaluateBackupReadiness(
    manifest({
      archiveIntegrityVerified: false,
      isolatedRestoreVerified: false,
      sourceFingerprintMatched: false,
    }),
    { now: new Date("2026-08-11T12:00:00.000Z") },
  );

  assert.deepEqual(result.blockers.map(({ code }) => code), [
    "ARCHIVE_INTEGRITY_UNVERIFIED",
    "ISOLATED_RESTORE_UNVERIFIED",
    "SOURCE_FINGERPRINT_MISMATCH",
  ]);
  assert.equal(result.releaseReady, false);
});

test("manifest validation rejects future timestamps and secret-adjacent fields", () => {
  assert.throws(
    () =>
      validateBackupManifest(
        manifest({ completedAt: "2026-08-12T01:00:00.000Z" }),
        { now: new Date("2026-08-11T12:00:00.000Z") },
      ),
    /future/,
  );

  assert.throws(
    () =>
      validateBackupManifest({
        ...manifest(),
        localArchivePath: "C:/private/archive.gz",
      }),
    /unsupported field/,
  );
});

test("CLI modes keep audit observable and readiness gates fail closed", () => {
  const blocked = { releaseReady: false, disasterRecoveryReady: false };
  assert.equal(exitCodeForMode("audit", blocked), 0);
  assert.equal(exitCodeForMode("release", blocked), 1);
  assert.equal(exitCodeForMode("disaster-recovery", blocked), 1);
  assert.throws(() => exitCodeForMode("unknown", blocked), /Unsupported mode/);
});
