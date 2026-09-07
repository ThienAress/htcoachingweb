import { describe, expect, it } from "vitest";
import {
  assertConnectedMigrationTarget,
  assertMigrationEnvironment,
  validateMigrationEnvironment,
} from "../migrationSafety.js";

const stagingEnvironment = () => ({
  APP_ENV: "staging",
  MONGO_URI: "mongodb+srv://example.mongodb.net/htcoaching_staging",
  MIGRATION_TARGET_DATABASE: "htcoaching_staging",
  CONFIRM_PHASE1_INTEGRITY_MIGRATION: "yes",
});

const backupManifest = (overrides = {}) => ({
  schemaVersion: 1,
  policy: { releaseMaxAgeHours: 24, requireOffDeviceRecovery: true },
  latestVerifiedBackup: {
    backupId: "production-logical-backup-20260906T010000Z",
    completedAt: "2026-09-06T01:00:00.000Z",
    backupType: "logical_mongodump",
    archiveIntegrityVerified: true,
    isolatedRestoreVerified: true,
    sourceFingerprintMatched: true,
    continuousRecoveryAvailable: false,
    offDeviceRecoveryVerified: false,
    evidence: "docs/operations/production/backup-record.md",
    ...overrides,
  },
});

const productionOptions = (env, overrides = {}) => ({
  env,
  confirmationVariable: "CONFIRM_PHASE1_INTEGRITY_MIGRATION",
  backupManifest: backupManifest(),
  now: new Date("2026-09-06T02:00:00.000Z"),
  ...overrides,
});

describe("migration safety", () => {
  it("accepts an explicitly confirmed staging target", () => {
    const result = validateMigrationEnvironment({
      env: stagingEnvironment(),
      confirmationVariable: "CONFIRM_PHASE1_INTEGRITY_MIGRATION",
    });

    expect(result).toMatchObject({
      valid: true,
      appEnvironment: "staging",
      targetDatabase: "htcoaching_staging",
    });
  });

  it("rejects a missing environment, phase confirmation, and exact target", () => {
    const env = stagingEnvironment();
    delete env.APP_ENV;
    delete env.MIGRATION_TARGET_DATABASE;
    delete env.CONFIRM_PHASE1_INTEGRITY_MIGRATION;

    const result = validateMigrationEnvironment(productionOptions(env));

    expect(result.errors).toEqual(
      expect.arrayContaining([
        "MIGRATION_APP_ENV_REQUIRED",
        "MIGRATION_TARGET_DATABASE_REQUIRED",
        "MIGRATION_PHASE_CONFIRMATION_REQUIRED",
      ]),
    );
  });

  it("rejects a staging URI that does not use the staging database", () => {
    const env = stagingEnvironment();
    env.MONGO_URI = "mongodb+srv://example.mongodb.net/htcoaching";

    const result = validateMigrationEnvironment({
      env,
      confirmationVariable: "CONFIRM_PHASE1_INTEGRITY_MIGRATION",
    });

    expect(result.errors).toEqual(
      expect.arrayContaining([
        "MIGRATION_TARGET_DATABASE_MISMATCH",
        "MIGRATION_STAGING_DATABASE_REQUIRED",
      ]),
    );
  });

  it("requires production confirmation, snapshot, and approval evidence", () => {
    const env = {
      ...stagingEnvironment(),
      APP_ENV: "production",
      MONGO_URI: "mongodb+srv://example.mongodb.net/htcoaching",
      MIGRATION_TARGET_DATABASE: "htcoaching",
    };

    const result = validateMigrationEnvironment(productionOptions(env));

    expect(result.errors).toEqual(
      expect.arrayContaining([
        "MIGRATION_PRODUCTION_CONFIRMATION_REQUIRED",
        "MIGRATION_BACKUP_SNAPSHOT_REQUIRED",
        "MIGRATION_APPROVAL_REQUIRED",
      ]),
    );
  });

  it("rejects placeholder or too-short production evidence", () => {
    const env = {
      ...stagingEnvironment(),
      APP_ENV: "production",
      MONGO_URI: "mongodb+srv://example.mongodb.net/htcoaching",
      MIGRATION_TARGET_DATABASE: "htcoaching",
      CONFIRM_PRODUCTION_MIGRATION: "production",
      MIGRATION_BACKUP_SNAPSHOT_ID: "pending",
      MIGRATION_APPROVAL_ID: "ok",
    };

    const result = validateMigrationEnvironment(productionOptions(env));

    expect(result.errors).toEqual(
      expect.arrayContaining([
        "MIGRATION_BACKUP_SNAPSHOT_REQUIRED",
        "MIGRATION_APPROVAL_REQUIRED",
      ]),
    );
  });

  it("accepts production only with exact target and recorded release evidence", () => {
    const env = {
      ...stagingEnvironment(),
      APP_ENV: "production",
      MONGO_URI: "mongodb+srv://example.mongodb.net/htcoaching",
      MIGRATION_TARGET_DATABASE: "htcoaching",
      CONFIRM_PRODUCTION_MIGRATION: "production",
      MIGRATION_BACKUP_SNAPSHOT_ID:
        "production-logical-backup-20260906T010000Z",
      MIGRATION_APPROVAL_ID: "release-2026-07-23-owner-approved",
    };

    expect(
      validateMigrationEnvironment(productionOptions(env)).valid,
    ).toBe(true);
  });

  it("rejects stale evidence and a backup ID that differs from the manifest", () => {
    const env = {
      ...stagingEnvironment(),
      APP_ENV: "production",
      MONGO_URI: "mongodb+srv://example.mongodb.net/htcoaching",
      MIGRATION_TARGET_DATABASE: "htcoaching",
      CONFIRM_PRODUCTION_MIGRATION: "production",
      MIGRATION_BACKUP_SNAPSHOT_ID: "production-logical-backup-different",
      MIGRATION_APPROVAL_ID: "release-2026-09-06-owner-approved",
    };
    const result = validateMigrationEnvironment(
      productionOptions(env, {
        backupManifest: backupManifest({
          completedAt: "2026-09-01T01:00:00.000Z",
        }),
      }),
    );

    expect(result.errors).toEqual(
      expect.arrayContaining([
        "MIGRATION_BACKUP_NOT_RELEASE_READY",
        "MIGRATION_BACKUP_SNAPSHOT_MISMATCH",
      ]),
    );
  });

  it("rejects malformed backup evidence instead of trusting the environment", () => {
    const env = {
      ...stagingEnvironment(),
      APP_ENV: "production",
      MONGO_URI: "mongodb+srv://example.mongodb.net/htcoaching",
      MIGRATION_TARGET_DATABASE: "htcoaching",
      CONFIRM_PRODUCTION_MIGRATION: "production",
      MIGRATION_BACKUP_SNAPSHOT_ID:
        "production-logical-backup-20260906T010000Z",
      MIGRATION_APPROVAL_ID: "release-2026-09-06-owner-approved",
    };

    expect(
      validateMigrationEnvironment(
        productionOptions(env, { backupManifest: { schemaVersion: 999 } }),
      ).errors,
    ).toContain("MIGRATION_BACKUP_MANIFEST_INVALID");
  });

  it("blocks execution when the connected database differs from the lock", () => {
    const authorization = assertMigrationEnvironment({
      env: stagingEnvironment(),
      confirmationVariable: "CONFIRM_PHASE1_INTEGRITY_MIGRATION",
    });

    expect(() =>
      assertConnectedMigrationTarget(
        { db: { databaseName: "htcoaching" } },
        authorization,
      ),
    ).toThrowError(/MIGRATION_CONNECTED_DATABASE_MISMATCH/);
  });
});
