import { describe, expect, it, vi } from "vitest";

import {
  STAGING_AI_CATALOG_APPLY_CONFIRMATION,
  STAGING_AI_CATALOG_EXERCISES,
  STAGING_AI_CATALOG_FOODS,
  STAGING_AI_CATALOG_MONGO_CONNECT_OPTIONS,
  STAGING_AI_CATALOG_PLAN_DIGEST_VARIABLE,
} from "../stagingAiCatalogRollout.contract.js";
import { loadStagingAiCatalogSource } from "../stagingAiCatalogRollout.source.js";
import { runStagingAiCatalogRollout } from "../stagingAiCatalogRollout.js";

const env = (overrides = {}) => ({
  APP_ENV: "staging",
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

const exercise = ({ id, name }) => ({
  _id: id,
  name,
  muscleGroup: "Cơ ngực",
  description: "Bodyweight push-up không cần dụng cụ, phù hợp cho người mới.",
  instructions: [],
});

const food = ({ label, macroGroup }, index) => ({
  _id: String(index + 1).padStart(24, "0"),
  label,
  protein: macroGroup === "protein" ? 31 : 2,
  carb: macroGroup === "carb" ? 17 : 8,
  fat: macroGroup === "fat" ? 15 : 1,
  calories: 100,
});

describe("staging AI catalog source loader", () => {
  it("disables implicit Mongo DDL for read-only preflight connections", () => {
    expect(STAGING_AI_CATALOG_MONGO_CONNECT_OPTIONS).toEqual({
      autoIndex: false,
      autoCreate: false,
    });
  });

  it("uses exact exercise detail endpoints and one bounded food request", async () => {
    const fetchImpl = vi.fn(async (url) => {
      const match = STAGING_AI_CATALOG_EXERCISES.find(({ id }) => url.endsWith(`/exercises/${id}`));
      return {
        ok: true,
        json: async () => match
          ? { success: true, data: exercise(match) }
          : { success: true, data: STAGING_AI_CATALOG_FOODS.map(food) },
      };
    });
    const source = await loadStagingAiCatalogSource({ fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(6);
    expect([
      source.exercises.length,
      source.foods.length,
      source.prices.length,
    ]).toEqual([5, 3, 3]);
  });
});

describe("staging AI catalog runtime seam", () => {
  const source = { exercises: [], foods: [], prices: [] };
  const target = {
    exercises: [], foods: [], priceObservations: [], exerciseReviewCounts: {},
  };
  const dependencies = () => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    assertConnectedTarget: vi.fn(),
    loadSource: vi.fn().mockResolvedValue(source),
    loadTarget: vi.fn().mockResolvedValue(target),
    createDigest: vi.fn().mockReturnValue("a".repeat(64)),
    buildPlan: vi.fn().mockReturnValue({
      operations: [
        {
          type: "insert_exercise",
          id: STAGING_AI_CATALOG_EXERCISES[0].id,
          document: { name: STAGING_AI_CATALOG_EXERCISES[0].name },
        },
        {
          type: "update_food",
          id: "000000000000000000000001",
          allergenProfile: {
            sourceType: "official_database",
            sourceUrl: STAGING_AI_CATALOG_FOODS[0].identitySourceUrl,
            reviewedAt: new Date("2026-09-18T00:00:00.000Z"),
            reviewedScopes: ["specific_foods"],
          },
          marker: {
            sourceKey: STAGING_AI_CATALOG_FOODS[0].label,
            evidence: {
              identitySourceUrl: STAGING_AI_CATALOG_FOODS[0].identitySourceUrl,
              allergenTaxonomySourceUrl: STAGING_AI_CATALOG_FOODS[0].allergenTaxonomySourceUrl,
              scope: "generic_whole_food_big_9_identity_only",
              crossContactStatus: "not_asserted",
            },
            priorState: { secretSnapshot: "must-not-leak" },
          },
        },
      ],
      summary: { insertExercise: 1, updateFood: 1 },
    }),
    applyPlan: vi.fn(),
    verifyPostState: vi.fn().mockResolvedValue({ ready: true }),
  });

  it("keeps preflight read-only and returns a reviewable digest", async () => {
    const runtime = dependencies();
    const result = await runStagingAiCatalogRollout({
      argv: ["--target=staging"],
      env: env(),
      dependencies: runtime,
    });
    expect(result).toMatchObject({ mode: "preflight", planDigest: "a".repeat(64) });
    expect(result.writes).toEqual([
      {
        type: "insert_exercise",
        id: STAGING_AI_CATALOG_EXERCISES[0].id,
        name: STAGING_AI_CATALOG_EXERCISES[0].name,
      },
      {
        type: "update_food",
        id: "000000000000000000000001",
        label: STAGING_AI_CATALOG_FOODS[0].label,
        evidence: {
          sourceType: "official_database",
          sourceUrl: STAGING_AI_CATALOG_FOODS[0].identitySourceUrl,
          taxonomySourceUrl: STAGING_AI_CATALOG_FOODS[0].allergenTaxonomySourceUrl,
          reviewedAt: "2026-09-18T00:00:00.000Z",
          reviewedScopes: ["specific_foods"],
          scope: "generic_whole_food_big_9_identity_only",
          crossContactStatus: "not_asserted",
        },
      },
    ]);
    expect(JSON.stringify(result.writes)).not.toMatch(/must-not-leak|secretSnapshot/i);
    expect(runtime.applyPlan).not.toHaveBeenCalled();
    expect(runtime.verifyPostState).not.toHaveBeenCalled();
    expect(runtime.disconnect).toHaveBeenCalledOnce();
  });

  it("applies and post-verifies only when the reviewed digest still matches", async () => {
    const digest = "a".repeat(64);
    const runtime = dependencies();
    const result = await runStagingAiCatalogRollout({
      argv: ["--target=staging", "--apply", "--confirm-ai-catalog-rollout"],
      env: env({
        [STAGING_AI_CATALOG_APPLY_CONFIRMATION]: "yes",
        [STAGING_AI_CATALOG_PLAN_DIGEST_VARIABLE]: digest,
      }),
      dependencies: runtime,
    });
    expect(result.mode).toBe("apply");
    expect(runtime.applyPlan).toHaveBeenCalledOnce();
    expect(runtime.verifyPostState).toHaveBeenCalledOnce();
  });

  it("blocks apply when source or target drift changes the digest", async () => {
    const runtime = dependencies();
    await expect(runStagingAiCatalogRollout({
      argv: ["--target=staging", "--apply", "--confirm-ai-catalog-rollout"],
      env: env({
        [STAGING_AI_CATALOG_APPLY_CONFIRMATION]: "yes",
        [STAGING_AI_CATALOG_PLAN_DIGEST_VARIABLE]: "b".repeat(64),
      }),
      dependencies: runtime,
    })).rejects.toThrowError(/STAGING_AI_CATALOG_PLAN_DIGEST_MISMATCH/);
    expect(runtime.applyPlan).not.toHaveBeenCalled();
  });
});
