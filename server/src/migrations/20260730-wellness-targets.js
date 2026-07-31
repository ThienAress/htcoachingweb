import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import "../config/env.js";
import connectDB from "../config/db.js";
import {
  assertConnectedMigrationTarget,
  assertMigrationEnvironment,
} from "../config/migrationSafety.js";
import WellnessTarget from "../models/WellnessTarget.js";

const REQUIRED_INDEXES = [
  "uniq_wellness_target_version",
  "uniq_wellness_target_latest",
  "uniq_wellness_target_command",
  "wellness_target_client_history",
  "wellness_target_retention_candidates",
];

export const verifyWellnessTargetMigration = async () => {
  const indexes = await WellnessTarget.collection.indexes();
  const names = new Set(indexes.map((index) => index.name));
  const missingIndexes = REQUIRED_INDEXES.filter((name) => !names.has(name));
  return { issues: { missingIndexes }, totalIssues: missingIndexes.length };
};

export const runWellnessTargetMigration = async () => {
  const created = await WellnessTarget.createIndexes();
  return {
    createdIndexes: (created || []).length,
    documentsModified: 0,
    verification: await verifyWellnessTargetMigration(),
  };
};

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  const authorization = assertMigrationEnvironment({
    confirmationVariable: "CONFIRM_WELLNESS_TARGET_MIGRATION",
  });
  await connectDB();
  try {
    assertConnectedMigrationTarget(mongoose.connection, authorization);
    const result = await runWellnessTargetMigration();
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    if (result.verification.totalIssues > 0) process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
