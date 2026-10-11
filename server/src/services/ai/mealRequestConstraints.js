import { parseMealRequirements } from "./mealConstraints.js";
import { resolveScopedMealSubstitution } from "./mealScopedSubstitution.js";

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

const explicitCalories = (text, minimumCalories) => {
  const matches = text.matchAll(/\b(\d{1,2}(?:[.,]\d{3})+|\d{3,4})\s*(?:kcal|calo)\b/g);
  for (const match of matches) {
    const value = finiteInRange(localizedInteger(match[1]), minimumCalories, 6000);
    return { found: true, value };
  }
  return { found: false, value: null };
};

const explicitMinimumProtein = (text) => {
  const match = text.match(/\b(?:it nhat|toi thieu|minimum)\s*(\d{1,3}(?:[.,]\d+)?)\s*(?:g|gram)\s*protein\b/);
  return match ? finiteInRange(match[1].replace(",", "."), 0, 500) : null;
};

const explicitTolerance = (text) => firstMatchNumber(
  text,
  /\bsai so(?: toi da)?\s*(?:[±+\-]\s*)?(\d{1,3}(?:[.,]\d+)?)\s*(?:kcal|calo)?\b/,
  0,
  300,
);

const explicitMealCount = (text) => firstMatchNumber(
  text,
  /\b(?:chia\s+)?([1-6])\s*bua\b/,
  1,
  6,
);

const explicitCalorieScope = (text) =>
  /\b(?:ca|moi|1|mot)\s+ngay\b|\bper\s+day\b|\bdaily\b/.test(text)
    ? "per_day"
    : /\b(?:chi\s+)?(?:1|mot)\s+bua\b/.test(text) ||
  /\b(?:bua\s+(?:sang|trua|toi)|per\s+meal|single\s+meal)\b/.test(text)
    ? "per_meal"
    : undefined;

const isMealFollowUp = (text, previous) =>
  Boolean(previous?.plan || previous?.targetCalories) &&
  /\b(?:giu|doi|thay|dieu chinh|them|bot|mon nay|bua nay|vua roi)\b/.test(text);

const explicitMacro = (text, names, maximum) => {
  const match = text.match(new RegExp(`\\b(\\d{1,3}(?:[.,]\\d+)?)\\s*(?:g|gram)\\s*(?:${names})\\b`));
  if (!match) return null;
  return finiteInRange(match[1].replace(",", "."), 0, maximum);
};

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

const EXPLICIT_EXCLUSION_PATTERNS = [
  ["thịt gà", ["thit ga", "uc ga", "ga"]],
  ["trứng", ["trung ga", "trung"]],
  ["sữa", ["sua chua", "sua"]],
  ["whey", ["bot whey", "whey"]],
];
const EXCLUSION_PREFIX = /(?:khong\s+(?:an|dung|su\s+dung)|tranh|loai\s+(?:bo|ra))\s+/g;
const EXCLUSION_STOP_WORDS = /\b(?:nhung|tuy\s+nhien|ma\s+van)\b/;
const EXCLUSION_LIST_SEPARATOR = /\s*(?:,|\b(?:va|hoac|hay|cung|voi)\b)\s*/;

const explicitExcludedFoods = (text) => {
  const excluded = new Set();
  const sentences = String(text || "").split(/[.!?;]/u);
  for (const sentence of sentences) {
    const beforeContrast = sentence.split(EXCLUSION_STOP_WORDS, 1)[0];
    const matches = [...beforeContrast.matchAll(EXCLUSION_PREFIX)];
    for (const [index, match] of matches.entries()) {
      const start = match.index + match[0].length;
      const end = matches[index + 1]?.index ?? beforeContrast.length;
      const body = beforeContrast.slice(start, end);
      for (const item of body.split(EXCLUSION_LIST_SEPARATOR)) {
        const normalizedItem = item.trim();
        if (!normalizedItem) continue;
        for (const [food, aliases] of EXPLICIT_EXCLUSION_PATTERNS) {
          if (aliases.some((alias) => containsBoundedPhrase(normalizedItem, alias))) {
            excluded.add(food);
          }
        }
      }
    }
  }
  return [...excluded];
};

const containsBoundedPhrase = (text, phrase) => {
  if (!phrase) return false;
  return ` ${text} `.includes(` ${phrase} `);
};

const REQUIRED_FOOD_PATTERN = /\b(?:bat buoc(?: phai)? co|phai co|nhat dinh co|mon bat buoc(?: la| gom)?|thuc pham bat buoc(?: la| gom)?|must include|required foods?(?: are| include)?)\s+([^.!?;]+)/g;
const REQUIRED_FOOD_STOP = /\s*,?\s*\b(?:nhung|khong|tranh|loai bo|di ung|ghi|chia\s+[1-6]\s+bua|sai so|ngan sach|it nhat|toi thieu|[1-6]\s+meals?)\b/;
const NEGATED_REQUIRED_FOOD_PREFIX = /\b(?:khong|khong can|khong nhat thiet)\s*$/;
const BARE_REQUIRED_FOOD_PATTERN = /\bco\s+([^.!?;]+)/g;
const NON_FOOD_BARE_PREFIX = /^(?:the|nen|can|duoc|khoang|it nhat|toi thieu|\d)\b/;

