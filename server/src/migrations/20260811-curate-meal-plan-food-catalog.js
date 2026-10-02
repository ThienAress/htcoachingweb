import crypto from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import mongoose from "mongoose";
import { BSON } from "mongodb";

import {
  MEAL_PLAN_FOOD_CURATION_GROUPS,
  MEAL_PLAN_FOOD_CURATION_LABELS,
  PROTECTED_VARIANT_LABELS,
} from "../constants/mealPlanFoodCatalogCuration.js";
import {
  assertConnectedMigrationTarget,
  assertMigrationEnvironment,
  getMongoDatabaseName,
} from "../config/migrationSafety.js";
import Food from "../models/Food.js";
import FoodPriceObservation from "../models/FoodPriceObservation.js";
import SavedMealPlan from "../models/SavedMealPlan.js";

export const EXPECTED_FOOD_TOTAL_BEFORE_CURATION = 548;
export const CURATION_CONFIRMATION_VARIABLE =
  "CONFIRM_MEAL_PLAN_FOOD_CATALOG_CURATION";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

export const validateCurationManifest = () => {
  const uniqueLabels = new Set(MEAL_PLAN_FOOD_CURATION_LABELS);
  const duplicates = MEAL_PLAN_FOOD_CURATION_LABELS.filter(
    (label, index) => MEAL_PLAN_FOOD_CURATION_LABELS.indexOf(label) !== index,
  );
  const protectedOverlap = PROTECTED_VARIANT_LABELS.filter((label) =>
    uniqueLabels.has(label),
  );
  if (duplicates.length > 0 || protectedOverlap.length > 0) {
    const error = new Error("Food curation manifest is invalid");
    error.code = "FOOD_CURATION_MANIFEST_INVALID";
    error.findings = { duplicates: [...new Set(duplicates)], protectedOverlap };
    throw error;
  }
  return { labelCount: uniqueLabels.size };
};

const safeFood = (food) => ({
  _id: String(food._id),
  label: food.label,
  protein: food.protein,
  carb: food.carb,
  fat: food.fat,
  calories: food.calories,
});

export const buildCurationReport = ({
  allFoods,
  priceObservationCount = 0,
  savedMealPlanCount = 0,
}) => {
  validateCurationManifest();
  const foodByLabel = new Map(allFoods.map((food) => [food.label, food]));
  const matchedFoods = MEAL_PLAN_FOOD_CURATION_LABELS.map((label) =>
    foodByLabel.get(label),
  ).filter(Boolean);
  const missingLabels = MEAL_PLAN_FOOD_CURATION_LABELS.filter(
    (label) => !foodByLabel.has(label),
  );
  const protectedVariants = PROTECTED_VARIANT_LABELS.map((label) =>
    foodByLabel.get(label),
  ).filter(Boolean);
  return {
    mode: "preflight",
    expectedTotalBefore: EXPECTED_FOOD_TOTAL_BEFORE_CURATION,
    totalFoods: allFoods.length,
    targetLabelCount: MEAL_PLAN_FOOD_CURATION_LABELS.length,
    matchedCount: matchedFoods.length,
    missingLabels,
    priceObservationCount,
    savedMealPlanCount,
    expectedTotalAfter:
      EXPECTED_FOOD_TOTAL_BEFORE_CURATION - MEAL_PLAN_FOOD_CURATION_LABELS.length,
    matchedFoods: matchedFoods.map(safeFood),
    protectedVariants: protectedVariants.map(safeFood),
  };
};

const assertReportReadyForApply = (report) => {
  const findings = [];
  if (report.totalFoods !== EXPECTED_FOOD_TOTAL_BEFORE_CURATION) {
    findings.push("FOOD_CURATION_TOTAL_DRIFT");
  }
  if (report.missingLabels.length > 0) {
    findings.push("FOOD_CURATION_LABELS_MISSING");
  }
  if (report.matchedCount !== report.targetLabelCount) {
    findings.push("FOOD_CURATION_MATCH_COUNT_MISMATCH");
  }
  if (report.protectedVariants.length !== PROTECTED_VARIANT_LABELS.length) {
    findings.push("FOOD_CURATION_PROTECTED_VARIANT_MISSING");
  }
  if (findings.length > 0) {
    const error = new Error(`Food curation blocked: ${findings.join(", ")}`);
    error.code = "FOOD_CURATION_PREFLIGHT_BLOCKED";
    error.findings = findings;
    throw error;
  }
};

export const inspectFoodCatalogCuration = async ({
  FoodModel = Food,
  PriceModel = FoodPriceObservation,
  SavedPlanModel = SavedMealPlan,
} = {}) => {
  const allFoods = await FoodModel.find({})
    .select("label protein carb fat calories")
    .sort({ label: 1 })
    .lean();
  const targetIds = allFoods
    .filter((food) => MEAL_PLAN_FOOD_CURATION_LABELS.includes(food.label))
    .map((food) => food._id);
  const [priceObservationCount, savedMealPlanCount] = await Promise.all([
    PriceModel.countDocuments({ foodId: { $in: targetIds } }),
    SavedPlanModel.countDocuments({
      "meals.foods.foodId": { $in: targetIds },
    }),
  ]);
  return buildCurationReport({
    allFoods,
    priceObservationCount,
    savedMealPlanCount,
  });
};

