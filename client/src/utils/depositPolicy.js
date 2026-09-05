const TIER_KEYS = ["starter", "growth", "premium"];
const TIER_MINIMUMS = [10_000, 100_000, 200_000];

export const parseDepositBonusRateDraft = (value) => {
  if (typeof value !== "string" || value.trim() === "") return null;
  const rate = Number(value);
  return Number.isSafeInteger(rate) && rate >= 0 && rate <= 100 ? rate : null;
};

const isValidTier = (tier, index) =>
  tier?.key === TIER_KEYS[index] &&
  tier?.minAmount === TIER_MINIMUMS[index] &&
  Number.isSafeInteger(tier?.bonusRate) &&
  tier.bonusRate >= 0 &&
  tier.bonusRate <= 100;

export const normalizeDepositPolicyResponse = (response) => {
  const policy = response?.data?.data;
  const tiers = policy?.tiers;
  const tiersValid =
    Array.isArray(tiers) &&
    tiers.length === TIER_KEYS.length &&
    tiers.every(isValidTier) &&
    tiers.every(
      (tier, index) =>
        index === 0 || tier.bonusRate >= tiers[index - 1].bonusRate,
    );
  if (
    policy?.currency !== "VND" ||
    policy?.minAmount !== 10_000 ||
    policy?.maxAmount !== 1_000_000_000 ||
    !Number.isSafeInteger(policy?.policyVersion) ||
    policy.policyVersion < 1 ||
    !tiersValid
  ) {
    throw new Error("Deposit policy response is invalid");
  }
  return {
    currency: policy.currency,
    minAmount: policy.minAmount,
    maxAmount: policy.maxAmount,
    policyVersion: policy.policyVersion,
    tiers: tiers.map(({ key, minAmount, bonusRate }) => ({
      key,
      minAmount,
      bonusRate,
    })),
  };
};

export const selectDepositTier = (policy, amount) => {
  if (!Number.isSafeInteger(amount)) return null;
  return (
    [...(policy?.tiers || [])]
      .filter((tier) => amount >= tier.minAmount)
      .sort((left, right) => right.minAmount - left.minAmount)[0] || null
  );
};

export const calculateDepositPreview = (policy, amount) => {
  const tier = selectDepositTier(policy, amount);
  if (!tier || amount > policy.maxAmount) {
    const safeAmount = Number.isSafeInteger(amount) ? amount : 0;
    return {
      amount: safeAmount,
      bonusTierKey: null,
      bonusRate: 0,
      bonusAmount: 0,
      creditedAmount: safeAmount,
    };
  }
  const bonusAmount = Math.floor((amount * tier.bonusRate) / 100);
  return {
    amount,
    bonusTierKey: tier.key,
    bonusRate: tier.bonusRate,
    bonusAmount,
    creditedAmount: amount + bonusAmount,
  };
};
