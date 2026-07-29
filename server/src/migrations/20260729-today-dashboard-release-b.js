import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import "../config/env.js";
import connectDB from "../config/db.js";
import {
  assertConnectedMigrationTarget,
  assertMigrationEnvironment,
} from "../config/migrationSafety.js";
import DailyJournal from "../models/DailyJournal.js";
import DailyJournalRevision from "../models/DailyJournalRevision.js";

const REQUIRED_INDEXES = {
  dailyjournals: [
    "uniq_daily_journal_client_date",
    "daily_journal_trainer_history",
    "daily_journal_retention_candidates",
  ],
  dailyjournalrevisions: [
    "uniq_daily_journal_revision",
    "uniq_daily_journal_request",
    "daily_journal_revision_client_history",
  ],
};

const indexNames = async (Model) => {
  const indexes = await Model.collection.indexes();
  return new Set(indexes.map((index) => index.name));
};

export const verifyReleaseBJournalMigration = async () => {
  const [journalIndexes, revisionIndexes] = await Promise.all([
    indexNames(DailyJournal),
    indexNames(DailyJournalRevision),
  ]);
  const missingJournalIndexes = REQUIRED_INDEXES.dailyjournals.filter(
    (name) => !journalIndexes.has(name),
  );
  const missingRevisionIndexes =
    REQUIRED_INDEXES.dailyjournalrevisions.filter(
      (name) => !revisionIndexes.has(name),
    );
  return {
    issues: { missingJournalIndexes, missingRevisionIndexes },
    totalIssues:
      missingJournalIndexes.length + missingRevisionIndexes.length,
  };
};

export const runReleaseBJournalMigration = async () => {
  const created = await Promise.all([
    DailyJournal.createIndexes(),
    DailyJournalRevision.createIndexes(),
  ]);
  return {
    createdIndexes: created.flat().length,
    documentsModified: 0,
    verification: await verifyReleaseBJournalMigration(),
  };
};

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  const authorization = assertMigrationEnvironment({
    confirmationVariable: "CONFIRM_TODAY_DASHBOARD_RELEASE_B_MIGRATION",
  });
  await connectDB();
  try {
    assertConnectedMigrationTarget(mongoose.connection, authorization);
    const result = await runReleaseBJournalMigration();
    process.stdout.write(
      JSON.stringify(result, null, 2) + String.fromCharCode(10),
    );
    if (result.verification.totalIssues > 0) process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
