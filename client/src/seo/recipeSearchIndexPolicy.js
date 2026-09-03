const CORE_NUTRITION_FIELDS = [
  "calories",
  "protein",
  "fat",
  "carb",
  "sugars",
  "salt",
];

export const isValidRecipeSeoSlug = (value) => {
  const slug = String(value || "").trim();
  return slug.length <= 180 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
};

const hasHttpsUrl = (value) => {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
};

export const usefulRecipeIngredients = (items) =>
  Array.isArray(items)
    ? items.filter((item) => String(item?.name || "").trim().length >= 2)
    : [];

export const usefulRecipeInstructions = (items) =>
  Array.isArray(items)
    ? items
        .map((item) => String(item || "").trim())
        .filter((item) => item.length >= 20)
    : [];

const nutritionValues = (nutrition) => {
  if (!nutrition || typeof nutrition !== "object") return null;
  if (Object.hasOwn(nutrition, "status")) {
    if (nutrition.status !== "available") return null;
    return nutrition.values;
  }
  return nutrition;
};

const hasCompleteNutrition = (nutrition) => {
  const values = nutritionValues(nutrition);
  return (
    nutrition?.scope === "whole_recipe" &&
    nutrition?.source === "admin_manual" &&
    values &&
    CORE_NUTRITION_FIELDS.every(
      (field) =>
        typeof values[field] === "number" &&
        Number.isFinite(values[field]) &&
        values[field] >= 0,
    ) &&
    values.calories > 0
  );
};

export const isRecipeSeoEligible = (recipe) => {
  const ingredients = usefulRecipeIngredients(recipe?.ingredients);
  const instructions = usefulRecipeInstructions(recipe?.instructions);
  const measuredIngredients = ingredients.filter(
    (item) => String(item?.measure || "").trim().length >= 1,
  );
  const instructionLength = instructions.reduce(
    (total, instruction) => total + instruction.length,
    0,
  );

  return (
    isValidRecipeSeoSlug(recipe?.slug) &&
    String(recipe?.name || "").trim().length >= 4 &&
    hasHttpsUrl(recipe?.thumbnail) &&
    hasHttpsUrl(recipe?.sourceUrl) &&
    ingredients.length >= 3 &&
    measuredIngredients.length >= 2 &&
    instructions.length >= 2 &&
    instructionLength >= 300 &&
    hasCompleteNutrition(recipe?.nutrition)
  );
};
