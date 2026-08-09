const RANGE_KEYS = ["min", "estimate", "max"];
const NUTRIENT_KEYS = ["calories", "protein", "carb", "fat"];

const round = (value, decimals) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const scaleRange = (range, ratio, decimals) =>
  Object.fromEntries(
    RANGE_KEYS.map((key) => [key, round((Number(range?.[key]) || 0) * ratio, decimals)]),
  );

const sumRange = (items, key, decimals) =>
  Object.fromEntries(
    RANGE_KEYS.map((rangeKey) => [
      rangeKey,
      round(
        items.reduce(
          (sum, item) => sum + (Number(item?.[key]?.[rangeKey]) || 0),
          0,
        ),
        decimals,
      ),
    ]),
  );

export const deriveMealTotals = (items) =>
  Object.fromEntries(
    NUTRIENT_KEYS.map((key) => [
      key,
      sumRange(items, key, key === "calories" ? 0 : 1),
    ]),
  );

export const applyPortionAdjustments = (result, adjustments = {}) => {
  if (!result?.items) return result;

  const items = result.items.map((item) => {
    const originalPortion = Math.max(
      1,
      Number(item.portionGrams?.estimate) || 1,
    );
    const requestedPortion = Number(adjustments[item.id]);
    const adjustedPortion = Number.isFinite(requestedPortion)
      ? Math.min(Math.max(requestedPortion, 1), 3_000)
      : originalPortion;
    const ratio = adjustedPortion / originalPortion;

    return {
      ...item,
      portionGrams: {
        ...scaleRange(item.portionGrams, ratio, 0),
        estimate: round(adjustedPortion, 0),
      },
      ...Object.fromEntries(
        NUTRIENT_KEYS.map((key) => [
          key,
          scaleRange(item[key], ratio, key === "calories" ? 0 : 1),
        ]),
      ),
    };
  });

  const includedDeclaredIngredients = Array.isArray(result.declaredIngredients)
    ? result.declaredIngredients.filter((item) => item.includedInTotal)
    : [];

  return {
    ...result,
    items,
    total: deriveMealTotals([...items, ...includedDeclaredIngredients]),
  };
};
const MACRO_SCORE_RANGES = {
  protein: { min: 10, max: 35, factor: 0.35, weight: 0.3 },
  carb: { min: 45, max: 65, factor: 0.25, weight: 0.3 },
  fat: { min: 20, max: 35, factor: 0.35, weight: 0.4 },
};

const scoreMacroRatio = (ratio, { min, max, factor }) => {
  const distance = ratio < min ? min - ratio : ratio > max ? ratio - max : 0;
  return Math.max(1, 10 - distance * factor);
};

export const calculateMacroBalanceScore = (total = {}) => {
  const energy = {
    protein: Math.max(0, Number(total.protein?.estimate) || 0) * 4,
    carb: Math.max(0, Number(total.carb?.estimate) || 0) * 4,
    fat: Math.max(0, Number(total.fat?.estimate) || 0) * 9,
  };
  const macroEnergy = energy.protein + energy.carb + energy.fat;

  if (macroEnergy <= 0) {
    return {
      score: 1,
      ratios: { protein: 0, carb: 0, fat: 0 },
      labelKey: "limited",
    };
  }

  const ratios = Object.fromEntries(
    Object.entries(energy).map(([key, value]) => [
      key,
      round((value / macroEnergy) * 100, 1),
    ]),
  );
  const score = Math.round(
    Object.entries(MACRO_SCORE_RANGES).reduce(
      (sum, [key, config]) =>
        sum + scoreMacroRatio(ratios[key], config) * config.weight,
      0,
    ),
  );

  return {
    score: Math.min(Math.max(score, 1), 10),
    ratios,
    labelKey:
      score >= 9
        ? "balanced"
        : score >= 7
          ? "fairly_balanced"
          : score >= 5
            ? "uneven"
            : "limited",
  };
};
