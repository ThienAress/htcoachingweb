import { describe, expect, it } from "vitest";

import {
  STAGING_AI_CATALOG_APPLY_CONFIRMATION,
  STAGING_AI_CATALOG_EXERCISES,
  STAGING_AI_CATALOG_FOODS,
  STAGING_AI_CATALOG_PLAN_DIGEST_VARIABLE,
  createStagingAiCatalogPlanDigest,
  validateStagingAiCatalogAuthorization,
} from "../stagingAiCatalogRollout.contract.js";
import {
  createStagingAiCatalogSource,
  validateStagingAiCatalogManifest,
} from "../stagingAiCatalogRollout.sourceContract.js";

const stagingEnv = (overrides = {}) => ({
  APP_ENV: "staging",
  NODE_ENV: "production",
  MONGO_URI: "mongodb://db.test/htcoaching_staging",
  MIGRATION_TARGET_DATABASE: "htcoaching_staging",
  CLIENT_URL: "https://staging--htcoachingweb.netlify.app",
  PUBLIC_API_ORIGIN: "https://htcoachingweb-staging.onrender.com",
  ALLOWED_ORIGINS: "https://staging--htcoachingweb.netlify.app",
  BACKGROUND_JOBS_ENABLED: "false",
  EMAIL_DELIVERY_MODE: "disabled",
  F1_RETENTION_ENFORCE: "false",
  ...overrides,
});