const appendRequiredFoodMatches = (text, pattern, phrases, { bare = false } = {}) => {
  for (const match of text.matchAll(pattern)) {
    const prefix = text.slice(0, match.index);
    if (NEGATED_REQUIRED_FOOD_PREFIX.test(prefix)) continue;
    const clause = match[1]
      .split(REQUIRED_FOOD_STOP, 1)[0]
      .replace(/,+$/u, "")
      .trim();
    if (!clause || (bare && NON_FOOD_BARE_PREFIX.test(clause))) continue;
    const items = clause
      .split(/\s*(?:,|\b(?:va|hoac|and|or)\b)\s*/)
      .filter(Boolean);
    phrases.push(...parseMealRequirements(items).phrases);
  }
};

const explicitRequiredFoods = (text) => {
  const phrases = [];
  appendRequiredFoodMatches(text, REQUIRED_FOOD_PATTERN, phrases);
  if (/\b(?:thuc don|meal plan)\b/.test(text)) {
    appendRequiredFoodMatches(text, BARE_REQUIRED_FOOD_PATTERN, phrases, {
      bare: true,
    });
  }
  return boundedStringList(phrases, 12, 100);
};

const requiredFoodReplacement = (text) => {
  const match = text.match(
    /\b(?:thay|doi)\s+(.+?)\s+(?:bang|thanh|sang)\s+([^.!?;,]+)/,
  );
  if (!match) return { removed: [], added: [] };
  return {
    removed: parseMealRequirements(
      match[1].replace(/^(?:phan|mon|phần|món)\s+/iu, ""),
    ).phrases,
    added: parseMealRequirements(match[2]).phrases,
  };
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
  const normalizedScope = normalizeText(boundedScope);
  const scopeTerms = normalizedScope
    .split(/\s*(?:,|\b(?:va|hoac|hay)\b)\s*/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 3);
  const seen = new Set();
  const foods = (Array.isArray(plan?.meals) ? plan.meals : [])
    .flatMap((meal) => Array.isArray(meal?.foods) ? meal.foods : [])
    .filter((food) => {
      const key = String(food?.foodId || food?.name || "");
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  const normalizedFoods = foods.map((food) => ({
    food,
    name: normalizeText(food?.name),
    id: normalizeText(food?.foodId),
  }));
  const selected = normalizedFoods
    .filter(({ name, id }) => {
      if (containsBoundedPhrase(normalizedScope, name) ||
        containsBoundedPhrase(normalizedScope, id)) return true;
      // A short noun such as "cơm" or "dầu" may be the user's canonical
      // label for a longer catalog name. Accept it only as a unique complete
      // phrase/prefix; never select by an arbitrary token shared by multiple
      // foods.
      return scopeTerms.some((term) => {
        const candidates = normalizedFoods.filter((candidate) =>
          candidate.name === term || candidate.id === term ||
          candidate.name.startsWith(`${term} `) ||
          candidate.id.startsWith(`${term} `),
        );
        return candidates.length === 1 &&
          (name === candidates[0].name && id === candidates[0].id);
      });
    })
    .map(({ food }) => food);
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

const balanceFlexibleMacros = (
  targetCalories,
  protein,
  carb,
  fat,
  { preserveCarb = false, preserveFat = false } = {},
) => {
  if (!Number.isFinite(targetCalories) || !Number.isFinite(protein)) {
    return { carb, fat };
  }
  const remainingCalories = Math.max(0, targetCalories - 4 * protein);
  if (preserveCarb && preserveFat && Number.isFinite(carb) && Number.isFinite(fat)) {
    return { carb, fat };
  }
  if (preserveCarb && Number.isFinite(carb)) {
    return {
      carb,
      fat: Number(Math.max(0, (remainingCalories - 4 * carb) / 9).toFixed(1)),
    };
  }
  if (preserveFat && Number.isFinite(fat)) {
    return {
      carb: Number(Math.max(0, (remainingCalories - 9 * fat) / 4).toFixed(1)),
      fat,
    };
  }
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
  const saved = lastMeal && typeof lastMeal === "object" ? lastMeal : {};
  const explicitScope = explicitCalorieScope(text);
  const followUp = isMealFollowUp(text, saved);
  const calorieScope = explicitScope === "per_day" ? "per_day"
    : followUp ? (saved.calorieScope === "per_meal" ? "per_meal" : "per_day")
      : explicitScope ?? "per_day";
  // A new meal cannot inherit a whole day's macros or count. Retain safety
  // exclusions across the scope transition, but not numerical targets.
  const previous = (saved.calorieScope || "per_day") === calorieScope ? saved : {
    excludedFoods: saved.excludedFoods, excludedAllergens: saved.excludedAllergens,
    lactoseFree: saved.lactoseFree, requirePackageLabelSafety: saved.requirePackageLabelSafety,
  };
  const minimumCalories = calorieScope === "per_meal" ? 500 : 800;
  const requestedCalories = explicitCalories(text, minimumCalories);
  const requestedMinimumProtein = explicitMinimumProtein(text);
  const requestedProtein = explicitMacro(text, "protein", 500);
  const requestedCarb = explicitMacro(text, "carb(?:s|ohydrate)?", 1000);
  const requestedFat = explicitMacro(text, "fat", 300);
  const modelTargetCalories = selectNumber(modelArgs.targetCalories, minimumCalories, 6000);
  const targetCalories = requestedCalories.found
    ? requestedCalories.value
    : modelTargetCalories ??
    selectNumber(previous.targetCalories, minimumCalories, 6000);
  const minimumProteinGrams = requestedMinimumProtein ??
    selectNumber(modelArgs.minimumProteinGrams, 0, 500) ??
    selectNumber(previous.plan?.targets?.minimumProteinGrams, 0, 500) ??
    selectNumber(previous.proteinGrams, 0, 500);
  const suppliedProtein = requestedProtein ??
    selectNumber(modelArgs.proteinGrams, 0, 500) ??
    selectNumber(previous.proteinGrams, 0, 500) ??
    minimumProteinGrams;
  const defaultProtein = calorieScope === "per_meal" && Number.isFinite(targetCalories)
    ? Number((targetCalories * 0.3 / 4).toFixed(1))
    : undefined;
  const proteinGrams = Math.max(
    suppliedProtein ?? defaultProtein ?? 0,
    minimumProteinGrams ?? 0,
  );
  const suppliedCarb = requestedCarb ??
    selectNumber(modelArgs.carbGrams, 0, 1000) ??
    selectNumber(previous.carbGrams, 0, 1000);
  const suppliedFat = requestedFat ??
    selectNumber(modelArgs.fatGrams, 0, 300) ??
    selectNumber(previous.fatGrams, 0, 300);
  const scope = adjustmentScope(text, previous.plan);
  const completeSingleMealMacros = calorieScope === "per_meal" &&
    Number.isFinite(targetCalories) && proteinGrams > 0 &&
    (suppliedCarb === undefined || suppliedFat === undefined);
  const hasCompleteSuppliedMacros = [suppliedProtein, suppliedCarb, suppliedFat]
    .every(Number.isFinite);
  const shouldRebalance = calorieScope !== "per_meal" &&
    !scope.scopedAdjustment &&
    requestedCalories.value !== null &&
    requestedCalories.value !== modelTargetCalories &&
    (requestedProtein !== null || requestedCarb !== null ||
      requestedFat !== null || !hasCompleteSuppliedMacros);
  const balanced = shouldRebalance || completeSingleMealMacros
    ? balanceFlexibleMacros(
        targetCalories,
        proteinGrams,
        suppliedCarb,
        suppliedFat,
        {
          preserveCarb: requestedCarb !== null,
          preserveFat: requestedFat !== null,
        },
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
  const replacement = requiredFoodReplacement(text);
  const rememberedRequiredFoods = followUp
    ? parseMealRequirements(boundedStringList(saved.requiredFoods)).phrases
      .filter((phrase) => !replacement.removed.includes(phrase))
    : [];
  const modelRequiredFoods = parseMealRequirements(
    boundedStringList(modelArgs.requiredFoods),
  ).phrases.filter((phrase) => !replacement.removed.includes(phrase));
  const requiredFoods = parseMealRequirements(boundedStringList([
    ...rememberedRequiredFoods,
    ...modelRequiredFoods,
    ...explicitRequiredFoods(text),
    ...replacement.added,
  ], 12, 100)).phrases
    .slice(0, 12);
  const mealsPerDay = explicitMealCount(text) ??
    (calorieScope === "per_meal" ? 1 : undefined) ??
    selectNumber(modelArgs.mealsPerDay, 1, 6) ??
    selectNumber(previous.mealsPerDay, 1, 6) ??
    (calorieScope === "per_meal" ? 1 : 3);
  const args = {
    targetCalories,
    calorieScope,
    proteinGrams,
    carbGrams: balanced.carb,
    fatGrams: balanced.fat,
    mealsPerDay,
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
    ...(requiredFoods.length > 0 && {
      requiredFoods,
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
    validationMessage: requestedCalories.found && requestedCalories.value === null
      ? `Công cụ hiện hỗ trợ mục tiêu từ ${minimumCalories} đến 6000 kcal ${
        calorieScope === "per_meal" ? "cho một bữa" : "mỗi ngày"
      }. Mục tiêu bạn nêu nằm ngoài giới hạn này nên tôi chưa thể tạo thực đơn có tổng được kiểm chứng. ` +
        "Bạn có muốn chọn mục tiêu trong khoảng hỗ trợ không?"
      : null,
    previousMealPlan: previous.plan || null,
    scopedAdjustment: scope.scopedAdjustment,
    scopedSubstitution: resolveScopedMealSubstitution(message, previous.plan),
  };
};
