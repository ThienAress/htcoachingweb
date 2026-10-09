const REQUIRED_BODYWEIGHT_CHEST_COUNT = 5;
const REQUIRED_SAFE_MEAL_FOOD_COUNT = 3;
const PRICE_FRESHNESS_DAYS = 90;
const DAY_MS = 86_400_000;
const PRICE_SOURCE_HOSTS = Object.freeze({
  bach_hoa_xanh: new Set(["bachhoaxanh.com", "www.bachhoaxanh.com"]),
  winmart: new Set(["winmart.vn", "www.winmart.vn"]),
  coop_online: new Set(["cooponline.vn", "www.cooponline.vn"]),
});
const ALLERGEN_SOURCE_HOSTS = new Set([
  "fdc.nal.usda.gov",
  "www.fda.gov",
  "www.fsis.usda.gov",
]);
const ALLERGEN_SOURCE_TYPES = new Set([
  "official_database",
  "manufacturer",
  "package_label",
]);

const normalize = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const isDisplacedFixture = (exercise) =>
  Boolean(exercise?._stagingSearchIndexCohortDisplaced) ||
  normalize(exercise?.name).startsWith("__plan079_displaced__");

const hasSupportedAllergenSource = (profile) => {
  try {
    const url = new URL(String(profile?.sourceUrl || ""));
    return ALLERGEN_SOURCE_TYPES.has(profile?.sourceType) &&
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      (
        profile.sourceType !== "official_database" ||
        ALLERGEN_SOURCE_HOSTS.has(url.hostname.toLowerCase())
      );
  } catch {
    return false;
  }
};

const hasReviewedAllergenProfile = (food, now) => {
  const profile = food?.allergenProfile;
  const reviewedAt = new Date(profile?.reviewedAt);
  return profile?.reviewStatus === "reviewed" &&
    hasSupportedAllergenSource(profile) &&
    !Number.isNaN(reviewedAt.getTime()) &&
    reviewedAt <= now &&
    Array.isArray(profile.contains) &&
    Array.isArray(profile.mayContain);
};

const isSafeForAcceptanceMeal = (food, now) => {
  if (!hasReviewedAllergenProfile(food, now)) return false;
  const allergens = new Set([
    ...(food.allergenProfile.contains || []),
    ...(food.allergenProfile.mayContain || []),
  ]);
  const label = normalize(food.label);
  return !allergens.has("peanut") &&
    !allergens.has("milk") &&
    !/dau phong|peanut|whey|sua/.test(label);
};

const dominantMacro = (food) => {
  const macros = [
    ["protein", Number(food?.protein)],
    ["carb", Number(food?.carb)],
    ["fat", Number(food?.fat)],
  ].filter(([, value]) => Number.isFinite(value) && value >= 0);
  if (macros.length !== 3) return null;
  return macros.sort((left, right) => right[1] - left[1])[0][0];
};

const hasSupportedPriceSource = (observation) => {
  try {
    const sourceKey = String(observation?.sourceKey || "");
    const url = new URL(String(observation?.sourceUrl || ""));
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      PRICE_SOURCE_HOSTS[sourceKey]?.has(url.hostname.toLowerCase()) === true;
  } catch {
    return false;
  }
};

const hasFreshPrice = (observation, now) => {
  const observedAt = new Date(observation?.observedAt);
  return hasSupportedPriceSource(observation) &&
    Number.isFinite(Number(observation?.packGrams)) &&
    Number(observation.packGrams) > 0 &&
    Number.isFinite(Number(observation?.regularPriceVnd)) &&
    Number(observation.regularPriceVnd) > 0 &&
    !Number.isNaN(observedAt.getTime()) &&
    observedAt <= now &&
    observedAt >= new Date(now.getTime() - PRICE_FRESHNESS_DAYS * DAY_MS);
};

