import Wallet from "../models/Wallet.js";
import WalletTransaction from "../models/WalletTransaction.js";
import DepositRequest from "../models/DepositRequest.js";
import TrainerSubscription from "../models/TrainerSubscription.js";
import { incrementMetric } from "../observability/metrics.js";

const asId = (value) => String(value || "");

const boundedInteger = (value, fallback, maximum) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
};

export const reconcileWallets = async ({
  walletLimit = 5000,
  issueLimit = 1000,
  allowLegacyTrainerReference = false,
} = {}) => {
  const safeWalletLimit = boundedInteger(walletLimit, 5000, 100000);
  const safeIssueLimit = boundedInteger(issueLimit, 1000, 10000);
  const issues = [];
  let totalIssues = 0;

  const recordIssue = (code, details = {}) => {
    totalIssues += 1;
    if (issues.length < safeIssueLimit) issues.push({ code, ...details });
  };

  const wallets = await Wallet.find({})
    .sort({ _id: 1 })
    .limit(safeWalletLimit)
    .lean();
  const walletIds = wallets.map((wallet) => wallet._id);
  const walletById = new Map(
    wallets.map((wallet) => [asId(wallet._id), wallet]),
  );
  const sums = new Map();
  const latestBalances = new Map();

  const transactions = walletIds.length
    ? await WalletTransaction.find({
        walletId: { $in: walletIds },
        status: "success",
      })
        .sort({ walletId: 1, createdAt: 1, _id: 1 })
        .lean()
    : [];

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

  const orphanTransactions = await WalletTransaction.aggregate([
    { $match: { status: "success" } },
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
    { $limit: safeIssueLimit },
  ]);
  for (const transaction of orphanTransactions) {
    recordIssue("LEDGER_WALLET_MISSING", {
      transactionId: asId(transaction._id),
      walletId: asId(transaction.walletId),
    });
  }

  const deposits = await DepositRequest.find({
    status: { $in: ["success", "reversed"] },
  })
    .select("_id amount status")
    .limit(safeWalletLimit)
    .lean();
  const depositEntries = deposits.length
    ? await WalletTransaction.find({
        referenceType: "deposit_request",
        referenceId: { $in: deposits.map((deposit) => deposit._id) },
      }).lean()
    : [];
  const entriesByDeposit = new Map();
  for (const entry of depositEntries) {
    const key = asId(entry.referenceId);
    const values = entriesByDeposit.get(key) || [];
    values.push(entry);
    entriesByDeposit.set(key, values);
  }

  for (const deposit of deposits) {
    const entries = entriesByDeposit.get(asId(deposit._id)) || [];
    const originals = entries.filter(
      (entry) =>
        entry.type === "deposit" &&
        !entry.reversalOf &&
        entry.amount === deposit.amount,
    );
    if (originals.length !== 1) {
      recordIssue("DEPOSIT_LEDGER_CARDINALITY", {
        depositId: asId(deposit._id),
        originalEntries: originals.length,
      });
      continue;
    }
    const reversals = entries.filter(
      (entry) => asId(entry.reversalOf) === asId(originals[0]._id),
    );
    if (
      deposit.status === "reversed" &&
      (reversals.length !== 1 ||
        reversals[0].type !== "reversal" ||
        reversals[0].amount !== -deposit.amount)
    ) {
      recordIssue("DEPOSIT_REVERSAL_LEDGER_MISMATCH", {
        depositId: asId(deposit._id),
        reversalEntries: reversals.length,
      });
    }
    if (deposit.status === "success" && reversals.length > 0) {
      recordIssue("DEPOSIT_STATUS_REVERSAL_MISMATCH", {
        depositId: asId(deposit._id),
        reversalEntries: reversals.length,
      });
    }
  }

  const subscriptions = await TrainerSubscription.find({})
    .select("_id amount purchaseRequestId")
    .limit(safeWalletLimit)
    .lean();
  const subscriptionEntries = subscriptions.length
    ? await WalletTransaction.find({
        referenceId: {
          $in: subscriptions.map((subscription) => subscription._id),
        },
        type: "purchase",
      }).lean()
    : [];
  const entriesBySubscription = new Map();
  for (const entry of subscriptionEntries) {
    const key = asId(entry.referenceId);
    const values = entriesBySubscription.get(key) || [];
    values.push(entry);
    entriesBySubscription.set(key, values);
  }

  for (const subscription of subscriptions) {
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

  if (totalIssues > 0) {
    incrementMetric("financial.reconciliation_mismatches", totalIssues);
  }

  return {
    generatedAt: new Date().toISOString(),
    checkedWallets: wallets.length,
    checkedTransactions: transactions.length,
    checkedDeposits: deposits.length,
    checkedSubscriptions: subscriptions.length,
    totalIssues,
    issuesTruncated: totalIssues > issues.length,
    issues,
  };
};
