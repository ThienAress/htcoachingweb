import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import "../config/env.js";
import connectDB from "../config/db.js";
import {
  assertConnectedMigrationTarget,
  assertMigrationEnvironment,
} from "../config/migrationSafety.js";
import CoachingComment from "../models/CoachingComment.js";
import CoachingCommentRevision from "../models/CoachingCommentRevision.js";
import InAppNotification from "../models/InAppNotification.js";
import NotificationPreference from "../models/NotificationPreference.js";

const REQUIRED = {
  CoachingComment: [
    "coaching_comment_target_thread",
    "coaching_comment_client_history",
    "coaching_comment_retention_candidates",
  ],
  CoachingCommentRevision: [
    "uniq_coaching_comment_revision",
    "uniq_coaching_comment_request",
    "coaching_comment_revision_client_history",
  ],
  InAppNotification: [
    "uniq_in_app_notification_delivery",
    "in_app_notification_inbox",
    "in_app_notification_history",
    "in_app_notification_retention_candidates",
  ],
  NotificationPreference: [
    "uniq_notification_preference_recipient",
  ],
};

const missing = async (name, model) => {
  const indexes = await model.collection.indexes();
  const names = new Set(indexes.map((index) => index.name));
  return REQUIRED[name]
    .filter((index) => !names.has(index))
    .map((index) => name + "." + index);
};

export const verifyReleaseGCommentMigration = async () => {
  const missingIndexes = (
    await Promise.all([
      missing("CoachingComment", CoachingComment),
      missing("CoachingCommentRevision", CoachingCommentRevision),
      missing("InAppNotification", InAppNotification),
      missing("NotificationPreference", NotificationPreference),
    ])
  ).flat();
  return { issues: { missingIndexes }, totalIssues: missingIndexes.length };
};

export const runReleaseGCommentMigration = async () => {
  const created = await Promise.all([
    CoachingComment.createIndexes(),
    CoachingCommentRevision.createIndexes(),
    InAppNotification.createIndexes(),
    NotificationPreference.createIndexes(),
  ]);
  return {
    createdIndexes: created.flatMap((items) => items || []).length,
    documentsModified: 0,
    verification: await verifyReleaseGCommentMigration(),
  };
};

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  const authorization = assertMigrationEnvironment({
    confirmationVariable: "CONFIRM_TODAY_DASHBOARD_RELEASE_G_MIGRATION",
  });
  await connectDB();
  try {
    assertConnectedMigrationTarget(mongoose.connection, authorization);
    const result = await runReleaseGCommentMigration();
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    if (result.verification.totalIssues > 0) process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
