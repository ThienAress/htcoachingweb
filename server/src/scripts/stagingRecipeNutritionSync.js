import { pathToFileURL } from "node:url";

import mongoose from "mongoose";

import Recipe from "../models/Recipe.js";
import { SEARCH_INDEX_RECIPE_SLUGS } from "../seo/recipeSearchIndexPolicy.js";
import {
  buildStagingRecipeNutritionPlan,
  createStagingRecipeNutritionPlanDigest,
  normalizePublicRecipeNutrition,
  recipeNutritionTargetHash,
  STAGING_RECIPE_NUTRITION_FIXTURE_KEY,
  stagingRecipeNutritionError,
  validateStagingRecipeNutritionAuthorization,
} from "./stagingRecipeNutritionSync.contract.js";

export {
  buildStagingRecipeNutritionPlan,
  createStagingRecipeNutritionPlanDigest,
  normalizePublicRecipeNutrition,
  validateStagingRecipeNutritionAuthorization,
} from "./stagingRecipeNutritionSync.contract.js";

const PRODUCTION_API_BASE = "https://htcoachingweb.onrender.com/api";

const fetchRecipe = async (slug, fetchImpl) => {
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetchImpl(
        `${PRODUCTION_API_BASE}/recipes/detail/${encodeURIComponent(slug)}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            "User-Agent": "HTCoaching-Staging-Recipe-Nutrition/1",
          },
          signal: AbortSignal.timeout(30_000),
        },
      );
      if (!response.ok) {
        throw stagingRecipeNutritionError(
          "STAGING_RECIPE_NUTRITION_SOURCE_REQUEST_FAILED",
        );
      }
      const payload = await response.json();
      if (
        payload?.success !== true ||
        payload.data?.slug !== slug ||
        !payload.data?.nutrition
      ) {
        throw stagingRecipeNutritionError(
          "STAGING_RECIPE_NUTRITION_SOURCE_RESPONSE_INVALID",
        );
      }
      normalizePublicRecipeNutrition(payload.data.nutrition);
      return { slug, nutrition: payload.data.nutrition };
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }
  throw lastError;
};

export const loadStagingRecipeNutritionSource = async ({
  fetchImpl = globalThis.fetch,
} = {}) =>
  Promise.all(
    SEARCH_INDEX_RECIPE_SLUGS.map((slug) => fetchRecipe(slug, fetchImpl)),
  );

export const loadStagingRecipeNutritionTargets = async ({
  connection = mongoose.connection,
} = {}) =>
  connection
    .collection(Recipe.collection.name)
    .find({ slug: { $in: [...SEARCH_INDEX_RECIPE_SLUGS] } })
    .toArray();

const applyOperation = async ({ collection, operation, session }) => {
  const id = new mongoose.Types.ObjectId(operation.id);
  const filter = {
    _id: id,
    slug: operation.slug,
    "_recipeCatalogFixture.managed": true,
    "_recipeCatalogFixture.key": STAGING_RECIPE_NUTRITION_FIXTURE_KEY,
  };
  const current = await collection.findOne(filter, { session });
  if (
    !current ||
    recipeNutritionTargetHash(current) !== operation.expectedTargetHash
  ) {
    throw stagingRecipeNutritionError(
      "STAGING_RECIPE_NUTRITION_TARGET_DRIFT",
      operation.slug,
    );
  }
  const result = await collection.updateOne(
    {
      ...filter,
      ...(current.updatedAt ? { updatedAt: current.updatedAt } : {}),
    },
    { $set: { nutrition: operation.nutrition, updatedAt: new Date() } },
    { session },
  );
  if (
    result.acknowledged !== true ||
    result.matchedCount !== 1 ||
    result.modifiedCount !== 1
  ) {
    throw stagingRecipeNutritionError(
      "STAGING_RECIPE_NUTRITION_UPDATE_STALE",
      operation.slug,
    );
  }
};

export const applyStagingRecipeNutritionPlan = async ({
  plan,
  connection = mongoose.connection,
  startSession = () => connection.startSession(),
} = {}) => {
  const session = await startSession();
  try {
    await session.withTransaction(async () => {
      const collection = connection.collection(Recipe.collection.name);
      for (const operation of plan.operations) {
        await applyOperation({ collection, operation, session });
      }
    });
  } finally {
    await session.endSession();
  }
  return { appliedOperationCount: plan.operations.length };
};

const defaultDependencies = {
  connect: (uri) => mongoose.connect(uri, { autoIndex: false }),
  disconnect: () => mongoose.disconnect(),
  assertConnectedTarget: ({ targetDatabase }) => {
    if (mongoose.connection.name !== targetDatabase) {
      throw stagingRecipeNutritionError(
        "STAGING_RECIPE_NUTRITION_CONNECTED_DATABASE_MISMATCH",
      );
    }
  },
  loadSourceRecipes: loadStagingRecipeNutritionSource,
  loadTargetRecipes: loadStagingRecipeNutritionTargets,
  applyPlan: applyStagingRecipeNutritionPlan,
};

export const runStagingRecipeNutritionSync = async ({
  argv = process.argv.slice(2),
  env = process.env,
  dependencies = {},
} = {}) => {
  const authorization = validateStagingRecipeNutritionAuthorization({
    argv,
    env,
  });
  const runtime = { ...defaultDependencies, ...dependencies };
  let connected = false;
  try {
    await runtime.connect(env.MONGO_URI);
    connected = true;
    await runtime.assertConnectedTarget(authorization);
    const sourceRecipes = await runtime.loadSourceRecipes();
    const targetRecipes = await runtime.loadTargetRecipes();
    const planDigest = createStagingRecipeNutritionPlanDigest({
      sourceRecipes,
      targetRecipes,
    });
    const plan = buildStagingRecipeNutritionPlan({
      sourceRecipes,
      targetRecipes,
    });
    if (
      authorization.apply &&
      authorization.expectedPlanDigest !== planDigest
    ) {
      throw stagingRecipeNutritionError(
        "STAGING_RECIPE_NUTRITION_PLAN_DIGEST_MISMATCH",
      );
    }

    let result = null;
    let verification = null;
    if (authorization.apply) {
      result = await runtime.applyPlan({ plan });
      const postTargets = await runtime.loadTargetRecipes();
      const postPlan = buildStagingRecipeNutritionPlan({
        sourceRecipes,
        targetRecipes: postTargets,
      });
      if (
        postPlan.operations.length !== 0 ||
        postPlan.summary.unchanged !== SEARCH_INDEX_RECIPE_SLUGS.length
      ) {
        throw stagingRecipeNutritionError(
          "STAGING_RECIPE_NUTRITION_POST_VERIFY_FAILED",
        );
      }
      verification = {
        verified: true,
        completeRecipes: postPlan.summary.unchanged,
      };
    }

    return {
      success: true,
      mode: authorization.apply ? "apply" : "preflight",
      target: authorization.target,
      database: authorization.targetDatabase,
      planDigest,
      summary: plan.summary,
      result,
      verification,
    };
  } finally {
    if (connected) await runtime.disconnect();
  }
};

const main = async () => {
  const result = await runStagingRecipeNutritionSync();
  console.log(JSON.stringify(result, null, 2));
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.code || "STAGING_RECIPE_NUTRITION_SYNC_FAILED");
    process.exitCode = 1;
  });
}
