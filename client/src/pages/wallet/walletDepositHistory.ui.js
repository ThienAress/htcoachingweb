export const resolveDepositHistoryAmounts = (deposit) => {
  const transactionCount =
    Number.isSafeInteger(deposit.settledTransactionCount) &&
    deposit.settledTransactionCount > 0
      ? deposit.settledTransactionCount
      : 0;
  const settlementTotalsComplete =
    Number.isSafeInteger(deposit.settledAmountTotal) &&
    deposit.settledAmountTotal > 0 &&
    Number.isSafeInteger(deposit.settledBonusAmountTotal) &&
    deposit.settledBonusAmountTotal >= 0 &&
    Number.isSafeInteger(deposit.settledCreditedAmountTotal) &&
    deposit.settledCreditedAmountTotal > 0 &&
    deposit.settledCreditedAmountTotal ===
      deposit.settledAmountTotal + deposit.settledBonusAmountTotal;

  if (transactionCount > 0 && settlementTotalsComplete) {
    return {
      transferredAmount: deposit.settledAmountTotal ?? 0,
      bonusAmount: deposit.settledBonusAmountTotal ?? 0,
      creditedAmount: deposit.settledCreditedAmountTotal ?? 0,
      transactionCount,
      usesSettlementTotals: true,
    };
  }

  return {
    transferredAmount: deposit.amount,
    bonusAmount: deposit.bonusAmount ?? 0,
    creditedAmount: deposit.creditedAmount ?? deposit.amount,
    transactionCount: 0,
    usesSettlementTotals: false,
  };
};
