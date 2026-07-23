import "../config/env.js";
import mongoose from "mongoose";
import {
  assertConnectedMigrationTarget,
  assertMigrationEnvironment,
} from "../config/migrationSafety.js";

import DepositRequest from "../models/DepositRequest.js";
import TrainerSubscription from "../models/TrainerSubscription.js";
import WalletTransaction from "../models/WalletTransaction.js";
import Contract from "../models/Contract.js";
import Order from "../models/Order.js";
import { reconcileWallets } from "../services/walletReconciliation.service.js";

const duplicateGroups = async (collection, pipeline) =>
  collection.aggregate([...pipeline, { $limit: 100 }]).toArray();

const assertEmpty = (values, invariant) => {
  if (values.length === 0) return;
  const error = new Error(
    "Phase 6 preflight failed: duplicate " + invariant,
  );
  error.details = values;
  throw error;
};

const assertFinancialPreflight = async () => {
  const openDeposits = await duplicateGroups(DepositRequest.collection, [
    { $match: { status: { $in: ["pending", "needs_review"] } } },
    {
      $group: {
        _id: "$userId",
        count: { $sum: 1 },
        recordIds: { $push: "$_id" },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ]);
  assertEmpty(openDeposits, "open deposits per user");

  const activeSubscriptions = await duplicateGroups(
    TrainerSubscription.collection,
    [
      { $match: { status: "active" } },
      {
        $group: {
          _id: "$userId",
          count: { $sum: 1 },
          recordIds: { $push: "$_id" },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ],
  );
  assertEmpty(activeSubscriptions, "active trainer subscriptions per user");

  const activeContracts = await duplicateGroups(Contract.collection, [
    {
      $match: {
        status: { $nin: ["cancelled", "expired"] },
      },
    },
    {
      $group: {
        _id: "$orderId",
        count: { $sum: 1 },
        recordIds: { $push: "$_id" },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ]);
  assertEmpty(activeContracts, "active contracts per order");

  const invalidOrders = await Order.collection
    .find({
      $or: [
        {
          status: {
            $nin: ["pending", "approved", "completed", "cancelled"],
          },
        },
        { sessions: { $lt: 0 } },
        { totalSessions: { $lt: 1 } },
        { $expr: { $gt: ["$sessions", "$totalSessions"] } },
      ],
    })
    .project({ _id: 1, status: 1, sessions: 1, totalSessions: 1 })
    .limit(100)
    .toArray();
  if (invalidOrders.length > 0) {
    const error = new Error(
      "Phase 6 preflight failed: invalid order state detected",
    );
    error.details = invalidOrders;
    throw error;
  }

  const reconciliation = await reconcileWallets({
    walletLimit: 100000,
    issueLimit: 1000,
    allowLegacyTrainerReference: true,
  });
  if (reconciliation.totalIssues > 0) {
    const error = new Error(
      "Phase 6 preflight failed: wallet reconciliation issues detected",
    );
    error.details = reconciliation;
    throw error;
  }
  return reconciliation;
};

const dropIndexIfPresent = async (collection, name) => {
  const indexes = await collection.indexes();
  if (indexes.some((index) => index.name === name)) {
    await collection.dropIndex(name);
    return true;
  }
  return false;
};

const migrateLegacySubscriptionReferences = async () => {
  const cursor = TrainerSubscription.collection.find(
    {},
    { projection: { _id: 1 } },
  );
  let batch = [];
  let modifiedCount = 0;

  const migrateBatch = async () => {
    if (batch.length === 0) return;
    const result = await WalletTransaction.collection.updateMany(
      {
        type: "purchase",
        referenceType: "order",
        referenceId: { $in: batch },
      },
      { $set: { referenceType: "trainer_subscription" } },
    );
    modifiedCount += result.modifiedCount;
    batch = [];
  };

  for await (const subscription of cursor) {
    batch.push(subscription._id);
    if (batch.length >= 500) await migrateBatch();
  }
  await migrateBatch();
  return modifiedCount;
};

export const runPhase6Migration = async () => {
  const preflight = await assertFinancialPreflight();

  const depositBackfill = await DepositRequest.collection.updateMany(
    {},
    [
      {
        $set: {
          isOpen: { $in: ["$status", ["pending", "needs_review"]] },
        },
      },
    ],
  );
  const subscriptionBackfill =
    await TrainerSubscription.collection.updateMany(
      {},
      [{ $set: { isActive: { $eq: ["$status", "active"] } } }],
    );
  const contractBackfill = await Contract.collection.updateMany(
    {},
    [
      {
        $set: {
          isActive: {
            $not: [{ $in: ["$status", ["cancelled", "expired"]] }],
          },
        },
      },
    ],
  );
  const migratedSubscriptionReferences =
    await migrateLegacySubscriptionReferences();

  await dropIndexIfPresent(
    DepositRequest.collection,
    "unique_pending_per_user",
  );
  await DepositRequest.collection.createIndex(
    { userId: 1 },
    {
      unique: true,
      partialFilterExpression: { isOpen: true },
      name: "unique_open_deposit_per_user",
    },
  );
  await TrainerSubscription.collection.createIndex(
    { userId: 1 },
    {
      unique: true,
      partialFilterExpression: { isActive: true },
      name: "uniq_active_trainer_subscription",
    },
  );
  await TrainerSubscription.collection.createIndex(
    { userId: 1, purchaseRequestId: 1 },
    {
      unique: true,
      partialFilterExpression: {
        purchaseRequestId: { $type: "string" },
      },
      name: "uniq_trainer_purchase_request",
    },
  );
  await WalletTransaction.collection.createIndex(
    { reversalOf: 1 },
    {
      unique: true,
      partialFilterExpression: { reversalOf: { $type: "objectId" } },
      name: "uniq_wallet_reversal",
    },
  );

  const reconciliation = await reconcileWallets({
    walletLimit: 100000,
    issueLimit: 1000,
  });
  if (reconciliation.totalIssues > 0) {
    const error = new Error(
      "Phase 6 post-migration reconciliation failed",
    );
    error.details = reconciliation;
    throw error;
  }

  return {
    preflight,
    depositBackfilled: depositBackfill.modifiedCount,
    subscriptionBackfilled: subscriptionBackfill.modifiedCount,
    contractBackfilled: contractBackfill.modifiedCount,
    migratedSubscriptionReferences,
    reconciliation,
  };
};

const runFromCli = async () => {
  const authorization = assertMigrationEnvironment({
    confirmationVariable: "CONFIRM_PHASE6_FINANCIAL_MIGRATION",
  });

  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
  try {
    assertConnectedMigrationTarget(mongoose.connection, authorization);
    const report = await runPhase6Migration();
    console.log(JSON.stringify(report, null, 2));
    console.log("Phase 6 financial integrity migration completed");
  } finally {
    await mongoose.disconnect();
  }
};

if (
  process.argv[1]?.endsWith(
    "20260719-phase6-financial-integrity.js",
  )
) {
  runFromCli().catch((error) => {
    console.error(error.message);
    if (error.details) {
      console.error(JSON.stringify(error.details, null, 2));
    }
    process.exitCode = 1;
  });
}
