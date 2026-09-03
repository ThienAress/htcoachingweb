import { createHash } from "node:crypto";

import { validateStagingEnvironment } from "../config/stagingSafety.js";
import { assertStagingOperation } from "../config/stagingOperationSafety.js";
import { normalizeManualRecipeNutrition } from "../services/recipeNutrition.service.js";
import {
  isPinnedRecipePostStateEligible,
  SEARCH_INDEX_RECIPE_SLUGS,
} from "../seo/recipeSearchIndexPolicy.js";

export const STAGING_RECIPE_NUTRITION_CONFIRMATION =
  "CONFIRM_STAGING_SEARCH_RECIPE_NUTRITION_SYNC";
export const STAGING_RECIPE_NUTRITION_DIGEST_VARIABLE =
  "STAGING_SEARCH_RECIPE_NUTRITION_EXPECTED_PLAN_DIGEST";
export const STAGING_RECIPE_NUTRITION_FIXTURE_KEY =
  "plan-058a-public-recipe-catalog";
const STAGING_DATABASE = "htcoaching_staging";
const DIGEST_ARGUMENT = "--expected-plan-digest=";
const slugSet = new Set(SEARCH_INDEX_RECIPE_SLUGS);

export const stagingRecipeNutritionError = (code, message = code) =>
  Object.assign(new Error(`${code}: ${message}`), { code });

const databaseName = (uri) => {
  try {
    return decodeURIComponent(new URL(String(uri || "")).pathname)
      .replace(/^\/+/, "")
      .split("/")[0];
  } catch {
    return "";
  }
};

const canonicalValue = (value) => {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value.toHexString === "function") {
    return value.toHexString();
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .filter((key) => value[key] !== undefined)
        .sort()
        .map((key) => [key, canonicalValue(value[key])]),
    );
  }
  return value;
};

const hashValue = (value) =>
  createHash("sha256")
    .update(JSON.stringify(canonicalValue(value)))
    .digest("hex");

const sortedBySlug = (rows) =>
  [...(rows || [])].sort((left, right) =>
    String(left?.slug || "").localeCompare(String(right?.slug || "")),
  );

export const recipeNutritionTargetHash = (recipe) =>
  hashValue({
    _id: recipe?._id,
    slug: recipe?.slug,
    name: recipe?.name,
    thumbnail: recipe?.thumbnail,
    sourceUrl: recipe?.sourceUrl,
    ingredients: recipe?.ingredients,
    instructions: recipe?.instructions,
    nutrition: recipe?.nutrition,
    isPublished: recipe?.isPublished,
    fixture: recipe?._recipeCatalogFixture,
    updatedAt: recipe?.updatedAt,
  });

export const normalizePublicRecipeNutrition = (nutrition) => {
  if (
    !nutrition ||
    nutrition.status !== "available" ||
    nutrition.scope !== "whole_recipe" ||
    nutrition.source !== "admin_manual"
  ) {
    throw stagingRecipeNutritionError(
      "STAGING_RECIPE_NUTRITION_SOURCE_INCOMPLETE",
    );
  }
  try {
    const normalized = normalizeManualRecipeNutrition({
      ...nutrition.values,
      additional: nutrition.additional,
    });
    if (normalized.calories <= 0) {
      throw new TypeError("calories must be positive");
    }
    return normalized;
  } catch (error) {
    throw stagingRecipeNutritionError(
      "STAGING_RECIPE_NUTRITION_SOURCE_INVALID",
      error.message,
    );
  }
};

const assertExactSlugSet = (rows, code) => {
  const slugs = rows.map(({ slug }) => String(slug || ""));
  if (
    slugs.length !== SEARCH_INDEX_RECIPE_SLUGS.length ||
    new Set(slugs).size !== SEARCH_INDEX_RECIPE_SLUGS.length ||
    slugs.some((slug) => !slugSet.has(slug))
  ) {
    throw stagingRecipeNutritionError(code);
  }
};

