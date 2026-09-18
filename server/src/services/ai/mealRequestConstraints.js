const normalizeText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9.,\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const finiteInRange = (value, min, max) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max
    ? number
    : null;
};

const localizedInteger = (value) => {
  const digits = String(value || "").replace(/[^0-9]/g, "");
  const number = Number(digits);
  return Number.isSafeInteger(number) ? number : null;
};

const firstMatchNumber = (text, pattern, min, max) => {
  const match = text.match(pattern);
  return match ? finiteInRange(localizedInteger(match[1]), min, max) : null;
};

const explicitCalories = (text) => {
  const matches = text.matchAll(/\b(\d{1,2}(?:[.,]\d{3})+|\d{3,4})\s*(?:kcal|calo)\b/g);
  for (const match of matches) {
    const value = finiteInRange(localizedInteger(match[1]), 800, 6000);
    if (value !== null) return value;
  }
  return null;
};

const explicitMinimumProtein = (text) => firstMatchNumber(
  text,
  /\b(?:it nhat|toi thieu|minimum)\s*(\d{1,3}(?:[.,]\d+)?)\s*(?:g|gram)\s*protein\b/,
  0,
  500,
);

const explicitTolerance = (text) => firstMatchNumber(
  text,
  /\bsai so(?: toi da)?\s*(\d{1,3})\s*(?:kcal|calo)\b/,
  0,
  300,
);

const explicitMealCount = (text) => firstMatchNumber(
  text,
  /\b(?:chia\s+)?([1-6])\s*bua\b/,
  1,
  6,
);

const explicitBudget = (text) => firstMatchNumber(
  text,
  /\bngan sach(?: toi da)?\s*(\d[\d.,\s]{2,12})\s*(?:d|vnd|dong)\b/,
  30_000,
  2_000_000,
);

const ALLERGEN_ALIASES = [
  ["milk", ["sua", "lactose", "milk", "dairy"]],
  ["peanut", ["dau phong", "lac"]],
  ["tree_nut", ["hat dieu", "hat oc cho", "hanh nhan", "tree nut"]],
  ["egg", ["trung", "egg"]],
  ["fish", ["ca", "fish"]],
  ["crustacean_shellfish", ["tom", "cua", "shellfish"]],
  ["wheat", ["lua mi", "wheat"]],
  ["soy", ["dau nanh", "soy"]],
  ["sesame", ["me", "vung", "sesame"]],
];
const ALLOWED_ALLERGENS = new Set(
  ALLERGEN_ALIASES.map(([allergen]) => allergen),
);

const boundedStringList = (values, maxItems = 12, maxLength = 100) => [
  ...new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => String(value || "").trim())
      .filter((value) => value && value.length <= maxLength),
  ),
].slice(0, maxItems);

const boundedAllergenList = (values) => boundedStringList(values, 9, 40)
  .filter((value) => ALLOWED_ALLERGENS.has(value));

const explicitAllergens = (text) => {
  if (!/\b(?:di ung|allerg(?:y|ies|ic)?|khong co|khong chua|khong nhiem cheo)\b/.test(text)) return [];
  return ALLERGEN_ALIASES
    .filter(([, aliases]) => aliases.some((alias) =>
      new RegExp(`\\b${alias.replace(/\s+/g, "\\s+")}\\b`).test(text)))
    .map(([allergen]) => allergen);
};

const explicitExcludedFoods = (text) => {
  const foods = [];
  if (/\b(?:khong dung|khong an|tranh)\s+(?:bot\s+)?whey\b/.test(text)) {
    foods.push("whey");
  }
  return foods;
};

