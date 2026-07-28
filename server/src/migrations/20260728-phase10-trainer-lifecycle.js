import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import "../config/env.js";
import connectDB from "../config/db.js";
import {
  assertConnectedMigrationTarget,
  assertMigrationEnvironment,
} from "../config/migrationSafety.js";
import TrainerSubscription from "../models/TrainerSubscription.js";
import TrainerTrialClaim from "../models/TrainerTrialClaim.js";
import PendingTrainerGrant from "../models/PendingTrainerGrant.js";
import User from "../models/User.js";
import { resolveTrainerPlanCode } from "../services/trainerPlanCatalog.service.js";
import {
  calculateRetentionDeadlines,
  normalizeTrainerEmail,
} from "../services/trainerSubscriptionLifecycle.service.js";

export const verifyPhase10TrainerLifecycle = async () => {
  const [missingPlanCode, missingSource, missingNormalizedEmail] =
    await Promise.all([
      TrainerSubscription.countDocuments({
        $or: [{ planCode: null }, { planCode: { $exists: false } }],
      }),
      TrainerSubscription.countDocuments({
        $or: [{ source: null }, { source: { $exists: false } }],
      }),
      TrainerSubscription.countDocuments({
        $or: [
          { normalizedEmail: null },
          { normalizedEmail: "" },
          { normalizedEmail: { $exists: false } },
        ],
      }),
    ]);
  const issues = { missingPlanCode, missingSource, missingNormalizedEmail };
  return {
    issues,
    totalIssues: Object.values(issues).reduce(
      (sum, count) => sum + Number(count || 0),
      0,
    ),
  };
};

export const runPhase10TrainerLifecycleMigration = async () => {
  const subscriptions = await TrainerSubscription.find({
    $or: [
      { planCode: null },
      { planCode: { $exists: false } },
      { normalizedEmail: null },
      { normalizedEmail: { $exists: false } },
      { source: null },
      { source: { $exists: false } },
    ],
  }).lean();
  const userIds = [...new Set(subscriptions.map((item) => String(item.userId)))];
  const users = await User.find({ _id: { $in: userIds } })
    .select("_id email")
    .lean();
  const emailByUserId = new Map(
    users.map((user) => [String(user._id), normalizeTrainerEmail(user.email)]),
  );

  const operations = subscriptions
    .map((subscription) => {
      const planCode =
        subscription.planCode || resolveTrainerPlanCode(subscription.planTitle);
      const normalizedEmail =
        subscription.normalizedEmail ||
        emailByUserId.get(String(subscription.userId));
      if (!planCode || !normalizedEmail) return null;

      const fields = {
        planCode,
        normalizedEmail,
        source: subscription.source || "legacy",
      };
      if (
        ["expired", "cancelled"].includes(subscription.status) &&
        (!subscription.mediaRetentionExpiresAt ||
          !subscription.structuredRetentionExpiresAt)
      ) {
        Object.assign(
          fields,
          calculateRetentionDeadlines(
            subscription.cancelledAt || subscription.endDate,
          ),
        );
      }
      return {
        updateOne: {
          filter: { _id: subscription._id },
          update: { $set: fields },
        },
      };
    })
    .filter(Boolean);

  const migrated =
    operations.length > 0
      ? await TrainerSubscription.bulkWrite(operations)
      : { modifiedCount: 0 };
  await Promise.all([
    TrainerSubscription.createIndexes(),
    TrainerTrialClaim.createIndexes(),
    PendingTrainerGrant.createIndexes(),
  ]);
  return {
    migrated: migrated.modifiedCount,
    skipped: subscriptions.length - operations.length,
    verification: await verifyPhase10TrainerLifecycle(),
  };
};

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  const authorization = assertMigrationEnvironment({
    confirmationVariable: "CONFIRM_PHASE10_TRAINER_LIFECYCLE_MIGRATION",
  });
  await connectDB();
  try {
    assertConnectedMigrationTarget(mongoose.connection, authorization);
    const result = await runPhase10TrainerLifecycleMigration();
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.verification.totalIssues > 0) process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