describe("staging AI catalog rollout contract", () => {
  it("keeps preflight read-only without apply confirmation", () => {
    expect(validateStagingAiCatalogAuthorization({
      argv: ["--target=staging"],
      env: stagingEnv(),
    })).toEqual({
      target: "staging",
      targetDatabase: "htcoaching_staging",
      operation: "sync",
      apply: false,
      expectedPlanDigest: "",
    });
  });

  it("requires flag, environment confirmation and exact digest for apply", () => {
    const digest = "a".repeat(64);
    const env = stagingEnv({
      [STAGING_AI_CATALOG_APPLY_CONFIRMATION]: "yes",
      [STAGING_AI_CATALOG_PLAN_DIGEST_VARIABLE]: digest,
    });
    expect(validateStagingAiCatalogAuthorization({
      argv: [
        "--target=staging",
        "--apply",
        "--confirm-ai-catalog-rollout",
      ],
      env,
    })).toMatchObject({ apply: true, operation: "sync", expectedPlanDigest: digest });

    expect(() => validateStagingAiCatalogAuthorization({
      argv: ["--target=staging", "--apply"],
      env,
    })).toThrowError(/STAGING_AI_CATALOG_APPLY_CONFIRMATION_REQUIRED/);
  });

  it("rejects production and a non-staging database before any connection", () => {
    expect(() => validateStagingAiCatalogAuthorization({
      argv: ["--target=production"],
      env: stagingEnv({ APP_ENV: "production" }),
    })).toThrowError(/STAGING_AI_CATALOG_TARGET_REQUIRED/);
    expect(() => validateStagingAiCatalogAuthorization({
      argv: ["--target=staging"],
      env: stagingEnv({ MONGO_URI: "mongodb:\/\/db.test\/production" }),
    })).toThrowError(/STAGING_AI_CATALOG_DATABASE_GUARD_FAILED/);
  });

  it("pins five exact exercises and three sourced food/price rows", () => {
    expect(validateStagingAiCatalogManifest()).toEqual({
      exercises: 5,
      foods: 3,
      prices: 3,
    });
    expect(new Set(STAGING_AI_CATALOG_EXERCISES.map(({ id }) => id)).size).toBe(5);
  });

  it("accepts the reviewed production name for the kneeling push-up source", () => {
    const exercises = STAGING_AI_CATALOG_EXERCISES.map(({ id, name }) => ({
      _id: id,
      name,
      muscleGroup: "Cơ ngực",
      description: "Bodyweight push-up không cần dụng cụ, phù hợp cho người mới.",
      instructions: [],
    }));
    exercises[0].name = "Kneeling Push-up (male)";
    const foods = STAGING_AI_CATALOG_FOODS.map((entry, index) => ({
      _id: String(index + 1).padStart(24, "0"),
      label: entry.label,
      protein: entry.macroGroup === "protein" ? 31 : 2,
      carb: entry.macroGroup === "carb" ? 17 : 8,
      fat: entry.macroGroup === "fat" ? 15 : 1,
      calories: 100,
    }));

    expect(() => createStagingAiCatalogSource({ exercises, foods })).not.toThrow();
  });

  it("separates food identity evidence from allergen taxonomy evidence", () => {
    const exercises = STAGING_AI_CATALOG_EXERCISES.map(({ id, name }) => ({
      _id: id,
      name,
      muscleGroup: "Cơ ngực",
      description: "Bodyweight push-up không cần dụng cụ, phù hợp cho người mới.",
      instructions: [],
    }));
    const foods = STAGING_AI_CATALOG_FOODS.map((entry, index) => ({
      _id: String(index + 1).padStart(24, "0"),
      label: entry.label,
      protein: entry.macroGroup === "protein" ? 31 : 2,
      carb: entry.macroGroup === "carb" ? 17 : 8,
      fat: entry.macroGroup === "fat" ? 15 : 1,
      calories: 100,
    }));

    const source = createStagingAiCatalogSource({ exercises, foods });
    expect(STAGING_AI_CATALOG_FOODS.every((entry) =>
      new URL(entry.identitySourceUrl).hostname === "fdc.nal.usda.gov" &&
      ["www.fda.gov", "www.fsis.usda.gov"].includes(
        new URL(entry.allergenTaxonomySourceUrl).hostname,
      ),
    )).toBe(true);
    expect(source.foods.map(({ allergenProfile }) => allergenProfile)).toEqual([
      expect.objectContaining({
        sourceUrl: STAGING_AI_CATALOG_FOODS[0].identitySourceUrl,
        reviewedScopes: ["specific_foods"],
        specificContains: ["chicken"],
      }),
      expect.objectContaining({
        sourceUrl: STAGING_AI_CATALOG_FOODS[1].identitySourceUrl,
        reviewedScopes: [],
        specificContains: [],
      }),
      expect.objectContaining({
        sourceUrl: STAGING_AI_CATALOG_FOODS[2].identitySourceUrl,
        reviewedScopes: [],
        specificContains: [],
      }),
    ]);
  });

  it("keeps the reviewed digest stable when Mongo returns rows in another order", () => {
    const left = { _id: "000000000000000000000001", name: "A" };
    const right = { _id: "000000000000000000000002", name: "B" };
    const digest = (exercises) => createStagingAiCatalogPlanDigest({
      operation: "rollback",
      target: {
        exercises,
        foods: [],
        priceObservations: [],
        exerciseReviewCounts: {},
      },
    });
    expect(digest([left, right])).toBe(digest([right, left]));
  });

  it.each([
    ["legacy string instructions", { instructions: ["Giữ lưng thẳng"] }],
    ["empty instruction title", { instructions: [{ title: "", description: "Giữ lưng thẳng" }] }],
    ["too many instructions", {
      instructions: Array.from({ length: 31 }, (_, index) => ({
        title: `Bước ${index + 1}`,
        description: "Giữ lưng thẳng",
      })),
    }],
    ["invalid difficulty keys", {
      technicalDifficulty: {
        coordination: 1,
        stability: 1,
        mobility: 1,
        setup: 1,
        errorConsequence: 1,
        unexpected: 1,
      },
    }],
    ["out-of-range difficulty", {
      technicalDifficulty: {
        coordination: 3,
        stability: 1,
        mobility: 1,
        setup: 1,
        errorConsequence: 1,
      },
    }],
  ])("rejects %s before native Mongo insert", (_label, override) => {
    const exercises = STAGING_AI_CATALOG_EXERCISES.map(({ id, name }) => ({
      _id: id,
      name,
      muscleGroup: "Cơ ngực",
      description: "Bodyweight push-up không cần dụng cụ, phù hợp cho người mới.",
      instructions: [{ title: "Chuẩn bị", description: "Giữ thân người thẳng." }],
    }));
    Object.assign(exercises[0], override);
    const foods = STAGING_AI_CATALOG_FOODS.map((entry, index) => ({
      _id: String(index + 1).padStart(24, "0"),
      label: entry.label,
      protein: entry.macroGroup === "protein" ? 31 : 2,
      carb: entry.macroGroup === "carb" ? 17 : 8,
      fat: entry.macroGroup === "fat" ? 15 : 1,
      calories: 100,
    }));

    expect(() => createStagingAiCatalogSource({ exercises, foods }))
      .toThrowError(/STAGING_AI_CATALOG_EXERCISE_SOURCE_INVALID/);
  });
});