export const buildStagingRecipeNutritionPlan = ({
  sourceRecipes = [],
  targetRecipes = [],
} = {}) => {
  assertExactSlugSet(
    sourceRecipes,
    "STAGING_RECIPE_NUTRITION_SOURCE_SET_INVALID",
  );
  assertExactSlugSet(
    targetRecipes,
    "STAGING_RECIPE_NUTRITION_TARGET_SET_INVALID",
  );
  const sourceBySlug = new Map(
    sourceRecipes.map((recipe) => [
      recipe.slug,
      normalizePublicRecipeNutrition(recipe.nutrition),
    ]),
  );
  const operations = [];
  let unchanged = 0;

  for (const target of targetRecipes) {
    if (
      target?._recipeCatalogFixture?.managed !== true ||
      target._recipeCatalogFixture.key !==
        STAGING_RECIPE_NUTRITION_FIXTURE_KEY
    ) {
      throw stagingRecipeNutritionError(
        "STAGING_RECIPE_NUTRITION_TARGET_OWNERSHIP_INVALID",
      );
    }
    const nutrition = sourceBySlug.get(target.slug);
    if (!isPinnedRecipePostStateEligible({ ...target, nutrition })) {
      throw stagingRecipeNutritionError(
        "STAGING_RECIPE_NUTRITION_POST_STATE_INELIGIBLE",
        target.slug,
      );
    }
    if (hashValue(target.nutrition) === hashValue(nutrition)) {
      unchanged += 1;
      continue;
    }
    operations.push({
      id: String(target._id),
      slug: target.slug,
      expectedTargetHash: recipeNutritionTargetHash(target),
      nutrition,
    });
  }

  return {
    operations,
    summary: { update: operations.length, unchanged },
  };
};

export const createStagingRecipeNutritionPlanDigest = ({
  sourceRecipes = [],
  targetRecipes = [],
} = {}) =>
  hashValue({
    schemaVersion: 1,
    fixtureKey: STAGING_RECIPE_NUTRITION_FIXTURE_KEY,
    sourceRecipes: sortedBySlug(sourceRecipes),
    targetRecipes: sortedBySlug(targetRecipes),
  });

const expectedDigest = (argv, env) => {
  const cli = argv
    .filter((argument) => argument.startsWith(DIGEST_ARGUMENT))
    .map((argument) => argument.slice(DIGEST_ARGUMENT.length).trim().toLowerCase());
  const environment = String(
    env[STAGING_RECIPE_NUTRITION_DIGEST_VARIABLE] || "",
  )
    .trim()
    .toLowerCase();
  const values = [...cli, ...(environment ? [environment] : [])];
  if (values.length === 0) {
    throw stagingRecipeNutritionError(
      "STAGING_RECIPE_NUTRITION_PLAN_DIGEST_REQUIRED",
    );
  }
  if (values.some((value) => !/^[a-f0-9]{64}$/.test(value))) {
    throw stagingRecipeNutritionError(
      "STAGING_RECIPE_NUTRITION_PLAN_DIGEST_INVALID",
    );
  }
  if (new Set(values).size !== 1) {
    throw stagingRecipeNutritionError(
      "STAGING_RECIPE_NUTRITION_PLAN_DIGEST_CONFLICT",
    );
  }
  return values[0];
};

export const validateStagingRecipeNutritionAuthorization = ({
  argv = [],
  env = process.env,
} = {}) => {
  const args = new Set(argv);
  const target = argv
    .find((argument) => argument.startsWith("--target="))
    ?.slice("--target=".length);
  if (target !== "staging") {
    throw stagingRecipeNutritionError(
      "STAGING_RECIPE_NUTRITION_TARGET_REQUIRED",
    );
  }
  if (
    String(env.APP_ENV || "").toLowerCase() !== "staging" ||
    databaseName(env.MONGO_URI) !== STAGING_DATABASE ||
    String(env.MIGRATION_TARGET_DATABASE || "") !== STAGING_DATABASE
  ) {
    throw stagingRecipeNutritionError(
      "STAGING_RECIPE_NUTRITION_DATABASE_GUARD_FAILED",
    );
  }
  const safety = validateStagingEnvironment(env);
  if (!safety.valid) {
    throw stagingRecipeNutritionError(
      "STAGING_RECIPE_NUTRITION_ENVIRONMENT_REJECTED",
      safety.errors.map(({ code }) => code).join(", "),
    );
  }

  const apply = args.has("--apply");
  let planDigest = "";
  if (apply) {
    if (
      !args.has("--confirm-search-recipe-nutrition") ||
      String(env[STAGING_RECIPE_NUTRITION_CONFIRMATION] || "").toLowerCase() !==
        "yes"
    ) {
      throw stagingRecipeNutritionError(
        "STAGING_RECIPE_NUTRITION_APPLY_CONFIRMATION_REQUIRED",
      );
    }
    planDigest = expectedDigest(argv, env);
    assertStagingOperation({
      env,
      confirmationVariable: STAGING_RECIPE_NUTRITION_CONFIRMATION,
    });
  }
  return {
    target,
    apply,
    targetDatabase: STAGING_DATABASE,
    expectedPlanDigest: planDigest,
  };
};
