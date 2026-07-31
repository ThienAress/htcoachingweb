import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import "../config/env.js";
import connectDB from "../config/db.js";
import {
  assertConnectedMigrationTarget,
  assertMigrationEnvironment,
} from "../config/migrationSafety.js";
import WeeklyCheckin from "../models/WeeklyCheckin.js";
import WeeklyCheckinRevision from "../models/WeeklyCheckinRevision.js";

const REQUIRED_CHECKIN_INDEXES = [
  "uniq_weekly_checkin_client_week",
  "weekly_checkin_trainer_history",
  "weekly_checkin_retention_candidates",
];
const REQUIRED_REVISION_INDEXES = [
  "uniq_weekly_checkin_revision",
  "uniq_weekly_checkin_request",
  "weekly_checkin_revision_client_history",
];

const missing = async (model, required) => {
  const indexes = await model.collection.indexes();
  const names = new Set(indexes.map((index) => index.name));
  return required.filter((name) => !names.has(name));
};

export const verifyReleaseFWeeklyCheckinMigration = async () => {
  const [missingCheckinIndexes, missingRevisionIndexes] = await Promise.all([
    missing(WeeklyCheckin, REQUIRED_CHECKIN_INDEXES),
    missing(WeeklyCheckinRevision, REQUIRED_REVISION_INDEXES),
  ]);
  const totalIssues =
    missingCheckinIndexes.length + missingRevisionIndexes.length;
  return {
    issues: { missingCheckinIndexes, missingRevisionIndexes },
    totalIssues,
  };
};

export const runReleaseFWeeklyCheckinMigration = async () => {
  const created = await Promise.all([
    WeeklyCheckin.createIndexes(),
    WeeklyCheckinRevision.createIndexes(),
  ]);
  return {
    createdIndexes: created.flatMap((indexes) => indexes || []).length,
    documentsModified: 0,
    verification: await verifyReleaseFWeeklyCheckinMigration(),
  };
};

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  const authorization = assertMigrationEnvironment({
    confirmationVariable: "CONFIRM_TODAY_DASHBOARD_RELEASE_F_MIGRATION",
  });
  await connectDB();
  try {
    assertConnectedMigrationTarget(mongoose.connection, authorization);
    const result = await runReleaseFWeeklyCheckinMigration();
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    if (result.verification.totalIssues > 0) process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
