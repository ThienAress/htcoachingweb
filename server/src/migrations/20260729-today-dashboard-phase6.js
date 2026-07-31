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
import TrainingSchedule from "../models/TrainingSchedule.js";
import WorkoutPlan from "../models/WorkoutPlan.js";

const REQUIRED = {
  TrainingSchedule: ["training_schedule_client_day_range"],
  WorkoutPlan: [
    "workout_plan_client_status_range",
    "workout_plan_legacy_client_status_range",
  ],
  CoachingHabit: ["coaching_habit_client_progress_range"],
};

const missing = async (name, Model) => {
  const indexes = await Model.collection.indexes();
  const names = new Set(indexes.map((index) => index.name));
  return REQUIRED[name]
    .filter((index) => !names.has(index))
    .map((index) => name + "." + index);
};

export const verifyTodayDashboardPhase6Migration = async () => {
  const missingIndexes = (
    await Promise.all([
      missing("TrainingSchedule", TrainingSchedule),
      missing("WorkoutPlan", WorkoutPlan),
      missing("CoachingHabit", CoachingHabit),
    ])
  ).flat();
  return { issues: { missingIndexes }, totalIssues: missingIndexes.length };
};

export const runTodayDashboardPhase6Migration = async () => {
  const created = await Promise.all([
    TrainingSchedule.createIndexes(),
    WorkoutPlan.createIndexes(),
    CoachingHabit.createIndexes(),
  ]);
  return {
    createdIndexes: created.flatMap((items) => items || []).length,
    documentsModified: 0,
    verification: await verifyTodayDashboardPhase6Migration(),
  };
};

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  const authorization = assertMigrationEnvironment({
    confirmationVariable: "CONFIRM_TODAY_DASHBOARD_PHASE6_MIGRATION",
  });
  await connectDB();
  try {
    assertConnectedMigrationTarget(mongoose.connection, authorization);
    const result = await runTodayDashboardPhase6Migration();
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    if (result.verification.totalIssues > 0) process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
