const RANGE_PROFILES = {
  high: {
    portionGrams: [0.8, 1.25],
    calories: [0.75, 1.35],
    protein: [0.7, 1.4],
    carb: [0.7, 1.4],
    fat: [0.6, 1.6],
  },
  medium: {
    portionGrams: [0.65, 1.45],
    calories: [0.6, 1.6],
    protein: [0.55, 1.7],
    carb: [0.55, 1.7],
    fat: [0.45, 2],
  },
  low: {
    portionGrams: [0.5, 1.75],
    calories: [0.4, 2],
    protein: [0.35, 2.2],
    carb: [0.35, 2.2],
    fat: [0.25, 2.8],
  },
};

const RANGE_LIMITS = {
  portionGrams: [3_000, 0],
  calories: [5_000, 0],
  protein: [1_000, 1],
  carb: [1_000, 1],
  fat: [1_000, 1],
};

const MISSING_SCALE_REASON = {
  vi: "Ảnh không có vật chuẩn kích thước đáng tin cậy.",
  en: "No reliable size reference is visible in the image.",
};

const UNVERIFIED_SCALE_REASON = {
  vi: "V\u1eadt chu\u1ea9n trong \u1ea3nh ch\u01b0a \u0111\u01b0\u1ee3c ng\u01b0\u1eddi d\u00f9ng x\u00e1c minh k\u00edch th\u01b0\u1edbc.",
  en: "The apparent size reference has not been externally verified.",
};

const round = (value, decimals) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const widenRange = (range, multipliers, maximum, decimals) => ({
  min: round(
    Math.max(0, Math.min(range.min, range.estimate * multipliers[0])),
    decimals,
  ),
  estimate: range.estimate,
  max: round(
    Math.min(maximum, Math.max(range.max, range.estimate * multipliers[1])),
    decimals,
  ),
});

export const calibrateMealScanConfidence = (raw) => {
  const requested = ["high", "medium", "low"].includes(raw?.confidence)
    ? raw.confidence
    : "low";
  if (raw?.scaleReferenceVisible !== true) return "low";
  if (requested === "high") return "medium";
  return requested;
};

export const applyMealScanUncertainty = (items, confidence) => {
  const profile = RANGE_PROFILES[confidence] || RANGE_PROFILES.low;
  return items.map((item) => ({
    ...item,
    ...Object.fromEntries(
      Object.entries(RANGE_LIMITS).map(([key, [maximum, decimals]]) => [
        key,
        widenRange(item[key], profile[key], maximum, decimals),
      ]),
    ),
  }));
};

export const getMissingScaleReason = (locale) =>
  MISSING_SCALE_REASON[locale === "en" ? "en" : "vi"];

export const getUnverifiedScaleReason = (locale) =>
  UNVERIFIED_SCALE_REASON[locale === "en" ? "en" : "vi"];
