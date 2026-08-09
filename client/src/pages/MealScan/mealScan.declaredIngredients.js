export const MAX_DECLARED_INGREDIENTS = 8;
export const MAX_DECLARED_INGREDIENT_NAME_LENGTH = 80;
export const MAX_DECLARED_INGREDIENT_GRAMS = 3_000;

const roundGrams = (value) => Math.round(value * 10) / 10;

export const prepareDeclaredIngredients = (rows = []) => {
  if (!Array.isArray(rows) || rows.length > MAX_DECLARED_INGREDIENTS) {
    return { valid: false, code: "limit", ingredients: [] };
  }

  const ingredients = [];
  for (const row of rows) {
    const name = String(row?.name || "").trim().replace(/\s+/g, " ");
    const rawGrams = String(row?.grams ?? "").trim();

    if (!name && !rawGrams) continue;
    if (!name || !rawGrams) {
      return { valid: false, code: "incomplete", ingredients: [] };
    }
    if (name.length > MAX_DECLARED_INGREDIENT_NAME_LENGTH) {
      return { valid: false, code: "name", ingredients: [] };
    }

    const grams = Number(rawGrams);
    if (
      !Number.isFinite(grams) ||
      grams < 1 ||
      grams > MAX_DECLARED_INGREDIENT_GRAMS
    ) {
      return { valid: false, code: "grams", ingredients: [] };
    }

    ingredients.push({ name, grams: roundGrams(grams) });
  }

  return { valid: true, code: "", ingredients };
};
