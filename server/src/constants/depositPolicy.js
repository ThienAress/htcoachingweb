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

export const DEFAULT_DEPOSIT_TIER_MINIMUMS = Object.freeze(
  Object.fromEntries(DEPOSIT_TIER_DEFINITIONS.map(({ key, minAmount }) => [key, minAmount])),
);

export const DEFAULT_DEPOSIT_TIER_LABELS = Object.freeze({
  starter: "",
  growth: "",
  premium: "",
});

export const DEPOSIT_TIER_MINIMUM_STEP = 1_000;
export const MAX_DEPOSIT_TIER_LABEL_LENGTH = 40;

const buildTiers = (
  rates = DEFAULT_DEPOSIT_BONUS_RATES,
  minimums = DEFAULT_DEPOSIT_TIER_MINIMUMS,
  labels = DEFAULT_DEPOSIT_TIER_LABELS,
) =>
  DEPOSIT_TIER_DEFINITIONS.map(({ key }) =>
    Object.freeze({
      key,
      minAmount: minimums[key],
      bonusRate: rates[key],
      label: labels[key] || null,
    }),
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

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

// Mốc nạp của bậc 1 luôn là mức nạp tối thiểu; admin chỉ chỉnh mốc của bậc 2 và bậc 3.
export const validateDepositTierMinimums = (thresholds) => {
  const invalid = {
    valid: false,
    code: "INVALID_DEPOSIT_TIER_MINIMUMS",
    message:
      "Mốc nạp phải là số nguyên VND chia hết cho 1.000, tăng dần và không vượt quá 1.000.000.000đ",
  };
  if (
    !isPlainObject(thresholds) ||
    Object.keys(thresholds).length !== 2 ||
    !Object.hasOwn(thresholds, "growth") ||
    !Object.hasOwn(thresholds, "premium")
  ) {
    return invalid;
  }
  const { growth, premium } = thresholds;
  const starter = DEPOSIT_POLICY.minAmount;
  const steps = [growth, premium].every(
    (value) => Number.isSafeInteger(value) && value % DEPOSIT_TIER_MINIMUM_STEP === 0,
  );
  if (!steps || !(starter < growth && growth < premium && premium <= DEPOSIT_POLICY.maxAmount)) {
    return invalid;
  }
  return { valid: true, minimums: { starter, growth, premium } };
};

// Nhãn tùy chọn cho từng bậc; chuỗi rỗng nghĩa là dùng tên mặc định.
export const validateDepositTierLabels = (labels) => {
  const keys = DEPOSIT_TIER_DEFINITIONS.map(({ key }) => key);
  const invalid = {
    valid: false,
    code: "INVALID_DEPOSIT_TIER_LABELS",
    message: `Tên bậc tối đa ${MAX_DEPOSIT_TIER_LABEL_LENGTH} ký tự và không chứa ký tự điều khiển`,
  };
  if (!isPlainObject(labels) || Object.keys(labels).some((key) => !keys.includes(key))) {
    return invalid;
  }
  const normalized = {};
  for (const key of keys) {
    const value = Object.hasOwn(labels, key) ? labels[key] : "";
    if (typeof value !== "string") return invalid;
    const text = value.replace(/\s+/g, " ").trim();
    if (text.length > MAX_DEPOSIT_TIER_LABEL_LENGTH || /[\u0000-\u001f\u007f]/.test(text)) {
      return invalid;
    }
    normalized[key] = text;
  }
  return { valid: true, labels: normalized };
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
    bonusTierMinAmount: tier.minAmount,
    bonusRate: tier.bonusRate,
    bonusAmount,
    creditedAmount,
    policyVersion: policy.policyVersion,
  };
};

export const buildDepositPolicy = ({ rates, minimums, labels, policyVersion }) => ({
  currency: DEPOSIT_POLICY.currency,
  minAmount: DEPOSIT_POLICY.minAmount,
  maxAmount: DEPOSIT_POLICY.maxAmount,
  policyVersion,
  tiers: buildTiers(rates, minimums, labels),
});