export const evaluateStagingAiCatalogReadiness = ({
  exercises = [],
  foods = [],
  priceObservations = [],
  now = new Date(),
} = {}) => {
  const displacedFixtures = exercises.filter(isDisplacedFixture);
  const beginnerBodyweightChest = exercises.filter(
    (exercise) => !isDisplacedFixture(exercise) &&
      isBeginnerBodyweightChestExercise(exercise),
  );
  const safeFoods = foods.filter((food) => isSafeForAcceptanceMeal(food, now));
  const crossContactVerifiedSafeFoods = safeFoods.filter(({ allergenProfile }) =>
    ["package_label", "manufacturer"].includes(allergenProfile?.sourceType));
  const safeFoodIds = new Set(safeFoods.map(({ _id }) => String(_id)));
  const freshPricedFoodIds = new Set(
    priceObservations
      .filter((observation) =>
        safeFoodIds.has(String(observation?.foodId)) &&
        hasFreshPrice(observation, now),
      )
      .map(({ foodId }) => String(foodId)),
  );
  const safeMacroGroups = [
    ...new Set(safeFoods.map(dominantMacro).filter(Boolean)),
  ].sort();
  const safeFoodMacroGroupById = new Map(
    safeFoods.map((food) => [String(food._id), dominantMacro(food)]),
  );
  const freshPricedSafeMacroGroups = [
    ...new Set(
      [...freshPricedFoodIds]
        .map((foodId) => safeFoodMacroGroupById.get(foodId))
        .filter(Boolean),
    ),
  ].sort();
  const gaps = [];
  if (displacedFixtures.length > 0) {
    gaps.push("exercise_displaced_fixture_present");
  }
  if (beginnerBodyweightChest.length < REQUIRED_BODYWEIGHT_CHEST_COUNT) {
    gaps.push("exercise_beginner_bodyweight_chest_insufficient");
  }
  if (safeFoods.length < REQUIRED_SAFE_MEAL_FOOD_COUNT) {
    gaps.push("food_reviewed_allergen_coverage_insufficient");
  }
  if (["protein", "carb", "fat"].some((group) => !safeMacroGroups.includes(group))) {
    gaps.push("food_safe_macro_groups_incomplete");
  }
  if (freshPricedFoodIds.size < REQUIRED_SAFE_MEAL_FOOD_COUNT) {
    gaps.push("food_fresh_price_coverage_insufficient");
  }
  if (["protein", "carb", "fat"].some(
    (group) => !freshPricedSafeMacroGroups.includes(group),
  )) {
    gaps.push("food_fresh_price_macro_groups_incomplete");
  }
  return {
    ready: gaps.length === 0,
    gaps,
    metrics: {
      exerciseCount: exercises.length,
      displacedFixtures: displacedFixtures.length,
      beginnerBodyweightChest: beginnerBodyweightChest.length,
      foodCount: foods.length,
      safeMealFoods: safeFoods.length,
      ingredientVerifiedSafeMealFoods: safeFoods.length,
      crossContactVerifiedSafeMealFoods: crossContactVerifiedSafeFoods.length,
      freshPricedSafeMealFoods: freshPricedFoodIds.size,
      safeMacroGroups,
      freshPricedSafeMacroGroups,
    },
  };
};

const projectedRows = (db, collectionName, projection, filter = {}) =>
  db.collection(collectionName).find(filter, { projection }).toArray();

export const inspectStagingAiCatalogReadiness = async ({
  db,
  now = new Date(),
} = {}) => {
  if (!db || typeof db.collection !== "function") {
    throw new Error("staging AI catalog readiness requires a MongoDB handle");
  }
  const freshAfter = new Date(
    now.getTime() - PRICE_FRESHNESS_DAYS * DAY_MS,
  );
  const [exercises, foods, priceObservations] = await Promise.all([
    projectedRows(db, "exercises", {
      name: 1,
      muscleGroup: 1,
      description: 1,
      instructions: 1,
      _stagingSearchIndexCohortDisplaced: 1,
    }),
    projectedRows(db, "foods", {
      label: 1,
      protein: 1,
      carb: 1,
      fat: 1,
      allergenProfile: 1,
    }),
    projectedRows(
      db,
      "foodpriceobservations",
      {
        foodId: 1,
        sourceKey: 1,
        sourceUrl: 1,
        packGrams: 1,
        regularPriceVnd: 1,
        observedAt: 1,
      },
      { observedAt: { $gte: freshAfter, $lte: now } },
    ),
  ]);

  return evaluateStagingAiCatalogReadiness({
    exercises,
    foods,
    priceObservations,
    now,
  });
};
import {
  isBeginnerBodyweightChestExercise,
} from "../services/ai/exerciseCatalogCompatibility.js";
