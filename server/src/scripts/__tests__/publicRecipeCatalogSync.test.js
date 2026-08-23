import { describe, expect, it } from "vitest";

import {
  FIXTURE_KEY,
  LOCAL_RECIPE_DATABASE,
  LOCAL_RECIPE_MONGO_URI,
  PRODUCTION_RECIPE_API_ORIGIN,
  RECIPE_MANIFEST,
  classifyRecipeRecord,
  sanitizeProductionRecipe,
  validateLocalRecipeTarget,
  validateRecipeManifest,
  validateRecipeSyncTarget,
} from "../publicRecipeCatalogSync.contract.js";

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
  CONFIRM_STAGING_RECIPE_CATALOG_SYNC: "yes",
});

describe("public recipe catalog manifest", () => {
  it("pins exactly 10 unique production recipe slugs", () => {
    expect(PRODUCTION_RECIPE_API_ORIGIN).toBe(
      "https://htcoachingweb.onrender.com",
    );
    expect(RECIPE_MANIFEST).toHaveLength(10);
    expect(new Set(RECIPE_MANIFEST.map(({ slug }) => slug)).size).toBe(10);
    expect(() => validateRecipeManifest()).not.toThrow();
  });

  it("rejects duplicate or malformed manifest slugs", () => {
    expect(() =>
      validateRecipeManifest([{ slug: "valid-slug" }, { slug: "valid-slug" }]),
    ).toThrowError(expect.objectContaining({ code: "RECIPE_CATALOG_MANIFEST_INVALID" }));
    expect(() => validateRecipeManifest([{ slug: "Not Valid" }])).toThrowError(
      expect.objectContaining({ code: "RECIPE_CATALOG_MANIFEST_INVALID" }),
    );
  });
});

describe("public recipe catalog sanitizer", () => {
  it("keeps only bounded Recipe schema fields and publishes the copied recipe", () => {
    const result = sanitizeProductionRecipe({
      _id: "production-id-must-not-be-copied",
      name: "  Vietnamese Bowl  ",
      nameEn: " Vietnamese Bowl ",
      slug: "vietnamese-bowl",
      category: "Healthy",
      area: "Vietnamese",
      thumbnail: "https://images.example/bowl.jpg",
      prepTime: "30 minutes",
      ingredients: [
        { name: " Chicken breast ", measure: " 100g " },
        { name: " ", measure: "1 tsp" },
      ],
      instructions: [" Mix ingredients. ", ""],
      sourceUrl: "https://example.com/recipe",
      source: "mealdb",
      mealDbId: "123",
      tags: [" vietnamese ", ""],
      nutrition: { total: { calories: 500 } },
      isPublished: false,
      unexpected: "drop-me",
    });

    expect(result).toEqual({
      name: "Vietnamese Bowl",
      nameEn: "Vietnamese Bowl",
      slug: "vietnamese-bowl",
      category: "Healthy",
      area: "Vietnamese",
      thumbnail: "https://images.example/bowl.jpg",
      prepTime: "30 minutes",
      ingredients: [{ name: "Chicken breast", measure: "100g" }],
      instructions: ["Mix ingredients."],
      youtubeUrl: "",
      sourceUrl: "https://example.com/recipe",
      source: "mealdb",
      mealDbId: "123",
      tags: ["vietnamese"],
      isPublished: true,
    });
  });

  it("rejects source detail without usable ingredients or instructions", () => {
    const base = { name: "Recipe", slug: "recipe", ingredients: [], instructions: [] };
    expect(() => sanitizeProductionRecipe(base)).toThrowError(
      expect.objectContaining({ code: "RECIPE_CATALOG_SOURCE_RECIPE_INVALID" }),
    );
  });
});

describe("public recipe catalog target guards", () => {
  it("accepts only localhost with the exact local database", () => {
    expect(LOCAL_RECIPE_DATABASE).toBe("htcoaching_local");
    expect(validateLocalRecipeTarget(LOCAL_RECIPE_MONGO_URI)).toEqual({
      valid: true,
      errors: [],
    });
    expect(
      validateLocalRecipeTarget(
        "mongodb://cluster.example/htcoaching_local?replicaSet=rs0",
      ).errors,
    ).toContain("LOCAL_RECIPE_CATALOG_HOST_REQUIRED");
    expect(
      validateLocalRecipeTarget(
        "mongodb://127.0.0.1:27017/htcoaching_staging?replicaSet=rs0",
      ).errors,
    ).toContain("LOCAL_RECIPE_CATALOG_DATABASE_REQUIRED");
  });

  it("reuses staging safety and requires a dedicated confirmation", () => {
    expect(
      validateRecipeSyncTarget({
        target: "staging",
        env: validStagingEnvironment(),
      }),
    ).toEqual({ valid: true, errors: [] });

    const env = validStagingEnvironment();
    delete env.CONFIRM_STAGING_RECIPE_CATALOG_SYNC;
    expect(validateRecipeSyncTarget({ target: "staging", env }).errors).toContain(
      "STAGING_OPERATION_CONFIRMATION_REQUIRED",
    );
  });
});

describe("public recipe catalog ownership policy", () => {
  it("inserts missing, updates owned records and rejects unmanaged collisions", () => {
    expect(classifyRecipeRecord(null)).toBe("insert");
    expect(
      classifyRecipeRecord({
        _recipeCatalogFixture: { managed: true, key: FIXTURE_KEY },
      }),
    ).toBe("update");
    expect(classifyRecipeRecord({ slug: "existing-unmanaged" })).toBe("conflict");
    expect(
      classifyRecipeRecord({
        _recipeCatalogFixture: { managed: true, key: "another-sync" },
      }),
    ).toBe("conflict");
  });
});
