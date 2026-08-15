import mongoose from "mongoose";

import IncomingBankTransaction from "../models/IncomingBankTransaction.js";

const emptySummary = () => ({
  settledTransactionCount: 0,
  settledAmountTotal: 0,
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
        lastSettlementAt: { $max: "$transactionAt" },
      },
    },
  ]);
  return new Map(rows.map((row) => [String(row._id), row]));
};

export const addSettlementSummary = (deposit, summaryMap) => {
  const value = deposit?.toObject ? deposit.toObject() : deposit;
  const summary = summaryMap.get(String(value._id)) || emptySummary();
  return {
    ...value,
    settledTransactionCount: summary.settledTransactionCount,
    settledAmountTotal: summary.settledAmountTotal,
    lastSettlementAt: summary.lastSettlementAt,
  };
};
