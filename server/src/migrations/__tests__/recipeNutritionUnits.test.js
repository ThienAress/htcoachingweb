import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  clearCollections,
  setupTestDB,
  teardownTestDB,
} from "../../__tests__/setup.js";
import Recipe from "../../models/Recipe.js";
import {
  applyRecipeNutritionUnitMigration,
  assertCurrentReleaseBackup,
  authorizeRecipeNutritionUnitTarget,
  inspectRecipeNutritionUnits,
} from "../20260902-normalize-recipe-nutrition-units.js";

const legacyRecipe = (overrides = {}) => ({
  name: "Món dinh dưỡng cũ",
  slug: "mon-dinh-duong-cu",
  nutrition: {
    calories: 520,
    protein: 42,
    fat: 18,
    carb: 48,
    sugars: 7,
    salt: 1.4,
    additional: [
      { label: "Kali", unit: "mg", value: 920 },
      { label: "Vitamin B12", unit: "mcg", value: 1.2 },
      { label: "Chất xơ", unit: "g", value: 8.5 },
    ],
  },
  ...overrides,
});

const releaseBackupManifest = (overrides = {}) => ({
  schemaVersion: 1,
  policy: { releaseMaxAgeHours: 24, requireOffDeviceRecovery: true },
  latestVerifiedBackup: {
    backupId: "production-logical-backup-20260902T033930Z",
    completedAt: new Date(Date.now() - 60_000).toISOString(),
    backupType: "logical_mongodump",
    archiveIntegrityVerified: true,
    isolatedRestoreVerified: true,
    sourceFingerprintMatched: true,
    continuousRecoveryAvailable: false,
    offDeviceRecoveryVerified: true,
    evidence:
      "docs/operations/production/production-backup-record-2026-09-02.md",
    ...overrides,
  },
});

