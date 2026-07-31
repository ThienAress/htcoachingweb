import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import "../config/env.js";
import connectDB from "../config/db.js";
import {
  assertConnectedMigrationTarget,
  assertMigrationEnvironment,
} from "../config/migrationSafety.js";
import SavedMealPlan from "../models/SavedMealPlan.js";

const REQUIRED_INDEXES = [
  "uniq_saved_meal_plan_version",
  "uniq_saved_meal_plan_request",
  "uniq_saved_meal_plan_latest",
  "uniq_saved_meal_plan_archive_request",
  "saved_meal_plan_owner_list",
  "saved_meal_plan_retention_candidates",
];

export const verifyReleaseCSavedMealPlanMigration = async () => {
  const indexes = await SavedMealPlan.collection.indexes();
  const names = new Set(indexes.map((index) => index.name));
  const missingIndexes = REQUIRED_INDEXES.filter(
    (name) => !names.has(name),
  );
  return {
    issues: { missingIndexes },
    totalIssues: missingIndexes.length,
  };
};

export const runReleaseCSavedMealPlanMigration = async () => {
  const createdIndexes = await Promise.all([
    SavedMealPlan.createIndexes(),
  ]);
  return {
    createdIndexes: createdIndexes.flatMap((indexes) => indexes || [])
      .length,
    documentsModified: 0,
    verification: await verifyReleaseCSavedMealPlanMigration(),
  };
};

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  const authorization = assertMigrationEnvironment({
    confirmationVariable: "CONFIRM_TODAY_DASHBOARD_RELEASE_C_MIGRATION",
  });
  await connectDB();
  try {
    assertConnectedMigrationTarget(mongoose.connection, authorization);
    const result = await runReleaseCSavedMealPlanMigration();
    process.stdout.write(
      JSON.stringify(result, null, 2) + String.fromCharCode(10),
    );
    if (result.verification.totalIssues > 0) process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
