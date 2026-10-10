import mongoose from "mongoose";

import Wallet from "../models/Wallet.js";
import WalletTransaction from "../models/WalletTransaction.js";
import DepositRequest from "../models/DepositRequest.js";
import IncomingBankTransaction from "../models/IncomingBankTransaction.js";
import TrainerSubscription from "../models/TrainerSubscription.js";
import FitnessSubscription from "../models/FitnessSubscription.js";
import { incrementMetric } from "../observability/metrics.js";
import {
  resolveDepositCreditSnapshot,
  resolveIncomingCreditedAmount,
} from "./depositPolicy.service.js";

const asId = (value) => String(value || "");

export const subscriptionRequiresPurchaseLedger = (subscription = {}) =>
  Number.isSafeInteger(subscription.amount) &&
  subscription.amount > 0 &&
  !["admin_grant", "pending_grant"].includes(subscription.source);

const boundedInteger = (value, fallback, maximum) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
};

const takeBoundedScope = (rows, limit) => ({
  rows: rows.slice(0, limit),
  truncated: rows.length > limit,
});

const queryWithSession = (query, session) => query.session(session);

const reconcileWalletsInSnapshot = async ({
  walletLimit,
  issueLimit,
  allowLegacyTrainerReference,
  session,
  startedAt,
}) => {
  const safeWalletLimit = boundedInteger(walletLimit, 5000, 100000);
  const safeIssueLimit = boundedInteger(issueLimit, 1000, 10000);
  const issues = [];
  let totalIssues = 0;
  const truncatedScopes = [];

  const recordIssue = (code, details = {}) => {
    totalIssues += 1;
    if (issues.length < safeIssueLimit) issues.push({ code, ...details });
  };

  const recordTruncatedScope = (scope, limit) => {
    truncatedScopes.push(scope);
    recordIssue("RECONCILIATION_SCOPE_TRUNCATED", { scope, limit });
  };

  const walletScope = takeBoundedScope(await queryWithSession(Wallet.find({})
    .sort({ _id: 1 })
    .limit(safeWalletLimit + 1)
    .lean(), session), safeWalletLimit);
  const wallets = walletScope.rows;
  if (walletScope.truncated) recordTruncatedScope("wallets", safeWalletLimit);
  const walletIds = wallets.map((wallet) => wallet._id);
  const walletById = new Map(
    wallets.map((wallet) => [asId(wallet._id), wallet]),
  );
  const sums = new Map();
  const latestBalances = new Map();

  const transactionScope = walletIds.length
    ? takeBoundedScope(await queryWithSession(WalletTransaction.find({
        walletId: { $in: walletIds },
        status: "success",
      })
        .sort({ walletId: 1, createdAt: 1, _id: 1 })
        .limit(safeWalletLimit + 1)
        .lean(), session), safeWalletLimit)
    : { rows: [], truncated: false };
  const transactions = transactionScope.rows;
  if (transactionScope.truncated) {
    recordTruncatedScope("walletTransactions", safeWalletLimit);
  }

  for (const transaction of transactions) {
    const walletId = asId(transaction.walletId);
    const wallet = walletById.get(walletId);
    if (!wallet) {
      recordIssue("LEDGER_WALLET_MISSING", {
        transactionId: asId(transaction._id),
        walletId,
      });
      continue;
    }
    if (asId(transaction.userId) !== asId(wallet.userId)) {
      recordIssue("LEDGER_USER_MISMATCH", {
        transactionId: asId(transaction._id),
        walletId,
      });
    }
    if (
      !Number.isSafeInteger(transaction.amount) ||
      !Number.isSafeInteger(transaction.balanceBefore) ||
      !Number.isSafeInteger(transaction.balanceAfter) ||
      transaction.balanceAfter !==
        transaction.balanceBefore + transaction.amount
    ) {
      recordIssue("LEDGER_SNAPSHOT_INVALID", {
        transactionId: asId(transaction._id),
        walletId,
      });
    }

    const previousBalance = latestBalances.get(walletId);
    if (
      previousBalance !== undefined &&
      transaction.balanceBefore !== previousBalance
    ) {
      recordIssue("LEDGER_CHAIN_BROKEN", {
        transactionId: asId(transaction._id),
        walletId,
        expectedBalanceBefore: previousBalance,
        actualBalanceBefore: transaction.balanceBefore,
      });
    }
    if (previousBalance === undefined && transaction.balanceBefore !== 0) {
      recordIssue("LEDGER_CHAIN_NONZERO_START", {
        transactionId: asId(transaction._id),
        walletId,
        actualBalanceBefore: transaction.balanceBefore,
      });
    }

    sums.set(walletId, (sums.get(walletId) || 0) + transaction.amount);
    latestBalances.set(walletId, transaction.balanceAfter);
  }

  for (const wallet of wallets) {
    const walletId = asId(wallet._id);
    const ledgerBalance = sums.get(walletId) || 0;
    const latestBalance = latestBalances.get(walletId) ?? 0;
    if (
      !Number.isSafeInteger(wallet.balance) ||
      wallet.balance < 0 ||
      wallet.balance !== ledgerBalance ||
      wallet.balance !== latestBalance
    ) {
      recordIssue("WALLET_BALANCE_MISMATCH", {
        walletId,
        walletBalance: wallet.balance,
        ledgerBalance,
        latestBalance,
      });
    }
  }

  const orphanWalletScope = takeBoundedScope(await WalletTransaction.aggregate([
    { $match: { status: "success" } },
    { $sort: { _id: 1 } },
    {
      $lookup: {
        from: Wallet.collection.name,
        localField: "walletId",
        foreignField: "_id",
        as: "wallet",
      },
    },
    { $match: { wallet: { $size: 0 } } },
    { $project: { _id: 1, walletId: 1 } },
    { $limit: safeIssueLimit + 1 },
  ]).session(session), safeIssueLimit);
  const orphanTransactions = orphanWalletScope.rows;
  if (orphanWalletScope.truncated) {
    recordTruncatedScope("orphanWalletTransactions", safeIssueLimit);
  }
  for (const transaction of orphanTransactions) {
    recordIssue("LEDGER_WALLET_MISSING", {
      transactionId: asId(transaction._id),
      walletId: asId(transaction.walletId),
    });
  }

  const depositScope = takeBoundedScope(await queryWithSession(DepositRequest.find({
    status: { $in: ["success", "reversed"] },
  })
    .select(
      "_id amount bonusRate bonusAmount creditedAmount bonusTierKey policyVersion status",
    )
    .sort({ _id: 1 })
    .limit(safeWalletLimit + 1)
    .lean(), session), safeWalletLimit);
  const deposits = depositScope.rows;
  if (depositScope.truncated) recordTruncatedScope("deposits", safeWalletLimit);
  const depositIds = deposits.map((deposit) => deposit._id);
  const depositEntryScope = deposits.length
    ? takeBoundedScope(await queryWithSession(WalletTransaction.find({
        referenceType: "deposit_request",
        referenceId: { $in: depositIds },
      }).sort({ _id: 1 }).limit(safeWalletLimit + 1).lean(), session), safeWalletLimit)
    : { rows: [], truncated: false };
  const depositEntries = depositEntryScope.rows;
  if (depositEntryScope.truncated) {
    recordTruncatedScope("depositLedgerEntries", safeWalletLimit);
  }
  const incomingTransactionScope = deposits.length
    ? takeBoundedScope(await queryWithSession(IncomingBankTransaction.find({
        depositRequestId: { $in: depositIds },
        status: { $in: ["settled", "reversed"] },
      })
        .select("_id depositRequestId amount creditedAmount status")
        .sort({ _id: 1 })
        .limit(safeWalletLimit + 1)
        .lean(), session), safeWalletLimit)
    : { rows: [], truncated: false };
  const incomingTransactions = incomingTransactionScope.rows;
  if (incomingTransactionScope.truncated) {
    recordTruncatedScope("incomingBankTransactions", safeWalletLimit);
  }
  const incomingEntryScope = incomingTransactions.length
    ? takeBoundedScope(await queryWithSession(WalletTransaction.find({
        referenceType: "incoming_bank_transaction",
        referenceId: {
          $in: incomingTransactions.map((incoming) => incoming._id),
        },
      }).sort({ _id: 1 }).limit(safeWalletLimit + 1).lean(), session), safeWalletLimit)
    : { rows: [], truncated: false };
  const incomingEntries = incomingEntryScope.rows;
  if (incomingEntryScope.truncated) {
    recordTruncatedScope("incomingLedgerEntries", safeWalletLimit);
  }
  const entriesByDeposit = new Map();
  for (const entry of depositEntries) {
    const key = asId(entry.referenceId);
    const values = entriesByDeposit.get(key) || [];
    values.push(entry);
    entriesByDeposit.set(key, values);
  }

  const entriesByIncoming = new Map();
  for (const entry of incomingEntries) {
    const key = asId(entry.referenceId);
    const values = entriesByIncoming.get(key) || [];
    values.push(entry);
    entriesByIncoming.set(key, values);
  }
  const incomingByDeposit = new Map();
  for (const incoming of incomingTransactions) {
    const key = asId(incoming.depositRequestId);
    const values = incomingByDeposit.get(key) || [];
    values.push(incoming);
    incomingByDeposit.set(key, values);

    const entries = entriesByIncoming.get(asId(incoming._id)) || [];
    let creditedAmount;
    try {
      creditedAmount = resolveIncomingCreditedAmount(incoming);
    } catch {
      recordIssue("INCOMING_CREDIT_SNAPSHOT_INVALID", {
        incomingTransactionId: asId(incoming._id),
      });
      continue;
    }
    const originals = entries.filter(
      (entry) =>
        entry.type === "deposit" &&
        !entry.reversalOf &&
        entry.amount === creditedAmount,
    );
    if (originals.length !== 1) {
      recordIssue("INCOMING_LEDGER_CARDINALITY", {
        incomingTransactionId: asId(incoming._id),
        originalEntries: originals.length,
      });
      continue;
    }
    const reversals = entries.filter(
      (entry) => asId(entry.reversalOf) === asId(originals[0]._id),
    );
    if (
      incoming.status === "reversed" &&
      (reversals.length !== 1 ||
        reversals[0].type !== "reversal" ||
        reversals[0].amount !== -creditedAmount)
    ) {
      recordIssue("INCOMING_REVERSAL_LEDGER_MISMATCH", {
        incomingTransactionId: asId(incoming._id),
        reversalEntries: reversals.length,
      });
    }
    if (incoming.status === "settled" && reversals.length > 0) {
      recordIssue("INCOMING_STATUS_REVERSAL_MISMATCH", {
        incomingTransactionId: asId(incoming._id),
        reversalEntries: reversals.length,
      });
    }
  }

  for (const deposit of deposits) {
    const entries = entriesByDeposit.get(asId(deposit._id)) || [];
    const linkedIncoming = incomingByDeposit.get(asId(deposit._id)) || [];
    let creditedAmount;
    try {
      creditedAmount = resolveDepositCreditSnapshot(deposit).creditedAmount;
    } catch {
      recordIssue("DEPOSIT_CREDIT_SNAPSHOT_INVALID", {
        depositId: asId(deposit._id),
      });
      continue;
    }
    const originals = entries.filter(
      (entry) =>
        entry.type === "deposit" &&
        !entry.reversalOf &&
        entry.amount === creditedAmount,
    );
    if (entries.length > 0 && originals.length !== 1) {
      recordIssue("DEPOSIT_LEDGER_CARDINALITY", {
        depositId: asId(deposit._id),
        originalEntries: originals.length,
      });
      continue;
    }
    if (entries.length === 0 && linkedIncoming.length === 0) {
      recordIssue("DEPOSIT_LEDGER_CARDINALITY", {
        depositId: asId(deposit._id),
        originalEntries: 0,
      });
      continue;
    }
    const reversals = entries.filter(
      (entry) =>
        originals[0] && asId(entry.reversalOf) === asId(originals[0]._id),
    );
    if (
      entries.length > 0 &&
      deposit.status === "reversed" &&
      (reversals.length !== 1 ||
        reversals[0].type !== "reversal" ||
        reversals[0].amount !== -creditedAmount)
    ) {
      recordIssue("DEPOSIT_REVERSAL_LEDGER_MISMATCH", {
        depositId: asId(deposit._id),
        reversalEntries: reversals.length,
      });
    }
    const activeSettlementCount =
      (originals.length === 1 && reversals.length === 0 ? 1 : 0) +
      linkedIncoming.filter((incoming) => incoming.status === "settled").length;
    if (
      deposit.status === "success" &&
      activeSettlementCount === 0
    ) {
      recordIssue("DEPOSIT_STATUS_REVERSAL_MISMATCH", {
        depositId: asId(deposit._id),
        activeSettlementCount,
      });
    }
    if (deposit.status === "reversed" && activeSettlementCount > 0) {
      recordIssue("DEPOSIT_STATUS_REVERSAL_MISMATCH", {
        depositId: asId(deposit._id),
        activeSettlementCount,
      });
    }
  }

  const trainerSubscriptionScope = takeBoundedScope(await queryWithSession(TrainerSubscription.find({})
    .select("_id amount source purchaseRequestId")
    .sort({ _id: 1 })
    .limit(safeWalletLimit + 1)
    .lean(), session), safeWalletLimit);
  const subscriptions = trainerSubscriptionScope.rows;
  if (trainerSubscriptionScope.truncated) {
    recordTruncatedScope("trainerSubscriptions", safeWalletLimit);
  }
  const trainerEntryScope = subscriptions.length
    ? takeBoundedScope(await queryWithSession(WalletTransaction.find({
        referenceId: {
          $in: subscriptions.map((subscription) => subscription._id),
        },
        type: "purchase",
      }).sort({ _id: 1 }).limit(safeWalletLimit + 1).lean(), session), safeWalletLimit)
    : { rows: [], truncated: false };
  const subscriptionEntries = trainerEntryScope.rows;
  if (trainerEntryScope.truncated) {
    recordTruncatedScope("trainerSubscriptionLedgerEntries", safeWalletLimit);
  }
  const entriesBySubscription = new Map();
  for (const entry of subscriptionEntries) {
    const key = asId(entry.referenceId);
    const values = entriesBySubscription.get(key) || [];
    values.push(entry);
    entriesBySubscription.set(key, values);
  }

  for (const subscription of subscriptions) {
    if (!subscriptionRequiresPurchaseLedger(subscription)) continue;
    const entries = (
      entriesBySubscription.get(asId(subscription._id)) || []
    ).filter(
      (entry) =>
        entry.referenceType === "trainer_subscription" ||
        (allowLegacyTrainerReference && entry.referenceType === "order"),
    );
    const matching = entries.filter(
      (entry) => entry.amount === -subscription.amount,
    );
    if (matching.length !== 1) {
      recordIssue("SUBSCRIPTION_LEDGER_CARDINALITY", {
        subscriptionId: asId(subscription._id),
        matchingEntries: matching.length,
      });
    }
  }

  const fitnessSubscriptionScope = takeBoundedScope(
    await queryWithSession(
      FitnessSubscription.find({})
        .select("_id userId amount source purchaseRequestId")
        .sort({ _id: 1 })
        .limit(safeWalletLimit + 1)
        .lean(),
      session,
    ),
    safeWalletLimit,
  );
  const fitnessSubscriptions = fitnessSubscriptionScope.rows;
  if (fitnessSubscriptionScope.truncated) {
    recordTruncatedScope("fitnessSubscriptions", safeWalletLimit);
  }
  const fitnessEntryScope = fitnessSubscriptions.length
    ? takeBoundedScope(await queryWithSession(
        WalletTransaction.find({
          referenceType: "fitness_subscription",
          referenceId: {
            $in: fitnessSubscriptions.map((subscription) => subscription._id),
          },
          type: "purchase",
          status: "success",
        })
          .sort({ referenceId: 1, _id: 1 })
          .limit(safeWalletLimit + 1)
          .lean(),
        session,
      ), safeWalletLimit)
    : { rows: [], truncated: false };
  const fitnessEntries = fitnessEntryScope.rows;
  if (fitnessEntryScope.truncated) {
    recordTruncatedScope("fitnessSubscriptionLedgerEntries", safeWalletLimit);
  }
  const fitnessEntriesBySubscription = new Map();
  for (const entry of fitnessEntries) {
    const key = asId(entry.referenceId);
    const values = fitnessEntriesBySubscription.get(key) || [];
    values.push(entry);
    fitnessEntriesBySubscription.set(key, values);
  }
  let fitnessAdminGrantsExcluded = 0;
  for (const subscription of fitnessSubscriptions) {
    if (subscription.source === "admin_grant") {
      fitnessAdminGrantsExcluded += 1;
      continue;
    }
    const subscriptionId = asId(subscription._id);
    const entries = fitnessEntriesBySubscription.get(subscriptionId) || [];
    if (!Number.isSafeInteger(subscription.amount) || subscription.amount <= 0) {
      recordIssue("FITNESS_SUBSCRIPTION_AMOUNT_INVALID", { subscriptionId });
    }
    if (!String(subscription.purchaseRequestId || "").trim()) {
      recordIssue("FITNESS_SUBSCRIPTION_PURCHASE_REQUEST_MISSING", {
        subscriptionId,
      });
    }
    if (entries.length === 0) {
      recordIssue("FITNESS_SUBSCRIPTION_LEDGER_MISSING", { subscriptionId });
      continue;
    }
    if (entries.length !== 1) {
      recordIssue("FITNESS_SUBSCRIPTION_LEDGER_CARDINALITY", {
        subscriptionId,
        successfulEntries: entries.length,
      });
      continue;
    }
    const [entry] = entries;
    if (entry.amount !== -subscription.amount) {
      recordIssue("FITNESS_SUBSCRIPTION_LEDGER_AMOUNT_MISMATCH", {
        subscriptionId,
        transactionId: asId(entry._id),
      });
    }
    if (asId(entry.userId) !== asId(subscription.userId)) {
      recordIssue("FITNESS_SUBSCRIPTION_LEDGER_USER_MISMATCH", {
        subscriptionId,
        transactionId: asId(entry._id),
      });
    }
    const expectedIdempotencyKey = `fitness-plus:${asId(subscription.userId)}:${subscription.purchaseRequestId}`;
    if (entry.idempotencyKey !== expectedIdempotencyKey) {
      recordIssue("FITNESS_SUBSCRIPTION_LEDGER_IDEMPOTENCY_MISMATCH", {
        subscriptionId,
        transactionId: asId(entry._id),
      });
    }
  }

  const orphanFitnessScope = takeBoundedScope(
    await WalletTransaction.aggregate([
      {
        $match: {
          referenceType: "fitness_subscription",
          type: "purchase",
          status: "success",
        },
      },
      { $sort: { _id: 1 } },
      {
        $lookup: {
          from: FitnessSubscription.collection.name,
          localField: "referenceId",
          foreignField: "_id",
          as: "subscription",
        },
      },
      { $match: { subscription: { $size: 0 } } },
      { $project: { _id: 1, referenceId: 1 } },
      { $limit: safeWalletLimit + 1 },
    ]).session(session),
    safeWalletLimit,
  );
  if (orphanFitnessScope.truncated) {
    recordTruncatedScope("orphanFitnessLedgers", safeWalletLimit);
  }
  for (const entry of orphanFitnessScope.rows) {
    recordIssue("FITNESS_SUBSCRIPTION_LEDGER_ORPHAN", {
      transactionId: asId(entry._id),
      subscriptionId: asId(entry.referenceId),
    });
  }

  return {
    startedAt,
    generatedAt: new Date().toISOString(),
    checkedWallets: wallets.length,
    checkedTransactions: transactions.length,
    checkedDeposits: deposits.length,
    checkedSubscriptions: subscriptions.length,
    checkedTrainerSubscriptions: subscriptions.length,
    checkedFitnessSubscriptions: fitnessSubscriptions.length,
    coverageComplete: truncatedScopes.length === 0,
    consistency: {
      mode: "snapshot_transaction",
      readConcern: "snapshot",
      limits: {
        walletLimit: safeWalletLimit,
        issueLimit: safeIssueLimit,
      },
      truncatedScopes,
      fitnessAdminGrantsExcluded,
    },
    totalIssues,
    issuesTruncated: totalIssues > issues.length,
    issues,
  };
};

