import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import mongoose from "mongoose";

import { evaluateBackupReadiness } from "../../../scripts/lib/backup-readiness.mjs";
import {
  assertConnectedMigrationTarget,
  assertMigrationEnvironment,
  getMongoDatabaseName,
} from "../config/migrationSafety.js";
import Recipe from "../models/Recipe.js";

export const RECIPE_NUTRITION_UNIT_CONFIRMATION_VARIABLE =
  "CONFIRM_RECIPE_NUTRITION_UNIT_MIGRATION";
const BACKUP_MANIFEST_URL = new URL(
  "../../../docs/operations/production/backup-readiness.json",
  import.meta.url,
);

const TARGET_FILTER = {
  "nutrition.additional": { $elemMatch: { unit: "mg" } },
};

const MILLIGRAMS_PER_GRAM = 1000;

const migrationError = (code, message) =>
  Object.assign(new Error(message), { code });

const parseTarget = (args) =>
  [...args]
    .find((argument) => argument.startsWith("--target="))
    ?.slice("--target=".length);

const loadCurrentReleaseBackupManifest = async () =>
  JSON.parse(await readFile(BACKUP_MANIFEST_URL, "utf8"));

export const assertCurrentReleaseBackup = ({
  manifest,
  env = process.env,
}) => {
  const readiness = evaluateBackupReadiness(manifest);
  if (!readiness.releaseReady) {
    throw migrationError(
      "RECIPE_NUTRITION_UNIT_BACKUP_NOT_READY",
      "Recipe nutrition unit production apply requires a release-ready backup",
    );
  }
  if (
    String(env.MIGRATION_BACKUP_SNAPSHOT_ID || "").trim() !==
    readiness.backupId
  ) {
    throw migrationError(
      "RECIPE_NUTRITION_UNIT_BACKUP_MISMATCH",
      "Recipe nutrition unit backup ID does not match current evidence",
    );
  }
  return readiness;
};

export const authorizeRecipeNutritionUnitTarget = async ({
  args,
  apply,
  env = process.env,
  loadBackupManifest = loadCurrentReleaseBackupManifest,
}) => {
  const target = parseTarget(args);
  if (!new Set(["staging", "production"]).has(target)) {
    throw migrationError(
      "RECIPE_NUTRITION_UNIT_TARGET_REQUIRED",
      "Use an explicit --target=staging or --target=production",
    );
  }
  if (String(env.APP_ENV || "").trim().toLowerCase() !== target) {
    throw migrationError(
      "RECIPE_NUTRITION_UNIT_TARGET_MISMATCH",
      "Recipe nutrition unit target does not match APP_ENV",
    );
  }
  if (!env.MONGO_URI) {
    throw migrationError(
      "RECIPE_NUTRITION_UNIT_MONGO_URI_REQUIRED",
      "MONGO_URI is required",
    );
  }

  const uriDatabase = getMongoDatabaseName(env.MONGO_URI);
  const targetDatabase = String(env.MIGRATION_TARGET_DATABASE || "").trim();
  if (!uriDatabase || !targetDatabase || uriDatabase !== targetDatabase) {
    throw migrationError(
      "RECIPE_NUTRITION_UNIT_DATABASE_MISMATCH",
      "Recipe nutrition unit database target lock failed",
    );
  }

  if (!apply) return { valid: true, targetDatabase };
  if (!args.has("--confirm-recipe-nutrition-units")) {
    throw migrationError(
      "RECIPE_NUTRITION_UNIT_CONFIRMATION_REQUIRED",
      "Apply requires --confirm-recipe-nutrition-units",
    );
  }
  const authorization = assertMigrationEnvironment({
    env,
    confirmationVariable: RECIPE_NUTRITION_UNIT_CONFIRMATION_VARIABLE,
  });
  if (target === "production") {
    const manifest = await loadBackupManifest();
    assertCurrentReleaseBackup({ manifest, env });
  }
  return authorization;
};