describe("recipe nutrition unit migration", () => {
  beforeAll(setupTestDB);
  afterEach(clearCollections);
  afterAll(teardownTestDB);

  it("requires an explicit environment-matched target and apply confirmations", async () => {
    const env = {
      APP_ENV: "staging",
      MONGO_URI: "mongodb://127.0.0.1:27017/htcoaching_staging",
      MIGRATION_TARGET_DATABASE: "htcoaching_staging",
    };

    await expect(
      authorizeRecipeNutritionUnitTarget({
        args: new Set(["--target=staging"]),
        apply: false,
        env,
      }),
    ).resolves.toEqual({
      valid: true,
      targetDatabase: "htcoaching_staging",
    });
    await expect(
      authorizeRecipeNutritionUnitTarget({
        args: new Set(["--target=production"]),
        apply: false,
        env,
      }),
    ).rejects.toThrow(/target does not match APP_ENV/i);
    await expect(
      authorizeRecipeNutritionUnitTarget({
        args: new Set(["--target=staging"]),
        apply: true,
        env,
      }),
    ).rejects.toThrow(/--confirm-recipe-nutrition-units/i);
    await expect(
      authorizeRecipeNutritionUnitTarget({
        args: new Set([
          "--target=staging",
          "--confirm-recipe-nutrition-units",
        ]),
        apply: true,
        env,
      }),
    ).rejects.toThrow(/MIGRATION_PHASE_CONFIRMATION_REQUIRED/i);
    await expect(
      authorizeRecipeNutritionUnitTarget({
        args: new Set([
          "--target=staging",
          "--confirm-recipe-nutrition-units",
        ]),
        apply: true,
        env: {
          ...env,
          CONFIRM_RECIPE_NUTRITION_UNIT_MIGRATION: "yes",
        },
      }),
    ).resolves.toMatchObject({
      valid: true,
      appEnvironment: "staging",
      targetDatabase: "htcoaching_staging",
    });
  });

  it("does not require or read production backup evidence for a staging apply", async () => {
    const loadBackupManifest = vi.fn(() => {
      throw new Error("staging must not read production backup evidence");
    });

    await expect(
      authorizeRecipeNutritionUnitTarget({
        args: new Set([
          "--target=staging",
          "--confirm-recipe-nutrition-units",
        ]),
        apply: true,
        env: {
          APP_ENV: "staging",
          MONGO_URI: "mongodb://127.0.0.1:27017/htcoaching_staging",
          MIGRATION_TARGET_DATABASE: "htcoaching_staging",
          CONFIRM_RECIPE_NUTRITION_UNIT_MIGRATION: "yes",
        },
        loadBackupManifest,
      }),
    ).resolves.toMatchObject({ valid: true, appEnvironment: "staging" });
    expect(loadBackupManifest).not.toHaveBeenCalled();
  });

  it("accepts fresh release-ready evidence with the exact production backup ID", () => {
    expect(
      assertCurrentReleaseBackup({
        manifest: releaseBackupManifest(),
        env: {
          MIGRATION_BACKUP_SNAPSHOT_ID:
            "production-logical-backup-20260902T033930Z",
        },
      }),
    ).toMatchObject({
      releaseReady: true,
      backupId: "production-logical-backup-20260902T033930Z",
    });
  });

  it("loads current backup evidence before authorizing a production apply", async () => {
    const loadBackupManifest = vi.fn().mockResolvedValue(
      releaseBackupManifest(),
    );

    await expect(
      authorizeRecipeNutritionUnitTarget({
        args: new Set([
          "--target=production",
          "--confirm-recipe-nutrition-units",
        ]),
        apply: true,
        env: {
          APP_ENV: "production",
          MONGO_URI: "mongodb://127.0.0.1:27017/htcoaching_production",
          MIGRATION_TARGET_DATABASE: "htcoaching_production",
          CONFIRM_RECIPE_NUTRITION_UNIT_MIGRATION: "yes",
          CONFIRM_PRODUCTION_MIGRATION: "production",
          MIGRATION_BACKUP_SNAPSHOT_ID:
            "production-logical-backup-20260902T033930Z",
          MIGRATION_APPROVAL_ID: "approval-plan-079",
        },
        loadBackupManifest,
      }),
    ).resolves.toMatchObject({ valid: true, appEnvironment: "production" });
    expect(loadBackupManifest).toHaveBeenCalledOnce();
  });

  it("rejects stale production backup evidence", () => {
    expect(() =>
      assertCurrentReleaseBackup({
        manifest: releaseBackupManifest({
          completedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
        }),
        env: {
          MIGRATION_BACKUP_SNAPSHOT_ID:
            "production-logical-backup-20260902T033930Z",
        },
      }),
    ).toThrow(/release-ready backup/i);
  });

  it("rejects fresh production evidence that is not release-ready", () => {
    expect(() =>
      assertCurrentReleaseBackup({
        manifest: releaseBackupManifest({ isolatedRestoreVerified: false }),
        env: {
          MIGRATION_BACKUP_SNAPSHOT_ID:
            "production-logical-backup-20260902T033930Z",
        },
      }),
    ).toThrow(/release-ready backup/i);
  });

  it("rejects a production backup ID that does not match current evidence", () => {
    expect(() =>
      assertCurrentReleaseBackup({
        manifest: releaseBackupManifest(),
        env: { MIGRATION_BACKUP_SNAPSHOT_ID: "production-stale-backup" },
      }),
    ).toThrow(/does not match current evidence/i);
  });

  it("converts only milligrams and a second apply is a no-op", async () => {
    await Recipe.create(legacyRecipe());
    const report = await inspectRecipeNutritionUnits();
    const afterPreflight = await Recipe.findOne({
      slug: "mon-dinh-duong-cu",
    }).lean();

    const first = await applyRecipeNutritionUnitMigration({ report });
    const secondReport = await inspectRecipeNutritionUnits();
    const second = await applyRecipeNutritionUnitMigration({
      report: secondReport,
    });
    const stored = await Recipe.findOne({ slug: "mon-dinh-duong-cu" }).lean();

    expect(report).toMatchObject({
      ready: true,
      targetDocumentCount: 1,
      targetItemCount: 1,
      invalidItemCount: 0,
    });
    expect(afterPreflight.nutrition.additional[0]).toEqual({
      label: "Kali",
      unit: "mg",
      value: 920,
    });
    expect(first).toMatchObject({ matchedDocuments: 1, modifiedDocuments: 1 });
    expect(second).toMatchObject({ matchedDocuments: 0, modifiedDocuments: 0 });
    expect(stored.nutrition.additional).toEqual([
      { label: "Kali", unit: "g", value: 0.92 },
      { label: "Vitamin B12", unit: "mcg", value: 1.2 },
      { label: "Chất xơ", unit: "g", value: 8.5 },
    ]);
    expect(stored.nutrition).toMatchObject({
      calories: 520,
      protein: 42,
      fat: 18,
      carb: 48,
      sugars: 7,
      salt: 1.4,
    });
  });

  it("blocks apply when a legacy milligram value is not a finite non-negative number", async () => {
    await Recipe.collection.insertOne(
      legacyRecipe({
        slug: "mon-dinh-duong-loi",
        nutrition: {
          ...legacyRecipe().nutrition,
          additional: [{ label: "Kali", unit: "mg", value: "invalid" }],
        },
      }),
    );
    const report = await inspectRecipeNutritionUnits();

    expect(report).toMatchObject({ ready: false, invalidItemCount: 1 });
    await expect(
      applyRecipeNutritionUnitMigration({ report }),
    ).rejects.toMatchObject({ code: "RECIPE_NUTRITION_UNIT_PREFLIGHT_BLOCKED" });
  });
});
