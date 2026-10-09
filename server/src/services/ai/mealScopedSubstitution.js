import {
  foodMatchesMealPhrase,
  parseMealRequirements,
} from "./mealConstraints.js";

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

const escapePattern = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const mealPhrasePattern = (mealLabel) => {
  const phrase = normalizeText(mealLabel).replace(/[.,]/g, " ").trim();
  if (phrase.split(" ").filter(Boolean).length < 2) return null;
  return new RegExp(
    `\\b${escapePattern(phrase).replace(/\\ /g, "\\s+")}\\b`,
    "g",
  );
};

const stripMealPhrases = (value, mealLabels) => mealLabels.reduce(
  (result, label) => {
    const pattern = mealPhrasePattern(label);
    return pattern
      ? result.replace(
          new RegExp(`\\b(?:o|trong)?\\s*${pattern.source}`, "g"),
          " ",
        )
      : result;
  },
  value,
).replace(/\s+/g, " ").trim();

const explicitMealIndices = (message, meals) => {
  const text = normalizeText(message).replace(/[.,]/g, " ");
  return meals.flatMap((meal, mealIndex) => {
    const pattern = mealPhrasePattern(meal?.label);
    return pattern?.test(text) ? [mealIndex] : [];
  });
};

const requestsMacroPreservation = (message) => {
  const text = normalizeText(message);
  return /\b(?:giu nguyen|khong (?:duoc )?(?:doi|thay doi))\s+(?:cac\s+)?(?:tong\s+)?(?:macro|protein|carbs?|carbohydrate|fat|chat dam|tinh bot|chat beo)\b/.test(text);
};

const stripTrailingPreservationClause = (value) => value
  .replace(
    /\s+(?:nhung|dong thoi|va)\s+(?:giu nguyen|khong (?:duoc )?(?:doi|thay doi))\b.*$/,
    "",
  )
  .trim();

const parseSubstitution = (message, mealLabels = []) => {
  const text = normalizeText(message);
  const match = text.match(
    /\b(?:chi\s+)?(?:thay|doi)\s+(?:phan|mon\s+)?(.+?)\s+(?:bang|thanh|sang)\s+([^.!?;,]+)/,
  );
  if (!match) return null;
  const sourceFoods = parseMealRequirements(
    stripMealPhrases(match[1], mealLabels),
  ).phrases;
  const requestedReplacementFoods = parseMealRequirements(
    stripTrailingPreservationClause(stripMealPhrases(match[2], mealLabels)),
  ).phrases;
  const preserveMacros = requestsMacroPreservation(message);
  if (sourceFoods.length !== 1 || requestedReplacementFoods.length < 1) {
    return {
      status: "invalid_request",
      sourceFoods,
      requestedReplacementFoods,
      ...(preserveMacros ? { preserveMacros: true } : {}),
    };
  }
  return {
    sourceFoods,
    requestedReplacementFoods,
    ...(preserveMacros ? { preserveMacros: true } : {}),
  };
};

export const resolveScopedMealSubstitution = (message, previousMealPlan) => {
  const meals = Array.isArray(previousMealPlan?.meals)
    ? previousMealPlan.meals
    : [];
  const parsed = parseSubstitution(message, meals.map((meal) => meal?.label));
  if (!parsed || parsed.status) return parsed;
  if (meals.length === 0) {
    return { status: "missing_plan", ...parsed };
  }
  const sourceRequirement = parseMealRequirements(parsed.sourceFoods).items[0];
  const matches = meals.flatMap((meal, mealIndex) =>
    (Array.isArray(meal?.foods) ? meal.foods : []).flatMap((food, foodIndex) =>
      foodMatchesMealPhrase(food, sourceRequirement)
        ? [{ mealIndex, foodIndex, foodId: String(food?.foodId || "") }]
        : []));
  if (matches.length === 0) {
    return { status: "source_absent", ...parsed };
  }
  const namedMealIndices = explicitMealIndices(message, meals);
  if (namedMealIndices.length > 0) {
    const uniqueMealIndices = [...new Set(namedMealIndices)];
    const scopedMatches = uniqueMealIndices.length === 1
      ? matches.filter((match) => match.mealIndex === uniqueMealIndices[0])
      : [];
    if (scopedMatches.length === 0 && uniqueMealIndices.length === 1) {
      return { status: "source_absent", ...parsed };
    }
    if (scopedMatches.length !== 1) {
      return { status: "source_ambiguous", ...parsed };
    }
    const { foodId: _foodId, ...location } = scopedMatches[0];
    return { status: "ready", ...location, ...parsed };
  }
  if (matches.length === 1) {
    const { foodId: _foodId, ...location } = matches[0];
    return { status: "ready", ...location, ...parsed };
  }
  const sourceFoodIds = new Set(matches.map((match) => match.foodId).filter(Boolean));
  if (sourceFoodIds.size !== 1 || matches.some((match) => !match.foodId)) {
    return { status: "source_ambiguous", ...parsed };
  }
  return {
    status: "ready",
    matches: matches.map(({ foodId: _foodId, ...location }) => location),
    sourceFoodId: [...sourceFoodIds][0],
    ...parsed,
  };
};
