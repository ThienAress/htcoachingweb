import { analyzeOtherAllergenText } from "./mealPlanAllergenInput";

export const EMPTY_MEAL_PLAN_PREFERENCES = Object.freeze({
  allergyStatus: null,
  allergens: [],
  otherAllergenText: "",
  budgetVndPerDay: null,
});

const ALLERGY_STATUSES = new Set(["none_known", "declared", "unsure"]);
const ALLERGEN_KEYS = new Set([
  "milk",
  "egg",
  "fish",
  "crustacean_shellfish",
  "tree_nut",
  "peanut",
  "wheat",
  "soy",
  "sesame",
]);

export const validateMealPlanPreferences = (preferences) => {
  const allergyStatus = preferences?.allergyStatus;
  const allergens = Array.isArray(preferences?.allergens)
    ? preferences.allergens
    : [];
  const otherAllergenText = String(
    preferences?.otherAllergenText || "",
  ).trim();
  const otherAnalysis = analyzeOtherAllergenText(otherAllergenText);
  const budget = preferences?.budgetVndPerDay ?? null;
  if (!ALLERGY_STATUSES.has(allergyStatus)) return { valid: false, code: "missing" };
  if (allergyStatus === "unsure") return { valid: false, code: "unsure" };
  if (
    new Set(allergens).size !== allergens.length ||
    allergens.some((item) => !ALLERGEN_KEYS.has(item)) ||
    (allergyStatus === "declared"
      ? allergens.length === 0 && !otherAllergenText
      : allergens.length > 0 || Boolean(otherAllergenText))
  ) {
    return { valid: false, code: "allergens" };
  }
  if (otherAnalysis.errorCode) {
    return { valid: false, code: otherAnalysis.errorCode };
  }
  if (otherAnalysis.hasUnmapped) return { valid: false, code: "other" };
  if (
    budget !== null &&
    (!Number.isInteger(budget) || budget < 30_000 || budget > 2_000_000)
  ) {
    return { valid: false, code: "budget" };
  }
  return { valid: true, code: null };
};

export const filterFoodsForMealPlan = (foods, preferences) => {
  const items = Array.isArray(foods) ? foods : [];
  if (preferences?.allergyStatus !== "declared") return items;
  const otherAnalysis = analyzeOtherAllergenText(
    preferences?.otherAllergenText || "",
  );
  if (
    otherAnalysis.errorCode ||
    otherAnalysis.hasUnmapped
  ) {
    return [];
  }
  const excluded = new Set([
    ...(preferences.allergens || []),
    ...otherAnalysis.majorKeys,
  ]);
  const specificExcluded = new Set(otherAnalysis.specificKeys);
  return items.filter((food) => {
    const profile = food?.allergenProfile;
    if (profile?.reviewStatus !== "reviewed") return false;
    const hasMajorRisk = [
      ...(profile.contains || []),
      ...(profile.mayContain || []),
    ].some(
      (allergen) => excluded.has(allergen),
    );
    if (hasMajorRisk) return false;
    if (specificExcluded.size === 0) return true;
    if (!(profile.reviewedScopes || []).includes("specific_foods")) {
      return false;
    }
    return !(profile.specificContains || []).some((key) =>
      specificExcluded.has(key),
    );
  });
};

const classifyFood = (food) => {
  const values = [
    ["protein", Number(food?.protein || 0)],
    ["carb", Number(food?.carb || 0)],
    ["fat", Number(food?.fat || 0)],
  ];
  return values.sort((left, right) => right[1] - left[1])[0][0];
};

export const hasMealPlanFoodCoverage = (foods) => {
  const groups = new Set((Array.isArray(foods) ? foods : []).map(classifyFood));
  return ["protein", "carb", "fat"].every((group) => groups.has(group));
};

const mealFoods = (meal) =>
  [meal?.proteinFood, meal?.carbFood, meal?.fatFood].filter(Boolean);

export const estimateMealPlanCost = (meals, budgetVndPerDay = null) => {
  const foods = (Array.isArray(meals) ? meals : []).flatMap(mealFoods);
  if (foods.length === 0) {
    return { coverageStatus: "unavailable", coveredFoods: 0, totalFoods: 0 };
  }
  const covered = foods.filter(
    (food) => food.marketPrice?.coverageStatus === "sufficient",
  );
  if (covered.length !== foods.length) {
    return {
      coverageStatus: "insufficient",
      coveredFoods: covered.length,
      totalFoods: foods.length,
    };
  }
  const sum = (key) =>
    Math.round(
      covered.reduce(
        (total, food) =>
          total +
          (Number(food.marketPrice[key]) * Number(food.amount || 0)) / 100,
        0,
      ),
    );
  const lowVndPerDay = sum("lowVndPer100g");
  const typicalVndPerDay = sum("typicalVndPer100g");
  const highVndPerDay = sum("highVndPer100g");
  const budgetStatus =
    budgetVndPerDay == null
      ? "not_set"
      : highVndPerDay <= budgetVndPerDay
        ? "within"
        : lowVndPerDay > budgetVndPerDay
          ? "above"
          : "uncertain";
  const asOf = covered
    .map((food) => food.marketPrice.asOf)
    .filter(Boolean)
    .sort()[0] || null;
  return {
    coverageStatus: "sufficient",
    coveredFoods: covered.length,
    totalFoods: foods.length,
    lowVndPerDay,
    typicalVndPerDay,
    highVndPerDay,
    budgetStatus,
    asOf,
    region: "ho_chi_minh",
  };
};
