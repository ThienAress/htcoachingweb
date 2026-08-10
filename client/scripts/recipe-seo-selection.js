const validSlug = (value) =>
  /^[a-z0-9][a-z0-9-]{0,159}$/i.test(String(value || "").trim());

const hasHttpsUrl = (value) => {
  try {
    return new URL(String(value || "")).protocol === "https:";
  } catch {
    return false;
  }
};

const usefulStrings = (items) =>
  Array.isArray(items)
    ? items.filter((item) => String(item?.name || item || "").trim().length >= 2)
    : [];

const eligibleRecipe = (recipe) =>
  validSlug(recipe?.slug) &&
  String(recipe?.name || "").trim().length >= 4 &&
  hasHttpsUrl(recipe?.thumbnail) &&
  usefulStrings(recipe?.ingredients).length >= 3 &&
  usefulStrings(recipe?.instructions).length >= 2;

const scoreRecipe = (recipe) => {
  let score = 0;
  if (["Việt Nam", "Vietnamese"].includes(recipe.area)) score += 8;
  if (["manual", "ai"].includes(recipe.source)) score += 6;
  if (hasHttpsUrl(recipe.sourceUrl)) score += 4;
  if (String(recipe.nameEn || "").trim()) score += 2;
  score += Math.min(usefulStrings(recipe.ingredients).length, 12);
  score += Math.min(usefulStrings(recipe.instructions).length, 10);
  score += Math.min(usefulStrings(recipe.tags).length, 5);
  return score;
};

export const selectRecipesForSeo = (
  recipes,
  { limit = 30, minimum = 20, strict = false } = {},
) => {
  const candidates = (Array.isArray(recipes) ? recipes : [])
    .filter(eligibleRecipe)
    .map((recipe) => ({ recipe, score: scoreRecipe(recipe) }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        String(right.recipe.updatedAt || "").localeCompare(
          String(left.recipe.updatedAt || ""),
        ) ||
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
