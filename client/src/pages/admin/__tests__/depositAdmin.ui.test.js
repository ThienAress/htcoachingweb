import { describe, expect, it } from "vitest";

import {
  buildDepositApprovalConfirmation,
  formatVND,
  resolveDepositApprovalImpact,
  resolveIncomingWalletImpact,
  resolveSelectedDeposit,
} from "../depositAdmin.ui";

describe("deposit admin financial mutation presentation", () => {
  it("shows transfer, bonus, and exact credited amount before direct approval", () => {
    const deposit = {
      amount: 200_000,
      bonusAmount: 40_000,
      creditedAmount: 240_000,
      userId: { name: "Khách thử" },
    };

    expect(resolveDepositApprovalImpact(deposit)).toEqual({
      transferredAmount: 200_000,
      bonusAmount: 40_000,
      walletAmount: 240_000,
    });

    const confirmation = buildDepositApprovalConfirmation(deposit);
    expect(confirmation).toContain("Khách thử");
    expect(confirmation).toContain(`Tiền chuyển: ${formatVND(200_000)}`);
    expect(confirmation).toContain(`Tiền thưởng: +${formatVND(40_000)}`);
    expect(confirmation).toContain(`Ví được cộng: ${formatVND(240_000)}`);
  });

  it("uses the currently selected matching deposit snapshot for incoming approval", () => {
    const item = { amount: 200_000, creditedAmount: 999_000 };

    expect(
      resolveIncomingWalletImpact({
        actionType: "approve",
        item,
        selectedDeposit: {
          amount: 200_000,
          bonusAmount: 40_000,
          creditedAmount: 240_000,
        },
      }),
    ).toEqual({
      direction: "credit",
      transferredAmount: 200_000,
      bonusAmount: 40_000,
      walletAmount: 240_000,
      isExactDepositAmount: true,
    });
  });

  it("resolves the current selection instead of a previously linked deposit", () => {
    const linkedDeposit = {
      _id: "deposit-old",
      amount: 200_000,
      creditedAmount: 240_000,
    };
    const currentDeposit = {
      _id: "deposit-current",
      amount: 200_000,
      creditedAmount: 250_000,
    };

    expect(
      resolveSelectedDeposit({
        depositRequestId: "deposit-current",
        deposits: [currentDeposit],
        linkedDeposit,
      }),
    ).toBe(currentDeposit);
    expect(
      resolveSelectedDeposit({
        depositRequestId: "deposit-old",
        deposits: [],
        linkedDeposit,
      }),
    ).toBe(linkedDeposit);
  });

  it("credits the actual bank amount without bonus for a mismatched incoming approval", () => {
    expect(
      resolveIncomingWalletImpact({
        actionType: "approve",
        item: { amount: 199_000, creditedAmount: 240_000 },
        selectedDeposit: {
          amount: 200_000,
          bonusAmount: 40_000,
          creditedAmount: 240_000,
        },
      }),
    ).toEqual({
      direction: "credit",
      transferredAmount: 199_000,
      bonusAmount: 0,
      walletAmount: 199_000,
      isExactDepositAmount: false,
    });
  });

  it("shows the exact prior credit that an incoming reversal will subtract", () => {
    expect(
      resolveIncomingWalletImpact({
        actionType: "reverse",
        item: { amount: 200_000, creditedAmount: 240_000 },
      }),
    ).toEqual({
      direction: "debit",
      transferredAmount: 200_000,
      bonusAmount: 40_000,
      walletAmount: 240_000,
      isExactDepositAmount: null,
    });

    expect(
      resolveIncomingWalletImpact({
        actionType: "reverse",
        item: { amount: 199_000 },
      }).walletAmount,
    ).toBe(199_000);
  });
});
