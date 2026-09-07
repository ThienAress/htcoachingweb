import { describe, expect, it } from "vitest";

import { resolveDepositHistoryAmounts } from "../walletDepositHistory.ui";

describe("resolveDepositHistoryAmounts", () => {
  it("uses aggregate settlement totals when a request has multiple credited transactions", () => {
    expect(
      resolveDepositHistoryAmounts({
        amount: 200_000,
        bonusAmount: 40_000,
        creditedAmount: 240_000,
        settledTransactionCount: 2,
        settledAmountTotal: 400_000,
        settledBonusAmountTotal: 80_000,
        settledCreditedAmountTotal: 480_000,
      }),
    ).toEqual({
      transferredAmount: 400_000,
      bonusAmount: 80_000,
      creditedAmount: 480_000,
      transactionCount: 2,
      usesSettlementTotals: true,
    });
  });

  it("uses actual aggregate settlement totals for an amount mismatch", () => {
    expect(
      resolveDepositHistoryAmounts({
        amount: 200_000,
        bonusAmount: 40_000,
        creditedAmount: 240_000,
        settledTransactionCount: 1,
        settledAmountTotal: 199_000,
        settledBonusAmountTotal: 0,
        settledCreditedAmountTotal: 199_000,
      }),
    ).toEqual({
      transferredAmount: 199_000,
      bonusAmount: 0,
      creditedAmount: 199_000,
      transactionCount: 1,
      usesSettlementTotals: true,
    });
  });

  it("falls back to the invoice snapshot when no settlement aggregate exists", () => {
    expect(
      resolveDepositHistoryAmounts({
        amount: 200_000,
        bonusAmount: 40_000,
        creditedAmount: 240_000,
        settledTransactionCount: 0,
        settledAmountTotal: 0,
        settledBonusAmountTotal: 0,
        settledCreditedAmountTotal: 0,
      }),
    ).toEqual({
      transferredAmount: 200_000,
      bonusAmount: 40_000,
      creditedAmount: 240_000,
      transactionCount: 0,
      usesSettlementTotals: false,
    });

    expect(resolveDepositHistoryAmounts({ amount: 50_000 })).toEqual({
      transferredAmount: 50_000,
      bonusAmount: 0,
      creditedAmount: 50_000,
      transactionCount: 0,
      usesSettlementTotals: false,
    });
  });
  it("keeps the invoice snapshot during a mixed-version rollout", () => {
    expect(
      resolveDepositHistoryAmounts({
        amount: 200_000,
        bonusAmount: 40_000,
        creditedAmount: 240_000,
        settledTransactionCount: 1,
        settledAmountTotal: 200_000,
      }),
    ).toEqual({
      transferredAmount: 200_000,
      bonusAmount: 40_000,
      creditedAmount: 240_000,
      transactionCount: 0,
      usesSettlementTotals: false,
    });
  });
});