const writeCurationBackup = async ({ report, FoodModel, PriceModel, session }) => {
  const ids = report.matchedFoods.map(({ _id }) => new mongoose.Types.ObjectId(_id));
  const [foods, priceObservations] = await Promise.all([
    FoodModel.collection.find({ _id: { $in: ids } }, { session }).toArray(),
    PriceModel.collection.find({ foodId: { $in: ids } }, { session }).toArray(),
  ]);
  const backup = {
    kind: "meal-plan-food-catalog-curation",
    createdAt: new Date(),
    manifestGroups: MEAL_PLAN_FOOD_CURATION_GROUPS,
    expectedTotalBefore: report.expectedTotalBefore,
    expectedTotalAfter: report.expectedTotalAfter,
    foods,
    priceObservations,
  };
  const serialized = BSON.EJSON.stringify(backup, { relaxed: false });
  const checksumSha256 = crypto.createHash("sha256").update(serialized).digest("hex");
  const backupDir = process.env.MEAL_PLAN_CATALOG_BACKUP_DIR
    ? path.resolve(process.env.MEAL_PLAN_CATALOG_BACKUP_DIR)
    : path.join(repoRoot, ".private");
  const stamp = new Date().toISOString().replaceAll(":", "-");
  const backupPath = path.join(
    backupDir,
    `meal-plan-food-catalog-${stamp}.ejson`,
  );
  await mkdir(backupDir, { recursive: true });
  await writeFile(backupPath, serialized, { encoding: "utf8", flag: "wx" });
  return { backupPath, checksumSha256, foodCount: foods.length, priceCount: priceObservations.length };
};

export const applyFoodCatalogCuration = async ({
  report,
  FoodModel = Food,
  PriceModel = FoodPriceObservation,
  connection = mongoose.connection,
  backupWriter = writeCurationBackup,
} = {}) => {
  assertReportReadyForApply(report);
  const ids = report.matchedFoods.map(({ _id }) => new mongoose.Types.ObjectId(_id));
  const session = await connection.startSession();
  let deletion;
  let backup;
  let transactionStarted = false;
  try {
    session.startTransaction();
    transactionStarted = true;
    const foodCount = await FoodModel.countDocuments({ _id: { $in: ids } }).session(
      session,
    );
    if (foodCount !== report.matchedCount) {
      throw new Error("Food curation apply drift detected");
    }
    backup = await backupWriter({ report, FoodModel, PriceModel, session });
    if (backup.foodCount !== report.matchedCount) {
      throw new Error("Food curation backup count mismatch");
    }
    const priceResult = await PriceModel.deleteMany(
      { foodId: { $in: ids } },
      { session },
    );
    const foodResult = await FoodModel.deleteMany(
      { _id: { $in: ids } },
      { session },
    );
    if (
      foodResult.deletedCount !== report.matchedCount ||
      priceResult.deletedCount !== backup.priceCount
    ) {
      throw new Error("Food curation deleted count mismatch");
    }
    deletion = {
      deletedFoods: foodResult.deletedCount,
      deletedPriceObservations: priceResult.deletedCount,
    };
    await session.commitTransaction();
  } catch (error) {
    if (transactionStarted) {
      try {
        await session.abortTransaction();
      } catch {
        // Preserve the original migration failure.
      }
    }
    throw error;
  } finally {
    await session.endSession();
  }
  return { ...deletion, backup };
};

const assertReadOnlyProductionTarget = () => {
  const targetDatabase = String(process.env.MIGRATION_TARGET_DATABASE || "").trim();
  const uriDatabase = getMongoDatabaseName(process.env.MONGO_URI);
  if (
    process.env.APP_ENV !== "production" ||
    process.env.NODE_ENV !== "production" ||
    !targetDatabase ||
    !uriDatabase ||
    targetDatabase !== uriDatabase ||
    targetDatabase === "htcoaching_staging"
  ) {
    throw new Error("Production target guard failed");
  }
  return { valid: true, targetDatabase };
};

const main = async () => {
  const args = new Set(process.argv.slice(2));
  const apply = args.has("--apply");
  if (!args.has("--target=production")) {
    throw new Error("Explicit --target=production is required");
  }
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required");
  if (apply && !args.has("--confirm-production-food-catalog-delete")) {
    throw new Error("Apply requires explicit delete confirmation flag");
  }
  const authorization = apply
    ? assertMigrationEnvironment({
        confirmationVariable: CURATION_CONFIRMATION_VARIABLE,
      })
    : assertReadOnlyProductionTarget();

  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
  try {
    assertConnectedMigrationTarget(mongoose.connection, authorization);
    const report = await inspectFoodCatalogCuration();
    const result = apply ? await applyFoodCatalogCuration({ report }) : null;
    process.stdout.write(
      `${JSON.stringify(
        {
          ...report,
          matchedFoods: report.matchedFoods.map(({ _id, label }) => ({ _id, label })),
          mode: apply ? "apply" : "preflight",
          success: true,
          result,
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    await mongoose.disconnect();
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