export const reconcileWallets = async ({
  walletLimit = 5000,
  issueLimit = 1000,
  allowLegacyTrainerReference = false,
  session: providedSession,
} = {}) => {
  const startedAt = new Date().toISOString();
  const run = (session) =>
    reconcileWalletsInSnapshot({
      walletLimit,
      issueLimit,
      allowLegacyTrainerReference,
      session,
      startedAt,
    });

  if (providedSession) {
    const readConcern = providedSession.transaction?.options?.readConcern;
    if (
      !providedSession.inTransaction?.() ||
      readConcern?.level !== "snapshot"
    ) {
      const error = new Error(
        "Wallet reconciliation requires an active snapshot transaction",
      );
      error.code = "RECONCILIATION_SNAPSHOT_REQUIRED";
      throw error;
    }
    const report = await run(providedSession);
    if (report.totalIssues > 0) {
      incrementMetric("financial.reconciliation_mismatches", report.totalIssues);
    }
    return report;
  }

  const session = await mongoose.startSession();
  try {
    let report;
    await session.withTransaction(
      async () => {
        report = await run(session);
      },
      {
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority", journal: true },
        readPreference: "primary",
      },
    );
    if (report.totalIssues > 0) {
      incrementMetric("financial.reconciliation_mismatches", report.totalIssues);
    }
    return report;
  } finally {
    await session.endSession();
  }
};
