import {
  isValidRecipeSeoSlug as validSlug,
  isRecipeSeoEligible,
  usefulRecipeIngredients as usefulIngredients,
  usefulRecipeInstructions as usefulInstructions,
} from "../src/seo/recipeSearchIndexPolicy.js";

export { isRecipeSeoEligible } from "../src/seo/recipeSearchIndexPolicy.js";

const scoreRecipe = (recipe) => {
  const ingredients = usefulIngredients(recipe.ingredients);
  const instructions = usefulInstructions(recipe.instructions);
  const measuredIngredients = ingredients.filter(
    (item) => String(item?.measure || "").trim(),
  );
  const instructionLength = instructions.reduce(
    (total, instruction) => total + instruction.length,
    0,
  );
  const additionalNutrition = Array.isArray(recipe.nutrition?.additional)
    ? recipe.nutrition.additional
    : [];

  return (
    Math.min(ingredients.length, 20) +
    Math.min(measuredIngredients.length, 20) +
    Math.min(instructions.length * 2, 20) +
    Math.min(Math.floor(instructionLength / 100), 15) +
    Math.min(additionalNutrition.length, 10)
  );
};

const validatePinnedSlugs = (pinnedSlugs) => {
  if (!Array.isArray(pinnedSlugs)) {
    throw new TypeError("pinnedSlugs must be an array");
  }
  const normalized = pinnedSlugs.map((slug) => String(slug || "").trim());
  if (normalized.some((slug) => !validSlug(slug))) {
    throw new Error("Invalid pinned recipe slug");
  }
  if (new Set(normalized).size !== normalized.length) {
    throw new Error("Duplicate pinned recipe slug");
  }
  return normalized;
};

export const selectRecipesForSeo = (
  recipes,
  {
    limit = 30,
    minimum = 20,
    strict = false,
    pinnedSlugs = [],
  } = {},
) => {
  const normalizedPinnedSlugs = validatePinnedSlugs(pinnedSlugs);
  const pinnedOrder = new Map(
    normalizedPinnedSlugs.map((slug, index) => [slug, index]),
  );
  const usePinnedOrder = normalizedPinnedSlugs.length > 0;
  const candidates = (Array.isArray(recipes) ? recipes : [])
    .filter(isRecipeSeoEligible)
    .filter((recipe) => !usePinnedOrder || pinnedOrder.has(recipe.slug))
    .map((recipe) => ({ recipe, score: scoreRecipe(recipe) }))
    .sort(
      (left, right) =>
        (usePinnedOrder
          ? pinnedOrder.get(left.recipe.slug) -
            pinnedOrder.get(right.recipe.slug)
          : right.score - left.score) ||
        String(left.recipe.slug).localeCompare(String(right.recipe.slug)),
    )
    .slice(0, limit)
    .map(({ recipe }) => recipe);

  if (strict && candidates.length < minimum) {
    throw new Error(
      `Recipe SEO selection requires at least ${minimum} quality candidates; found ${candidates.length}`,
    );
  }
  return candidates;
};
