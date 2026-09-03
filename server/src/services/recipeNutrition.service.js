import {
  CORE_RECIPE_NUTRITION_FIELDS,
  MAX_ADDITIONAL_RECIPE_NUTRIENTS,
  RECIPE_NUTRITION_UNITS,
  RESERVED_RECIPE_NUTRITION_LABELS,
} from "../constants/recipeNutrition.js";

const nutritionUnits = new Set(RECIPE_NUTRITION_UNITS);
const MILLIGRAMS_PER_GRAM = 1000;

const normalizeAdditionalNutritionUnit = ({ label, unit, value }) =>
  unit === "mg"
    ? { label, unit: "g", value: value / MILLIGRAMS_PER_GRAM }
    : { label, unit, value };

export const normalizeStoredRecipeNutritionUnits = (nutrition) => {
  if (!nutrition || typeof nutrition !== "object") return nutrition;
  const plainNutrition =
    typeof nutrition.toObject === "function" ? nutrition.toObject() : nutrition;
  return {
    ...plainNutrition,
    additional: (plainNutrition.additional || []).map((item) =>
      normalizeAdditionalNutritionUnit(item),
    ),
  };
};

export const toPublicRecipeNutrition = (nutrition) => {
  if (
    !nutrition ||
    CORE_RECIPE_NUTRITION_FIELDS.some((field) => nutrition[field] == null)
  ) {
    return {
      status: "unavailable",
      source: "admin_manual",
      scope: "whole_recipe",
      values: {},
      additional: [],
    };
  }

  const normalized = normalizeStoredRecipeNutritionUnits(nutrition);
  return {
    status: "available",
    source: "admin_manual",
    scope: "whole_recipe",
    values: Object.fromEntries(
      CORE_RECIPE_NUTRITION_FIELDS.map((field) => [field, normalized[field]]),
    ),
    additional: normalized.additional,
  };
};

export const normalizeManualRecipeNutrition = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("nutrition must be an object");
  }

  const nutrition = { scope: "whole_recipe", source: "admin_manual" };
  for (const field of CORE_RECIPE_NUTRITION_FIELDS) {
    if (
      typeof value[field] !== "number" ||
      !Number.isFinite(value[field]) ||
      value[field] < 0
    ) {
      throw new TypeError(`${field} must be a non-negative number`);
    }
    nutrition[field] = value[field];
  }

  if (value.additional !== undefined && !Array.isArray(value.additional)) {
    throw new TypeError("nutrition.additional must be an array");
  }

  const labels = new Set();
  nutrition.additional = (value.additional || []).map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new TypeError("additional nutrition item is invalid");
    }
    if (typeof item.label !== "string") {
      throw new TypeError("additional nutrition label must be a string");
    }
    const label = item.label.trim();
    const normalizedLabel = label.toLocaleLowerCase("vi");
    if (
      !label ||
      label.length > 80 ||
      labels.has(normalizedLabel) ||
      RESERVED_RECIPE_NUTRITION_LABELS.has(normalizedLabel)
    ) {
      throw new TypeError("additional nutrition label is invalid or duplicated");
    }
    if (!nutritionUnits.has(item.unit)) {
      throw new TypeError("additional nutrition unit is invalid");
    }
    if (
      typeof item.value !== "number" ||
      !Number.isFinite(item.value) ||
      item.value < 0
    ) {
      throw new TypeError("additional nutrition value is invalid");
    }
    labels.add(normalizedLabel);
    return normalizeAdditionalNutritionUnit({
      label,
      unit: item.unit,
      value: item.value,
    });
  });

  if (nutrition.additional.length > MAX_ADDITIONAL_RECIPE_NUTRIENTS) {
    throw new TypeError(
      `nutrition.additional supports at most ${MAX_ADDITIONAL_RECIPE_NUTRIENTS} items`,
    );
  }

  return nutrition;
};
