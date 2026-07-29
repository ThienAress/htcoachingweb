import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import "../config/env.js";
import connectDB from "../config/db.js";
import {
  assertConnectedMigrationTarget,
  assertMigrationEnvironment,
} from "../config/migrationSafety.js";
import CoachingHabit from "../models/CoachingHabit.js";

const REQUIRED_INDEXES = [
  "uniq_coaching_habit_version",
  "uniq_coaching_habit_request",
  "uniq_coaching_habit_latest",
  "coaching_habit_client_list",
  "coaching_habit_retention_candidates",
];

export const verifyReleaseECoachingHabitMigration = async () => {
  const indexes = await CoachingHabit.collection.indexes();
  const names = new Set(indexes.map((index) => index.name));
  const missingIndexes = REQUIRED_INDEXES.filter((name) => !names.has(name));
  return { issues: { missingIndexes }, totalIssues: missingIndexes.length };
};

export const runReleaseECoachingHabitMigration = async () => {
  const created = await Promise.all([CoachingHabit.createIndexes()]);
  return {
    createdIndexes: created.flatMap((indexes) => indexes || []).length,
    documentsModified: 0,
    verification: await verifyReleaseECoachingHabitMigration(),
  };
};

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  const authorization = assertMigrationEnvironment({
    confirmationVariable: "CONFIRM_TODAY_DASHBOARD_RELEASE_E_MIGRATION",
  });
  await connectDB();
  try {
    assertConnectedMigrationTarget(mongoose.connection, authorization);
    const result = await runReleaseECoachingHabitMigration();
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    if (result.verification.totalIssues > 0) process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
