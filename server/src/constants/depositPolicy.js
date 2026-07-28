export const DEPOSIT_POLICY = Object.freeze({
  currency: "VND",
  minAmount: 5000,
  maxAmount: 100000000,
});

export const validateDepositAmount = (amount) => {
  if (!Number.isSafeInteger(amount)) {
    return {
      valid: false,
      code: "INVALID_DEPOSIT_AMOUNT",
      message: "Số tiền nạp phải là số nguyên VND",
    };
  }
  if (amount < DEPOSIT_POLICY.minAmount) {
    return {
      valid: false,
      code: "DEPOSIT_AMOUNT_TOO_LOW",
      message: "Số tiền nạp tối thiểu là 5.000đ",
    };
  }
  if (amount > DEPOSIT_POLICY.maxAmount) {
    return {
      valid: false,
      code: "DEPOSIT_AMOUNT_TOO_HIGH",
      message: "Số tiền nạp tối đa là 100.000.000đ",
    };
  }
  return { valid: true };
};
