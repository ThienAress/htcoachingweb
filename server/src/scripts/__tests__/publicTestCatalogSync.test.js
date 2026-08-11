import { describe, expect, it } from "vitest";

import {
  EXERCISE_MANIFEST,
  EXPECTED_MUSCLE_GROUPS,
  FOOD_MANIFEST,
  classifyFixtureRecord,
  validateLocalTarget,
  validateManifestContract,
  validateSyncTarget,
} from "../publicTestCatalogSync.js";

const validStagingEnvironment = () => ({
  APP_ENV: "staging",
  MONGO_URI:
    "mongodb+srv://cluster.example/htcoaching_staging?retryWrites=true",
  CLIENT_URL: "https://staging--htcoachingweb.netlify.app",
  PUBLIC_API_ORIGIN: "https://htcoachingweb-staging.onrender.com",
  ALLOWED_ORIGINS: "https://staging--htcoachingweb.netlify.app",
  BACKGROUND_JOBS_ENABLED: "false",
  EMAIL_DELIVERY_MODE: "disabled",
  F1_RETENTION_ENFORCE: "false",
  CONFIRM_STAGING_TEST_CATALOG_SYNC: "yes",
});

describe("public test catalog manifest", () => {
  it("selects exactly 20 exercises and covers every production muscle group", () => {
    expect(EXERCISE_MANIFEST).toHaveLength(20);
    expect(new Set(EXERCISE_MANIFEST.map(({ name }) => name)).size).toBe(20);
    expect(
      [...new Set(EXERCISE_MANIFEST.map(({ muscleGroup }) => muscleGroup))].sort(),
    ).toEqual([...EXPECTED_MUSCLE_GROUPS].sort());
    expect(() => validateManifestContract()).not.toThrow();
  });

  it("selects exactly 20 foods with the approved 7/7/6 macro split", () => {
    expect(FOOD_MANIFEST).toHaveLength(20);
    expect(new Set(FOOD_MANIFEST.map(({ label }) => label)).size).toBe(20);
    expect(
      Object.fromEntries(
        ["protein", "carb", "fat"].map((group) => [
          group,
          FOOD_MANIFEST.filter(({ macroGroup }) => macroGroup === group).length,
        ]),
      ),
    ).toEqual({ protein: 7, carb: 7, fat: 6 });
  });
});

describe("public test catalog target guards", () => {
  it("accepts only localhost with the exact local database", () => {
    expect(
      validateLocalTarget(
        "mongodb://127.0.0.1:27017/htcoaching_local?replicaSet=rs0",
      ),
    ).toEqual({ valid: true, errors: [] });
    expect(
      validateLocalTarget("mongodb://cluster.example/htcoaching_local").errors,
    ).toContain("LOCAL_TEST_CATALOG_HOST_REQUIRED");
    expect(
      validateLocalTarget("mongodb://127.0.0.1:27017/htcoaching").errors,
    ).toContain("LOCAL_TEST_CATALOG_DATABASE_REQUIRED");
  });

  it("reuses staging safety and requires the dedicated confirmation", () => {
    expect(
      validateSyncTarget({ target: "staging", env: validStagingEnvironment() }),
    ).toEqual({ valid: true, errors: [] });

    const env = validStagingEnvironment();
    delete env.CONFIRM_STAGING_TEST_CATALOG_SYNC;
    expect(validateSyncTarget({ target: "staging", env }).errors).toContain(
      "STAGING_OPERATION_CONFIRMATION_REQUIRED",
    );
  });
});

describe("public test catalog upsert policy", () => {
  it("inserts missing, updates only its own managed fixture and skips unmanaged data", () => {
    expect(classifyFixtureRecord(null)).toBe("insert");
    expect(
      classifyFixtureRecord({
        _testCatalogFixture: {
          managed: true,
          key: "plan-043-public-test-catalog",
        },
      }),
    ).toBe("update");
    expect(classifyFixtureRecord({ name: "Existing production-like row" })).toBe(
      "skip",
    );
    expect(
      classifyFixtureRecord({
        _testCatalogFixture: { managed: true, key: "another-fixture" },
      }),
    ).toBe("skip");
  });
});
