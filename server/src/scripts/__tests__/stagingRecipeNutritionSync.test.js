import { describe, expect, it, vi } from "vitest";

import { SEARCH_INDEX_RECIPE_SLUGS } from "../../seo/recipeSearchIndexPolicy.js";
import {
  buildStagingRecipeNutritionPlan,
  createStagingRecipeNutritionPlanDigest,
  normalizePublicRecipeNutrition,
  runStagingRecipeNutritionSync,
  validateStagingRecipeNutritionAuthorization,
} from "../stagingRecipeNutritionSync.js";

const validStagingEnvironment = () => ({
  APP_ENV: "staging",
  MIGRATION_TARGET_DATABASE: "htcoaching_staging",
  MONGO_URI:
    "mongodb+srv://cluster.example/htcoaching_staging?retryWrites=true",
  CLIENT_URL: "https://staging--htcoachingweb.netlify.app",
  PUBLIC_API_ORIGIN: "https://htcoachingweb-staging.onrender.com",
  ALLOWED_ORIGINS: "https://staging--htcoachingweb.netlify.app",
  BACKGROUND_JOBS_ENABLED: "false",
  MORNING_HEALTH_REMINDER_ENABLED: "false",
  EMAIL_DELIVERY_MODE: "disabled",
  F1_RETENTION_ENFORCE: "false",
  NETLIFY_BUILD_HOOK_URL: "",
});

const nutrition = (calories = 500) => ({
  status: "available",
  source: "admin_manual",
  scope: "whole_recipe",
  values: {
    calories,
    protein: 40,
    fat: 16,
    carb: 45,
    sugars: 6,
    salt: 1.2,
  },
  additional: [{ label: "Kali", unit: "mg", value: 920 }],
});

const substantiveStep = (label) =>
  `${label}: prepare every ingredient carefully, follow the safe cooking order, and verify doneness before continuing to the next detailed step.`;

const sourceRecipes = () =>
  SEARCH_INDEX_RECIPE_SLUGS.map((slug, index) => ({
    slug,
    nutrition: nutrition(500 + index),
  }));

const targetRecipes = ({ withNutrition = false } = {}) =>
  SEARCH_INDEX_RECIPE_SLUGS.map((slug, index) => ({
    _id: `${index + 1}`.padStart(24, "0"),
    slug,
    name: `Pinned Recipe ${index + 1}`,
    thumbnail: `https://images.example.test/recipe-${index + 1}.jpg`,
    sourceUrl: `https://source.example.test/recipe-${index + 1}`,
    ingredients: [
      { name: "Carrot", measure: "100 g" },
      { name: "Tofu", measure: "200 g" },
      { name: "Mushroom", measure: "150 g" },
    ],
    instructions: [
      substantiveStep("Prepare"),
      substantiveStep("Cook"),
      substantiveStep("Finish"),
    ],
    nutrition: withNutrition
      ? normalizePublicRecipeNutrition(nutrition(500 + index))
      : null,
    isPublished: true,
    _recipeCatalogFixture: {
      managed: true,
      key: "plan-058a-public-recipe-catalog",
    },
  }));

