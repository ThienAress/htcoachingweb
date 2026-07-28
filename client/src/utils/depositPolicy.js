export const normalizeDepositPolicyResponse = (response) => {
  const policy = response?.data?.data;
  if (
    policy?.currency !== "VND" ||
    !Number.isSafeInteger(policy?.minAmount) ||
    !Number.isSafeInteger(policy?.maxAmount) ||
    policy.minAmount <= 0 ||
    policy.minAmount > policy.maxAmount
  ) {
    throw new Error("Deposit policy response is invalid");
  }
  return policy;
};
