const TIER_KEYS = ["starter", "growth", "premium"];
export const MAX_DEPOSIT_TIER_LABEL_LENGTH = 40;
export const DEPOSIT_TIER_MINIMUM_STEP = 1_000;

// Mốc nạp của bậc 1 luôn là mức nạp tối thiểu; mốc bậc 2 và bậc 3 do admin chỉnh nên phải tăng dần.
const hasValidLabel = (tier) =>
  tier?.label === undefined ||
  tier.label === null ||
  (typeof tier.label === "string" &&
    tier.label.length > 0 &&
    tier.label.length <= MAX_DEPOSIT_TIER_LABEL_LENGTH);

export const parseDepositBonusRateDraft = (value) => {
  if (typeof value !== "string" || value.trim() === "") return null;
  const rate = Number(value);
  return Number.isSafeInteger(rate) && rate >= 0 && rate <= 100 ? rate : null;
};

// Mốc nạp nhập tay: chỉ nhận số nguyên dương chia hết cho 1.000; chuỗi rỗng không phải 0.
export const parseDepositMinimumDraft = (value) => {
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) return null;
  const amount = Number(value.trim());
  return Number.isSafeInteger(amount) && amount > 0 && amount % DEPOSIT_TIER_MINIMUM_STEP === 0
    ? amount
    : null;
};

const isValidTier = (tier, index, tiers, policy) =>
  tier?.key === TIER_KEYS[index] &&
  Number.isSafeInteger(tier?.minAmount) &&
  (index === 0
    ? tier.minAmount === policy?.minAmount
    : tier.minAmount > tiers[index - 1].minAmount &&
      tier.minAmount % DEPOSIT_TIER_MINIMUM_STEP === 0 &&
      tier.minAmount <= policy?.maxAmount) &&
  hasValidLabel(tier) &&
  Number.isSafeInteger(tier?.bonusRate) &&
  tier.bonusRate >= 0 &&
  tier.bonusRate <= 100;

export const normalizeDepositPolicyResponse = (response) => {
  const policy = response?.data?.data;
  const tiers = policy?.tiers;
  const tiersValid =
    Array.isArray(tiers) &&
    tiers.length === TIER_KEYS.length &&
    tiers.every((tier, index) => isValidTier(tier, index, tiers, policy)) &&
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
    tiers: tiers.map(({ key, minAmount, bonusRate, label }) => ({
      key,
      minAmount,
      bonusRate,
      label: label || null,
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
