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

    const result = validateMigrationEnvironment({
      env,
      confirmationVariable: "CONFIRM_PHASE1_INTEGRITY_MIGRATION",
    });

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

    const result = validateMigrationEnvironment({
      env,
      confirmationVariable: "CONFIRM_PHASE1_INTEGRITY_MIGRATION",
    });

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

    const result = validateMigrationEnvironment({
      env,
      confirmationVariable: "CONFIRM_PHASE1_INTEGRITY_MIGRATION",
    });

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
      MIGRATION_BACKUP_SNAPSHOT_ID: "atlas-snapshot-20260723T1500Z",
      MIGRATION_APPROVAL_ID: "release-2026-07-23-owner-approved",
    };

    expect(
      validateMigrationEnvironment({
        env,
        confirmationVariable: "CONFIRM_PHASE1_INTEGRITY_MIGRATION",
      }).valid,
    ).toBe(true);
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
