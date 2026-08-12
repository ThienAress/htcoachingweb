import {
  analyzeOtherAllergenText,
  normalizeFoodCatalogLabel,
} from "./mealPlanAllergenInput.js";

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
const MAJOR_ALLERGEN_LABEL_PHRASES = Object.freeze({
  milk: ["sữa", "phô mai", "pho mát", "whey", "casein", "bơ sữa", "bơ động vật"],
  egg: ["trứng", "lòng đỏ", "lòng trắng"],
  fish: ["cá"],
  crustacean_shellfish: ["tôm", "cua", "tép", "ghẹ"],
  tree_nut: [
    "hạt điều",
    "hạt dẻ",
    "hạnh nhân",
    "óc chó",
    "mắc ca",
    "macadamia",
    "pistachio",
    "hazelnut",
  ],
  peanut: ["đậu phộng", "lạc"],
  wheat: ["lúa mì", "bột mì", "mì"],
  soy: ["đậu nành", "đậu tương", "đậu phụ", "đậu hũ", "tofu"],
  sesame: ["mè", "vừng"],
});
const SPECIFIC_FOOD_LABEL_TOKENS = Object.freeze({
  beef: ["bo"],
  chicken: ["ga"],
  pork: ["heo", "lon"],
  duck: ["vit"],
  goat: ["de"],
  lamb: ["cuu"],
});

export const isMealPlanAllergyLocked = (preferences) =>
  preferences?.allergyStatus === "unsure";

export const isMealPlanPreferenceConfirmed = (preferences) =>
  preferences?.allergyStatus === "none_known" ||
  preferences?.allergyStatus === "declared";

const normalizeFoodLabelTokens = (value) =>
  String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("vi")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/gu, "d")
    .split(/[^a-z0-9]+/u)
    .filter(Boolean);

const normalizeFoodLabel = (value) =>
  String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("vi")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();

const inferMajorAllergenKeys = (food) => {
  const label = normalizeFoodLabel(food?.label || food?.name || "");
  if (!label) return new Set();
  const paddedLabel = ` ${label} `;
  return new Set(
    Object.entries(MAJOR_ALLERGEN_LABEL_PHRASES)
      .filter(([, phrases]) =>
        phrases.some((phrase) =>
          paddedLabel.includes(` ${normalizeFoodLabel(phrase)} `),
        ),
      )
      .map(([key]) => key),
  );
};

const inferSpecificFoodKeys = (food) => {
  const tokens = new Set(
    normalizeFoodLabelTokens(food?.label || food?.name || ""),
  );
  if (tokens.size === 0) return null;
  return new Set(
    Object.entries(SPECIFIC_FOOD_LABEL_TOKENS)
      .filter(([, aliases]) => aliases.some((alias) => tokens.has(alias)))
      .map(([key]) => key),
  );
};

export const validateMealPlanPreferences = (preferences, foods = []) => {
  const allergyStatus = preferences?.allergyStatus;
  const allergens = Array.isArray(preferences?.allergens)
    ? preferences.allergens
    : [];
  const otherAllergenText = String(
    preferences?.otherAllergenText || "",
  ).trim();
  const otherAnalysis = analyzeOtherAllergenText(otherAllergenText, foods);
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
    items,
  );
  if (otherAnalysis.errorCode) {
    return [];
  }
  const excluded = new Set([
    ...(preferences.allergens || []),
    ...otherAnalysis.majorKeys,
  ]);
  const specificExcluded = new Set(otherAnalysis.specificKeys);
  const catalogFoodLabelsExcluded = new Set(
    otherAnalysis.catalogFoodLabels.map(normalizeFoodCatalogLabel),
  );
  return items.filter((food) => {
    const profile = food?.allergenProfile;
    const hasMajorRisk = [
      ...(profile?.contains || []),
      ...(profile?.mayContain || []),
      ...inferMajorAllergenKeys(food),
    ].some(
      (allergen) => excluded.has(allergen),
    );
    if (hasMajorRisk) return false;
    if (
      catalogFoodLabelsExcluded.has(
        normalizeFoodCatalogLabel(food?.label || food?.name || ""),
      )
    ) {
      return false;
    }
    if (specificExcluded.size === 0) return true;
    const specificContains = (profile?.reviewedScopes || []).includes(
      "specific_foods",
    )
      ? profile?.specificContains || []
      : [...(inferSpecificFoodKeys(food) || [])];
    return !specificContains.some((key) =>
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
