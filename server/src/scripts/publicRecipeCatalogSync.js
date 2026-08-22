import { pathToFileURL } from "node:url";

import mongoose from "mongoose";

import Recipe from "../models/Recipe.js";
import {
  FIXTURE_KEY,
  LOCAL_RECIPE_DATABASE,
  LOCAL_RECIPE_MONGO_URI,
  PRODUCTION_RECIPE_API_ORIGIN,
  RECIPE_MANIFEST,
  STAGING_RECIPE_DATABASE,
  assertRecipeSyncTarget,
  classifyRecipeRecord,
  makeRecipeCatalogError,
  sanitizeProductionRecipe,
  validateLocalRecipeTarget,
  validateRecipeManifest,
  validateRecipeSyncTarget,
} from "./publicRecipeCatalogSync.contract.js";

export {
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
};

const FIXTURE_VERSION = "2026-08-21-v1";

const fetchRecipeDetail = async (slug, fetchImpl = fetch) => {
  const url = new URL(
    `/api/recipes/detail/${encodeURIComponent(slug)}`,
    PRODUCTION_RECIPE_API_ORIGIN,
  );
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "HTCoaching-Recipe-Catalog-Sync/1",
        },
        signal: AbortSignal.timeout(45_000),
      });
      if (!response.ok) {
        throw makeRecipeCatalogError("RECIPE_CATALOG_SOURCE_REQUEST_FAILED");
      }
      const payload = await response.json();
      if (payload?.success !== true || !payload.data) {
        throw makeRecipeCatalogError("RECIPE_CATALOG_SOURCE_RESPONSE_INVALID");
      }
      const recipe = sanitizeProductionRecipe(payload.data);
      if (recipe.slug !== slug) {
        throw makeRecipeCatalogError("RECIPE_CATALOG_SOURCE_SLUG_DRIFT");
      }
      return recipe;
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }
  throw lastError;
};

const loadSourceCatalog = async (fetchImpl) => {
  const recipes = await Promise.all(
    RECIPE_MANIFEST.map(({ slug }) => fetchRecipeDetail(slug, fetchImpl)),
  );
  for (const recipe of recipes) {
    try {
      await new Recipe(recipe).validate();
    } catch {
      throw makeRecipeCatalogError("RECIPE_CATALOG_MODEL_VALIDATION_FAILED");
    }
  }
  return recipes;
};

const buildPlan = async (collection, recipes) => {
  const slugs = recipes.map(({ slug }) => slug);
  const existingRows = await collection
    .find({ slug: { $in: slugs } })
    .project({ slug: 1, _recipeCatalogFixture: 1 })
    .toArray();
  const existingBySlug = new Map(existingRows.map((row) => [row.slug, row]));
  const entries = recipes.map((recipe) => {
    const existing = existingBySlug.get(recipe.slug);
    return {
      recipe,
      existing,
      action: classifyRecipeRecord(existing),
    };
  });
  const conflicts = entries
    .filter(({ action }) => action === "conflict")
    .map(({ recipe }) => recipe.slug);
  if (conflicts.length > 0) {
    throw makeRecipeCatalogError(
      "RECIPE_CATALOG_UNMANAGED_COLLISION",
      `Recipe catalog unmanaged slug collision: ${conflicts.join(", ")}`,
    );
  }
  return entries;
};

const summarizePlan = (plan) =>
  Object.fromEntries(
    ["insert", "update"].map((action) => [
      action,
      plan.filter((entry) => entry.action === action).length,
    ]),
  );

const applyPlan = async (collection, plan) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const now = new Date();
      const marker = {
        managed: true,
        key: FIXTURE_KEY,
        version: FIXTURE_VERSION,
        source: "production-public-api",
        syncedAt: now,
      };
      for (const entry of plan) {
        if (entry.action === "insert") {
          await collection.insertOne(
            {
              ...entry.recipe,
              _recipeCatalogFixture: marker,
              createdAt: now,
              updatedAt: now,
            },
            { session },
          );
          continue;
        }
        const result = await collection.updateOne(
          {
            _id: entry.existing._id,
            "_recipeCatalogFixture.managed": true,
            "_recipeCatalogFixture.key": FIXTURE_KEY,
          },
          {
            $set: {
              ...entry.recipe,
              _recipeCatalogFixture: marker,
              updatedAt: now,
            },
          },
          { session },
        );
        if (result.matchedCount !== 1) {
          throw makeRecipeCatalogError("RECIPE_CATALOG_UPDATE_DRIFT");
        }
      }
    });
  } finally {
    await session.endSession();
  }
};

const verifyTarget = async (collection) => {
  const slugs = RECIPE_MANIFEST.map(({ slug }) => slug);
  const recipes = await collection
    .find({
      slug: { $in: slugs },
      isPublished: true,
      "_recipeCatalogFixture.managed": true,
      "_recipeCatalogFixture.key": FIXTURE_KEY,
    })
    .project({ slug: 1, ingredients: 1, instructions: 1 })
    .toArray();
  const complete = recipes.filter(
    (recipe) =>
      Array.isArray(recipe.ingredients) &&
      recipe.ingredients.length > 0 &&
      Array.isArray(recipe.instructions) &&
      recipe.instructions.length > 0,
  );
  if (recipes.length !== 10 || complete.length !== 10) {
    throw makeRecipeCatalogError("RECIPE_CATALOG_VERIFY_FAILED");
  }
  return { recipes: recipes.length, completeRecipes: complete.length };
};

const parseArgs = (argv) => {
  const targetArg = argv.find((arg) => arg.startsWith("--target="));
  return {
    target: targetArg?.slice("--target=".length),
    apply: argv.includes("--apply"),
  };
};

export const runPublicRecipeCatalogSync = async ({
  argv = process.argv.slice(2),
  env = process.env,
  fetchImpl = fetch,
} = {}) => {
  const options = parseArgs(argv);
  const mongoUri =
    options.target === "local" ? LOCAL_RECIPE_MONGO_URI : env.MONGO_URI;
  assertRecipeSyncTarget({ target: options.target, env, mongoUri });
  validateRecipeManifest();
  const recipes = await loadSourceCatalog(fetchImpl);

  await mongoose.connect(mongoUri, { autoIndex: false });
  try {
    const expectedDatabase =
      options.target === "local"
        ? LOCAL_RECIPE_DATABASE
        : STAGING_RECIPE_DATABASE;
    if (mongoose.connection.name !== expectedDatabase) {
      throw makeRecipeCatalogError(
        "RECIPE_CATALOG_CONNECTED_DATABASE_MISMATCH",
      );
    }
    const collection = mongoose.connection.collection("recipes");
    const plan = await buildPlan(collection, recipes);
    const actions = summarizePlan(plan);
    if (options.apply) await applyPlan(collection, plan);
    return {
      operation: "sync",
      mode: options.apply ? "apply" : "dry-run",
      target: options.target,
      database: expectedDatabase,
      source: { origin: PRODUCTION_RECIPE_API_ORIGIN, recipes: recipes.length },
      actions,
      verified: options.apply ? await verifyTarget(collection) : null,
    };
  } finally {
    await mongoose.disconnect();
  }
};

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  runPublicRecipeCatalogSync()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(
        JSON.stringify({
          success: false,
          code: error.code || "RECIPE_CATALOG_SYNC_FAILED",
          message: error.message,
        }),
      );
      process.exitCode = 1;
    });
}
