import Food from "../models/Food.js";
import { hasKnownFoodSource } from "./foodProvenance.js";
import { safeLog } from "../utils/safeLogger.js";

const NUTRIENT_KEYS = ["calories", "protein", "carb", "fat"];
const RANGE_KEYS = ["min", "estimate", "max"];
const PURE_FAT_ALIASES = new Set([
  "chat beo",
  "cooking oil",
  "dau",
  "dau an",
  "dau dua",
  "dau huong duong",
  "dau o liu",
  "dau olive",
  "dau thuc vat",
  "fat",
  "mo",
  "olive oil",
  "oil",
  "vegetable oil",
]);

const round = (value, decimals) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const exactRange = (value, decimals) => {
  const rounded = round(value, decimals);
  return { min: rounded, estimate: rounded, max: rounded };
};

const normalizeMatchText = (value) =>
  String(value || "")
    .trim()
    .toLocaleLowerCase("vi")
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const defaultFindFoodsByLabels = async (labels) => {
  if (labels.length === 0) return [];
  return Food.find({
    nutritionBasis: "per_100g",
    "source.type": { $ne: "legacy_unknown" },
    $or: labels.map((label) => ({
      label: { $regex: `^${escapeRegex(label)}$`, $options: "i" },
    })),
  })
    .limit(labels.length)
    .lean();
};

const finiteNonNegative = (value) =>
  Number.isFinite(Number(value)) && Number(value) >= 0;

const completeFoodNutrition = (food) =>
  food?.nutritionBasis === "per_100g" &&
  hasKnownFoodSource(food.source) &&
  NUTRIENT_KEYS.every((key) => finiteNonNegative(food[key]));

const unresolvedIngredient = (item) => ({
  name: item.name,
  grams: item.grams,
  status: "unresolved",
  includedInTotal: false,
  sourceType: "unresolved",
  canonicalName: "",
});

const pureFatIngredient = (item) => ({
  name: item.name,
  grams: item.grams,
  status: "included",
  includedInTotal: true,
  sourceType: "macro_formula",
  canonicalName: "pure_fat",
  calories: exactRange(item.grams * 9, 0),
  protein: exactRange(0, 1),
  carb: exactRange(0, 1),
  fat: exactRange(item.grams, 1),
});

const foodDatabaseIngredient = (item, food) => ({
  name: item.name,
  grams: item.grams,
  status: "included",
  includedInTotal: true,
  sourceType: "food_database",
  canonicalName: food.label,
  ...Object.fromEntries(
    NUTRIENT_KEYS.map((key) => [
      key,
      exactRange((Number(food[key]) * item.grams) / 100, key === "calories" ? 0 : 1),
    ]),
  ),
});

export const resolveDeclaredIngredients = async (
  declaredIngredients = [],
  { findFoodsByLabels = defaultFindFoodsByLabels } = {},
) => {
  const items = declaredIngredients.map((item) => ({
    name: String(item?.name || "").trim().replace(/\s+/g, " "),
    grams: round(Number(item?.grams) || 0, 1),
  }));
  const unresolvedNames = items
    .filter((item) => !PURE_FAT_ALIASES.has(normalizeMatchText(item.name)))
    .map((item) => item.name);

  let foods = [];
  if (unresolvedNames.length > 0) {
    try {
      foods = await findFoodsByLabels(unresolvedNames);
    } catch {
      safeLog.warn("meal_scan.declared_food_lookup_failed", "lookup_failed", {
        itemCount: unresolvedNames.length,
      });
    }
  }
  const foodsByName = new Map(
    foods
      .filter(completeFoodNutrition)
      .map((food) => [normalizeMatchText(food.label), food]),
  );

  return items.map((item) => {
    const normalizedName = normalizeMatchText(item.name);
    if (PURE_FAT_ALIASES.has(normalizedName)) return pureFatIngredient(item);
    const food = foodsByName.get(normalizedName);
    return food
      ? foodDatabaseIngredient(item, food)
      : unresolvedIngredient(item);
  });
};

export const excludeDeclaredIngredientDuplicates = (raw, declared = []) => {
  if (!Array.isArray(raw?.items) || declared.length === 0) return raw;
  const exactNames = new Set();
  let includesPureFat = false;
  for (const item of declared) {
    exactNames.add(normalizeMatchText(item.name));
    if (item.canonicalName === "pure_fat") includesPureFat = true;
    else if (item.canonicalName) exactNames.add(normalizeMatchText(item.canonicalName));
  }

  return {
    ...raw,
    items: raw.items.filter((item) => {
      const label = normalizeMatchText(item?.label);
      if (exactNames.has(label)) return false;
      return !(includesPureFat && PURE_FAT_ALIASES.has(label));
    }),
  };
};

const publicDeclaredIngredient = (item) => {
  const result = {
    name: item.name,
    grams: item.grams,
    status: item.status,
    includedInTotal: item.includedInTotal,
    sourceType: item.sourceType,
  };
  if (item.includedInTotal) {
    for (const key of NUTRIENT_KEYS) result[key] = item[key];
  }
  return result;
};

export const mergeDeclaredIngredientsIntoResult = (result, declared = []) => {
  const included = declared.filter((item) => item.includedInTotal);
  const total = Object.fromEntries(
    NUTRIENT_KEYS.map((key) => [
      key,
      Object.fromEntries(
        RANGE_KEYS.map((rangeKey) => [
          rangeKey,
          round(
            Number(result.total?.[key]?.[rangeKey] || 0) +
              included.reduce(
                (sum, item) => sum + Number(item[key]?.[rangeKey] || 0),
                0,
              ),
            key === "calories" ? 0 : 1,
          ),
        ]),
      ),
    ]),
  );

  return {
    ...result,
    total,
    declaredIngredients: declared.map(publicDeclaredIngredient),
  };
};
