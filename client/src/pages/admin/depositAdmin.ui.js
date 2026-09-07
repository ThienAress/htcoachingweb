export const formatVND = (amount) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);

export const resolveDepositApprovalImpact = (deposit) => ({
  transferredAmount: deposit.amount,
  bonusAmount: deposit.bonusAmount ?? 0,
  walletAmount: deposit.creditedAmount ?? deposit.amount,
});

export const buildDepositApprovalConfirmation = (deposit) => {
  const impact = resolveDepositApprovalImpact(deposit);
  const userName = deposit.userId?.name || "user";

  return [
    `Xác nhận duyệt nạp cho ${userName}?`,
    `Tiền chuyển: ${formatVND(impact.transferredAmount)}`,
    `Tiền thưởng: +${formatVND(impact.bonusAmount)}`,
    `Ví được cộng: ${formatVND(impact.walletAmount)}`,
  ].join("\n");
};

export const resolveSelectedDeposit = ({
  depositRequestId,
  deposits,
  linkedDeposit,
}) => {
  if (!depositRequestId) return null;

  return (
    deposits.find((deposit) => deposit._id === depositRequestId) ||
    (linkedDeposit?._id === depositRequestId ? linkedDeposit : null)
  );
};

export const resolveIncomingWalletImpact = ({
  actionType,
  item,
  selectedDeposit,
}) => {
  if (actionType === "approve") {
    if (!selectedDeposit) return null;

    const isExactDepositAmount = selectedDeposit.amount === item.amount;
    return {
      direction: "credit",
      transferredAmount: item.amount,
      bonusAmount: isExactDepositAmount
        ? (selectedDeposit.bonusAmount ?? 0)
        : 0,
      walletAmount: isExactDepositAmount
        ? (selectedDeposit.creditedAmount ?? selectedDeposit.amount)
        : item.amount,
      isExactDepositAmount,
    };
  }

  if (actionType === "reverse") {
    const walletAmount = item.creditedAmount ?? item.amount;
    return {
      direction: "debit",
      transferredAmount: item.amount,
      bonusAmount: Math.max(walletAmount - item.amount, 0),
      walletAmount,
      isExactDepositAmount: null,
    };
  }

  return null;
};