describe("staging Recipe nutrition sync contract", () => {
  it("normalizes public milligrams to canonical grams", () => {
    expect(normalizePublicRecipeNutrition(nutrition()).additional).toEqual([
      { label: "Kali", unit: "g", value: 0.92 },
    ]);
  });

  it("plans exactly ten bounded nutrition-only updates", () => {
    const plan = buildStagingRecipeNutritionPlan({
      sourceRecipes: sourceRecipes(),
      targetRecipes: targetRecipes(),
    });
    expect({
      summary: plan.summary,
      fields: Object.keys(plan.operations[0].nutrition).sort(),
    }).toEqual({
      summary: { update: 10, unchanged: 0 },
      fields: [
        "additional",
        "calories",
        "carb",
        "fat",
        "protein",
        "salt",
        "scope",
        "source",
        "sugars",
      ],
    });
  });

  it("becomes a no-op only when all ten target values match", () => {
    const plan = buildStagingRecipeNutritionPlan({
      sourceRecipes: sourceRecipes(),
      targetRecipes: targetRecipes({ withNutrition: true }),
    });
    expect(plan).toMatchObject({
      summary: { update: 0, unchanged: 10 },
      operations: [],
    });
  });

  it.each([
    ["missing", targetRecipes().slice(1), "STAGING_RECIPE_NUTRITION_TARGET_SET_INVALID"],
    [
      "unowned",
      targetRecipes().map((item, index) =>
        index === 0 ? { ...item, _recipeCatalogFixture: undefined } : item,
      ),
      "STAGING_RECIPE_NUTRITION_TARGET_OWNERSHIP_INVALID",
    ],
    [
      "ineligible",
      targetRecipes().map((item, index) =>
        index === 0 ? { ...item, sourceUrl: "" } : item,
      ),
      "STAGING_RECIPE_NUTRITION_POST_STATE_INELIGIBLE",
    ],
  ])("rejects a %s target before writes", (_, targets, code) => {
    expect(() =>
      buildStagingRecipeNutritionPlan({
        sourceRecipes: sourceRecipes(),
        targetRecipes: targets,
      }),
    ).toThrowError(expect.objectContaining({ code }));
  });

  it("requires exact staging guards and a reviewed digest for apply", () => {
    const env = validStagingEnvironment();
    expect(
      validateStagingRecipeNutritionAuthorization({
        argv: ["--target=staging"],
        env,
      }),
    ).toMatchObject({ target: "staging", apply: false });
    expect(() =>
      validateStagingRecipeNutritionAuthorization({
        argv: ["--target=staging", "--apply"],
        env,
      }),
    ).toThrowError(/STAGING_RECIPE_NUTRITION_APPLY_CONFIRMATION_REQUIRED/);
    expect(() =>
      validateStagingRecipeNutritionAuthorization({
        argv: ["--target=production"],
        env: { ...env, APP_ENV: "production" },
      }),
    ).toThrowError(/STAGING_RECIPE_NUTRITION_TARGET_REQUIRED/);
  });

  it("creates an order-stable SHA-256 preflight digest", () => {
    const source = sourceRecipes();
    const target = targetRecipes();
    const digest = createStagingRecipeNutritionPlanDigest({
      sourceRecipes: source,
      targetRecipes: target,
    });
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(digest).toBe(
      createStagingRecipeNutritionPlanDigest({
        sourceRecipes: [...source].reverse(),
        targetRecipes: [...target].reverse(),
      }),
    );
  });
});

describe("staging Recipe nutrition sync run seam", () => {
  const dependenciesFor = ({ targets, applyPlan = vi.fn() }) => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    assertConnectedTarget: vi.fn(),
    loadSourceRecipes: vi.fn().mockResolvedValue(sourceRecipes()),
    loadTargetRecipes: vi
      .fn()
      .mockResolvedValueOnce(targets)
      .mockResolvedValueOnce(targetRecipes({ withNutrition: true })),
    applyPlan,
  });

  it("keeps preflight read-only", async () => {
    const applyPlan = vi.fn();
    const result = await runStagingRecipeNutritionSync({
      argv: ["--target=staging"],
      env: validStagingEnvironment(),
      dependencies: dependenciesFor({
        targets: targetRecipes(),
        applyPlan,
      }),
    });
    expect({ mode: result.mode, writes: applyPlan.mock.calls.length }).toEqual({
      mode: "preflight",
      writes: 0,
    });
  });

  it("rejects a stale digest before apply", async () => {
    const applyPlan = vi.fn();
    const error = await runStagingRecipeNutritionSync({
      argv: [
        "--target=staging",
        "--apply",
        "--confirm-search-recipe-nutrition",
        `--expected-plan-digest=${"a".repeat(64)}`,
      ],
      env: {
        ...validStagingEnvironment(),
        CONFIRM_STAGING_SEARCH_RECIPE_NUTRITION_SYNC: "yes",
      },
      dependencies: dependenciesFor({
        targets: targetRecipes(),
        applyPlan,
      }),
    }).catch((caught) => caught);
    expect({ code: error.code, writes: applyPlan.mock.calls.length }).toEqual({
      code: "STAGING_RECIPE_NUTRITION_PLAN_DIGEST_MISMATCH",
      writes: 0,
    });
  });

  it("applies the reviewed plan and verifies ten complete targets", async () => {
    const targets = targetRecipes();
    const digest = createStagingRecipeNutritionPlanDigest({
      sourceRecipes: sourceRecipes(),
      targetRecipes: targets,
    });
    const applyPlan = vi.fn().mockResolvedValue({ appliedOperationCount: 10 });
    const result = await runStagingRecipeNutritionSync({
      argv: [
        "--target=staging",
        "--apply",
        "--confirm-search-recipe-nutrition",
        `--expected-plan-digest=${digest}`,
      ],
      env: {
        ...validStagingEnvironment(),
        CONFIRM_STAGING_SEARCH_RECIPE_NUTRITION_SYNC: "yes",
      },
      dependencies: dependenciesFor({ targets, applyPlan }),
    });
    expect({
      writes: applyPlan.mock.calls.length,
      verification: result.verification,
    }).toEqual({
      writes: 1,
      verification: { verified: true, completeRecipes: 10 },
    });
  });
});
