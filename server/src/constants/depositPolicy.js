export const DEPOSIT_POLICY_KEY = "wallet_deposit_bonus";
export const DEPOSIT_POLICY_ID = "00000000000000000000d091";

export const DEPOSIT_TIER_DEFINITIONS = Object.freeze([
  Object.freeze({ key: "starter", minAmount: 10_000 }),
  Object.freeze({ key: "growth", minAmount: 100_000 }),
  Object.freeze({ key: "premium", minAmount: 200_000 }),
]);

export const DEFAULT_DEPOSIT_BONUS_RATES = Object.freeze({
  starter: 10,
  growth: 15,
  premium: 20,
});

const buildTiers = (rates = DEFAULT_DEPOSIT_BONUS_RATES) =>
  DEPOSIT_TIER_DEFINITIONS.map(({ key, minAmount }) =>
    Object.freeze({ key, minAmount, bonusRate: rates[key] }),
  );

export const DEPOSIT_POLICY = Object.freeze({
  currency: "VND",
  minAmount: 10_000,
  maxAmount: 1_000_000_000,
  policyVersion: 1,
  tiers: Object.freeze(buildTiers()),
});

export const validateDepositAmount = (amount, policy = DEPOSIT_POLICY) => {
  if (!Number.isSafeInteger(amount)) {
    return {
      valid: false,
      code: "INVALID_DEPOSIT_AMOUNT",
      message: "Số tiền nạp phải là số nguyên VND",
    };
  }
  if (amount < policy.minAmount) {
    return {
      valid: false,
      code: "DEPOSIT_AMOUNT_TOO_LOW",
      message: "Số tiền nạp tối thiểu là 10.000đ",
    };
  }
  if (amount > policy.maxAmount) {
    return {
      valid: false,
      code: "DEPOSIT_AMOUNT_TOO_HIGH",
      message: "Số tiền nạp tối đa là 1.000.000.000đ",
    };
  }
  return { valid: true };
};

export const validateDepositBonusRates = (rates) => {
  const keys = DEPOSIT_TIER_DEFINITIONS.map(({ key }) => key);
  const hasExactKeys =
    rates &&
    typeof rates === "object" &&
    !Array.isArray(rates) &&
    Object.keys(rates).length === keys.length &&
    keys.every(
      (key) =>
        Object.hasOwn(rates, key) &&
        Number.isSafeInteger(rates[key]) &&
        rates[key] >= 0 &&
        rates[key] <= 100,
    );
  if (!hasExactKeys) {
    return {
      valid: false,
      code: "INVALID_DEPOSIT_BONUS_RATES",
      message: "Phải nhập đủ ba tỷ lệ thưởng là số nguyên từ 0 đến 100",
    };
  }
  const normalized = Object.fromEntries(keys.map((key) => [key, rates[key]]));
  const monotonic = keys.every(
    (key, index) =>
      index === 0 || normalized[key] >= normalized[keys[index - 1]],
  );
  if (!monotonic) {
    return {
      valid: false,
      code: "DEPOSIT_BONUS_RATES_NOT_MONOTONIC",
      message: "Tỷ lệ thưởng không được giảm ở bậc tiền cao hơn",
    };
  }
  return { valid: true, rates: normalized };
};

export const resolveDepositTier = (policy, amount) => {
  if (!Number.isSafeInteger(amount)) return null;
  return (
    [...(policy?.tiers || [])]
      .filter((tier) => amount >= tier.minAmount)
      .sort((left, right) => right.minAmount - left.minAmount)[0] || null
  );
};

export const calculateDepositCreditSnapshot = (policy, amount) => {
  const amountValidation = validateDepositAmount(amount, policy);
  if (!amountValidation.valid) {
    throw Object.assign(new Error(amountValidation.message), amountValidation);
  }
  const tier = resolveDepositTier(policy, amount);
  if (!tier) {
    const error = new Error("Không tìm thấy bậc thưởng nạp tiền phù hợp");
    error.code = "DEPOSIT_BONUS_TIER_NOT_FOUND";
    throw error;
  }
  const bonusAmount = Math.floor((amount * tier.bonusRate) / 100);
  const creditedAmount = amount + bonusAmount;
  if (!Number.isSafeInteger(bonusAmount) || !Number.isSafeInteger(creditedAmount)) {
    const error = new Error("Giá trị thưởng nạp tiền vượt giới hạn an toàn");
    error.code = "DEPOSIT_BONUS_AMOUNT_UNSAFE";
    throw error;
  }
  return {
    bonusTierKey: tier.key,
    bonusRate: tier.bonusRate,
    bonusAmount,
    creditedAmount,
    policyVersion: policy.policyVersion,
  };
};

export const buildDepositPolicy = ({ rates, policyVersion }) => ({
  currency: DEPOSIT_POLICY.currency,
  minAmount: DEPOSIT_POLICY.minAmount,
  maxAmount: DEPOSIT_POLICY.maxAmount,
  policyVersion,
  tiers: buildTiers(rates),
});
