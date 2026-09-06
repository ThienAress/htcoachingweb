import mongoose from "mongoose";

import DepositRequest from "../models/DepositRequest.js";
import IncomingBankTransaction from "../models/IncomingBankTransaction.js";
import WalletTransaction from "../models/WalletTransaction.js";

const emptySummary = () => ({
  settledTransactionCount: 0,
  settledAmountTotal: 0,
  settledBonusAmountTotal: 0,
  settledCreditedAmountTotal: 0,
  lastSettlementAt: null,
});

export const getDepositSettlementSummaryMap = async (depositIds) => {
  const validIds = [...new Set(depositIds.map(String))]
    .filter((id) => mongoose.isValidObjectId(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  if (validIds.length === 0) return new Map();
  const rows = await IncomingBankTransaction.aggregate([
    {
      $match: {
        depositRequestId: { $in: validIds },
        status: "settled",
      },
    },
    {
      $group: {
        _id: "$depositRequestId",
        settledTransactionCount: { $sum: 1 },
        settledAmountTotal: { $sum: "$amount" },
        settledCreditedAmountTotal: {
          $sum: { $ifNull: ["$creditedAmount", "$amount"] },
        },
        settledBonusAmountTotal: {
          $sum: {
            $subtract: [{ $ifNull: ["$creditedAmount", "$amount"] }, "$amount"],
          },
        },
        lastSettlementAt: { $max: "$transactionAt" },
      },
    },
  ]);
  const summaryMap = new Map(rows.map((row) => [String(row._id), row]));
  const directCredits = await WalletTransaction.find({
    referenceType: "deposit_request",
    referenceId: { $in: validIds },
    type: "deposit",
    status: "success",
    reversalOf: null,
  })
    .select("_id referenceId amount createdAt")
    .lean();
  if (directCredits.length === 0) return summaryMap;

  const reversals = await WalletTransaction.find({
    reversalOf: { $in: directCredits.map((entry) => entry._id) },
    type: "reversal",
    status: "success",
  })
    .select("reversalOf")
    .lean();
  const reversedCreditIds = new Set(
    reversals.map((entry) => String(entry.reversalOf)),
  );
  const activeDirectCredits = directCredits.filter(
    (entry) => !reversedCreditIds.has(String(entry._id)),
  );
  if (activeDirectCredits.length === 0) return summaryMap;

  const deposits = await DepositRequest.find({
    _id: {
      $in: activeDirectCredits.map((entry) => entry.referenceId),
    },
  })
    .select("amount")
    .lean();
  const depositsById = new Map(
    deposits.map((deposit) => [String(deposit._id), deposit]),
  );

  for (const credit of activeDirectCredits) {
    const depositId = String(credit.referenceId);
    const deposit = depositsById.get(depositId);
    const transferredAmount = deposit?.amount;
    const creditedAmount = credit.amount;
    const bonusAmount = creditedAmount - transferredAmount;
    if (
      !Number.isSafeInteger(transferredAmount) ||
      transferredAmount <= 0 ||
      !Number.isSafeInteger(creditedAmount) ||
      creditedAmount <= 0 ||
      !Number.isSafeInteger(bonusAmount) ||
      bonusAmount < 0
    ) {
      const error = new Error(
        "Direct deposit settlement data is inconsistent",
      );
      error.code = "DIRECT_DEPOSIT_SETTLEMENT_INVALID";
      throw error;
    }

    const current = summaryMap.get(depositId) || emptySummary();
    summaryMap.set(depositId, {
      _id: credit.referenceId,
      settledTransactionCount: current.settledTransactionCount + 1,
      settledAmountTotal: current.settledAmountTotal + transferredAmount,
      settledBonusAmountTotal:
        (current.settledBonusAmountTotal ?? 0) + bonusAmount,
      settledCreditedAmountTotal:
        (current.settledCreditedAmountTotal ?? current.settledAmountTotal) +
        creditedAmount,
      lastSettlementAt:
        current.lastSettlementAt && current.lastSettlementAt > credit.createdAt
          ? current.lastSettlementAt
          : credit.createdAt,
    });
  }

  return summaryMap;
};

export const addSettlementSummary = (deposit, summaryMap) => {
  const value = deposit?.toObject ? deposit.toObject() : deposit;
  const summary = summaryMap.get(String(value._id)) || emptySummary();
  return {
    ...value,
    settledTransactionCount: summary.settledTransactionCount,
    settledAmountTotal: summary.settledAmountTotal,
    settledBonusAmountTotal: summary.settledBonusAmountTotal ?? 0,
    settledCreditedAmountTotal:
      summary.settledCreditedAmountTotal ?? summary.settledAmountTotal,
    lastSettlementAt: summary.lastSettlementAt,
  };
};