const adjustmentScope = (text, plan) => {
  const match = text.match(
    /\bchi\s+(?:bang\s+cach\s+)?(?:doi|thay\s+doi|dieu\s+chinh)(?:\s+luong)?\s+(.+)$/,
  );
  if (!match) return { scopedAdjustment: false, ids: [], names: [] };
  const sentenceScope = match[1].split(/[.!?]/, 1)[0];
  const stopIndex = sentenceScope.search(/\b(?:giu nguyen|khong doi)\b/);
  const boundedScope = stopIndex >= 0
    ? sentenceScope.slice(0, stopIndex)
    : sentenceScope;
  const scopeWords = new Set(boundedScope.match(/[a-z0-9]+/g) || []);
  const seen = new Set();
  const foods = (Array.isArray(plan?.meals) ? plan.meals : [])
    .flatMap((meal) => Array.isArray(meal?.foods) ? meal.foods : [])
    .filter((food) => {
      const key = String(food?.foodId || food?.name || "");
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  const selected = foods.filter((food) =>
    normalizeText(food?.name)
      .split(/\s+/)
      .some((token) => token.length >= 2 && scopeWords.has(token)),
  );
  return {
    scopedAdjustment: true,
    ids: selected.map((food) => String(food.foodId)).filter(Boolean),
    names: selected.map((food) => String(food.name)).filter(Boolean),
  };
};

const selectNumber = (value, min, max) => {
  const number = finiteInRange(value, min, max);
  return number === null ? undefined : number;
};

const balanceFlexibleMacros = (targetCalories, protein, carb, fat) => {
  if (!Number.isFinite(targetCalories) || !Number.isFinite(protein)) {
    return { carb, fat };
  }
  const remainingCalories = Math.max(0, targetCalories - 4 * protein);
  const suppliedFlexibleCalories = 4 * (carb || 0) + 9 * (fat || 0);
  const carbShare = suppliedFlexibleCalories > 0
    ? (4 * (carb || 0)) / suppliedFlexibleCalories
    : 0.55;
  const balancedCarb = Number(((remainingCalories * carbShare) / 4).toFixed(1));
  const balancedFat = Number(
    ((remainingCalories - 4 * balancedCarb) / 9).toFixed(1),
  );
  return { carb: balancedCarb, fat: balancedFat };
};

export const buildCanonicalMealToolRequest = (
  message,
  modelArgs = {},
  lastMeal = null,
) => {
  const text = normalizeText(message);
  const previous = lastMeal && typeof lastMeal === "object" ? lastMeal : {};
  const requestedCalories = explicitCalories(text);
  const requestedMinimumProtein = explicitMinimumProtein(text);
  const modelTargetCalories = selectNumber(modelArgs.targetCalories, 800, 6000);
  const targetCalories = requestedCalories ??
    modelTargetCalories ??
    selectNumber(previous.targetCalories, 800, 6000);
  const minimumProteinGrams = requestedMinimumProtein ??
    selectNumber(modelArgs.minimumProteinGrams, 0, 500) ??
    selectNumber(previous.plan?.targets?.minimumProteinGrams, 0, 500) ??
    selectNumber(previous.proteinGrams, 0, 500);
  const suppliedProtein = selectNumber(modelArgs.proteinGrams, 0, 500) ??
    selectNumber(previous.proteinGrams, 0, 500) ??
    minimumProteinGrams;
  const proteinGrams = Math.max(
    suppliedProtein ?? 0,
    minimumProteinGrams ?? 0,
  );
  const suppliedCarb = selectNumber(modelArgs.carbGrams, 0, 1000) ??
    selectNumber(previous.carbGrams, 0, 1000);
  const suppliedFat = selectNumber(modelArgs.fatGrams, 0, 300) ??
    selectNumber(previous.fatGrams, 0, 300);
  const scope = adjustmentScope(text, previous.plan);
  const shouldRebalance = !scope.scopedAdjustment &&
    requestedCalories !== null &&
    requestedCalories !== modelTargetCalories;
  const balanced = shouldRebalance
    ? balanceFlexibleMacros(
        targetCalories,
        proteinGrams,
        suppliedCarb,
        suppliedFat,
      )
    : { carb: suppliedCarb, fat: suppliedFat };
  const unresolvedScope = scope.scopedAdjustment && scope.ids.length === 0;
  const requestedTolerance = explicitTolerance(text);
  const requestedExcludedFoods = explicitExcludedFoods(text);
  const requestedAllergens = explicitAllergens(text);
  const excludedFoods = boundedStringList([
    ...boundedStringList(previous.excludedFoods),
    ...boundedStringList(modelArgs.excludedFoods),
    ...requestedExcludedFoods,
  ]);
  const excludedAllergens = boundedAllergenList([
    ...boundedAllergenList(previous.excludedAllergens),
    ...boundedAllergenList(modelArgs.excludedAllergens),
    ...requestedAllergens,
  ]);
  const lactoseFree = previous.lactoseFree === true ||
    modelArgs.lactoseFree === true ||
    /\b(?:khong dung nap lactose|lactose free)\b/.test(text);
  const requirePackageLabelSafety =
    previous.requirePackageLabelSafety === true ||
    modelArgs.requirePackageLabelSafety === true ||
    /\b(?:nhan san pham|bao bi|nha san xuat|khong nhiem cheo|cross contact|cross contamination)\b/.test(text);
  const budgetVndPerDay = explicitBudget(text) ??
    selectNumber(modelArgs.budgetVndPerDay, 30_000, 2_000_000) ??
    selectNumber(previous.budgetVndPerDay, 30_000, 2_000_000);
  const targetToleranceCalories = requestedTolerance ??
    selectNumber(modelArgs.targetToleranceCalories, 0, 300) ??
    selectNumber(previous.targetToleranceCalories, 0, 300);
  const persistedMinimumProtein = requestedMinimumProtein ??
    selectNumber(modelArgs.minimumProteinGrams, 0, 500) ??
    selectNumber(previous.minimumProteinGrams, 0, 500);
  const args = {
    targetCalories,
    proteinGrams,
    carbGrams: balanced.carb,
    fatGrams: balanced.fat,
    mealsPerDay: explicitMealCount(text) ??
      selectNumber(modelArgs.mealsPerDay, 1, 6) ??
      selectNumber(previous.mealsPerDay, 1, 6) ??
      3,
    ...(targetToleranceCalories !== undefined && {
      targetToleranceCalories,
    }),
    ...(persistedMinimumProtein !== undefined && {
      minimumProteinGrams: Math.max(
        persistedMinimumProtein,
        minimumProteinGrams ?? 0,
      ),
    }),
    ...(excludedFoods.length > 0 && {
      excludedFoods,
    }),
    ...(excludedAllergens.length > 0 && {
      excludedAllergens,
    }),
    ...(lactoseFree && { lactoseFree: true }),
    ...(requirePackageLabelSafety && { requirePackageLabelSafety: true }),
    ...(Number.isFinite(budgetVndPerDay) && {
      budgetVndPerDay,
    }),
    ...(scope.scopedAdjustment && {
      allowedAdjustmentFoodIds: scope.ids,
      allowedAdjustmentFoodNames: unresolvedScope
        ? ["__missing_structured_plan__"]
        : scope.names,
    }),
  };

  return {
    args,
    previousMealPlan: previous.plan || null,
    scopedAdjustment: scope.scopedAdjustment,
  };
};