export const buildRecipeNutritionUnitReport = (recipes) => {
  const invalidItems = [];
  let targetItemCount = 0;

  for (const recipe of recipes) {
    for (const item of recipe.nutrition?.additional || []) {
      if (item.unit !== "mg") continue;
      targetItemCount += 1;
      if (
        typeof item.value !== "number" ||
        !Number.isFinite(item.value) ||
        item.value < 0
      ) {
        invalidItems.push({
          recipeId: String(recipe._id),
          slug: String(recipe.slug || ""),
          label: String(item.label || ""),
        });
      }
    }
  }

  return {
    mode: "preflight",
    ready: invalidItems.length === 0,
    targetDocumentCount: recipes.length,
    targetItemCount,
    invalidItemCount: invalidItems.length,
    invalidItems,
  };
};

export const inspectRecipeNutritionUnits = async ({
  RecipeModel = Recipe,
} = {}) => {
  const recipes = await RecipeModel.find(TARGET_FILTER)
    .select("slug nutrition.additional")
    .lean();
  return buildRecipeNutritionUnitReport(recipes);
};

const assertReportReady = (report) => {
  if (!report?.ready || report.invalidItemCount !== 0) {
    throw migrationError(
      "RECIPE_NUTRITION_UNIT_PREFLIGHT_BLOCKED",
      "Recipe nutrition unit migration blocked by preflight findings",
    );
  }
};

const assertReportCurrent = (expected, current) => {
  if (
    current.targetDocumentCount !== expected.targetDocumentCount ||
    current.targetItemCount !== expected.targetItemCount ||
    !current.ready
  ) {
    throw migrationError(
      "RECIPE_NUTRITION_UNIT_PREFLIGHT_STALE",
      "Recipe nutrition unit data changed after preflight",
    );
  }
};

const updatePipeline = [
  {
    $set: {
      "nutrition.additional": {
        $map: {
          input: { $ifNull: ["$nutrition.additional", []] },
          as: "item",
          in: {
            $cond: [
              { $eq: ["$$item.unit", "mg"] },
              {
                $mergeObjects: [
                  "$$item",
                  {
                    unit: "g",
                    value: {
                      $divide: ["$$item.value", MILLIGRAMS_PER_GRAM],
                    },
                  },
                ],
              },
              "$$item",
            ],
          },
        },
      },
    },
  },
];

export const applyRecipeNutritionUnitMigration = async ({
  report,
  RecipeModel = Recipe,
} = {}) => {
  assertReportReady(report);
  const current = await inspectRecipeNutritionUnits({ RecipeModel });
  assertReportCurrent(report, current);

  const result = await RecipeModel.collection.updateMany(
    TARGET_FILTER,
    updatePipeline,
  );
  const verification = await inspectRecipeNutritionUnits({ RecipeModel });
  if (verification.targetDocumentCount !== 0) {
    throw migrationError(
      "RECIPE_NUTRITION_UNIT_VERIFICATION_FAILED",
      "Recipe nutrition unit migration verification failed",
    );
  }

  return {
    matchedDocuments: result.matchedCount,
    modifiedDocuments: result.modifiedCount,
    verification,
  };
};

const main = async () => {
  const args = new Set(process.argv.slice(2));
  const apply = args.has("--apply");
  const authorization = await authorizeRecipeNutritionUnitTarget({
    args,
    apply,
  });

  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
  try {
    assertConnectedMigrationTarget(mongoose.connection, authorization);
    const report = await inspectRecipeNutritionUnits();
    const result = apply
      ? await applyRecipeNutritionUnitMigration({ report })
      : null;
    console.log(
      JSON.stringify(
        {
          mode: apply ? "apply" : "preflight",
          success: report.ready,
          report,
          result,
        },
        null,
        2,
      ),
    );
    assertReportReady(report);
  } finally {
    await mongoose.disconnect();
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
