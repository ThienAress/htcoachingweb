import { writeFile } from "node:fs/promises";
import path from "node:path";

const PRODUCTION_API_ORIGIN = "https://api.htcoachingweb.io.vn";
const PRODUCTION_RECIPES_PATH = "/api/recipes";
const PAGE_LIMIT = 50;
const OUTPUT_PATH = path.resolve(
  "docs/operations/production-recipes-for-nutrition.md",
);

const markdownEscape = (value) =>
  String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/([`*_{}\[\]<>])/g, "\\$1")
    .replace(/\s+/g, " ")
    .trim();

const recipeIdentity = (recipe) =>
  JSON.stringify([
    String(recipe.name || "").trim(),
    recipe.ingredients.map((ingredient) => [
      String(ingredient.name || "").trim(),
      String(ingredient.measure || "").trim(),
    ]),
  ]);

const fetchPageOnce = async (page) => {
  const url = new URL(PRODUCTION_RECIPES_PATH, PRODUCTION_API_ORIGIN);
  url.searchParams.set("view", "prerender");
  url.searchParams.set("page", String(page));
  url.searchParams.set("limit", String(PAGE_LIMIT));
  if (url.origin !== PRODUCTION_API_ORIGIN) {
    throw new Error("Production Recipe URL is outside the allowlisted origin");
  }

  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    throw new Error(`Production Recipe API returned HTTP ${response.status}`);
  }
  const payload = await response.json();
  if (!payload?.success || !Array.isArray(payload.data)) {
    throw new Error("Production Recipe API response is invalid");
  }
  return payload;
};

const fetchPage = async (page) => {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await fetchPageOnce(page);
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(
    `Production Recipe page ${page} failed after 3 attempts: ${lastError?.message}`,
  );
};

const validateRecipe = (recipe, index) => {
  const name = String(recipe?.name || "").trim();
  if (!name) throw new Error(`Production recipe ${index + 1} has an empty name`);
  if (!Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) {
    throw new Error(`Production recipe ${name} has no ingredients`);
  }
  recipe.ingredients.forEach((ingredient, ingredientIndex) => {
    if (!String(ingredient?.name || "").trim()) {
      throw new Error(
        `Production recipe ${name} has an empty ingredient at ${ingredientIndex + 1}`,
      );
    }
    if (typeof ingredient.measure !== "string") {
      throw new Error(
        `Production recipe ${name} has a non-string ingredient measure`,
      );
    }
  });
};

const fetchAllRecipes = async () => {
  const firstPage = await fetchPage(1);
  const expectedTotal = Number(firstPage.pagination?.total);
  const totalPages = Number(firstPage.pagination?.totalPages);
  if (!Number.isInteger(expectedTotal) || !Number.isInteger(totalPages)) {
    throw new Error("Production Recipe pagination is invalid");
  }

  const remainingPages = [];
  for (let firstPageNumber = 2; firstPageNumber <= totalPages; firstPageNumber += 3) {
    const pageNumbers = Array.from(
      { length: Math.min(3, totalPages - firstPageNumber + 1) },
      (_, index) => firstPageNumber + index,
    );
    const pagePayloads = await Promise.all(pageNumbers.map(fetchPage));
    if (
      pagePayloads.some(
        (payload) => Number(payload.pagination?.total) !== expectedTotal,
      )
    ) {
      throw new Error("Production Recipe count changed during export");
    }
    remainingPages.push(...pagePayloads);
  }
  const recipes = [
    ...firstPage.data,
    ...remainingPages.flatMap((payload) => payload.data),
  ];
  if (recipes.length !== expectedTotal) {
    throw new Error(
      `Production Recipe count mismatch: expected ${expectedTotal}, received ${recipes.length}`,
    );
  }
  recipes.forEach(validateRecipe);

  const identities = recipes.map(recipeIdentity);
  if (new Set(identities).size !== identities.length) {
    throw new Error(
      "Production Recipe catalog has duplicate name + ingredients identities",
    );
  }
  return recipes;
};

const renderCatalog = (recipes) => {
  const lines = [
    "# Danh sách công thức và nguyên liệu trên production",
    "",
    `Nguồn: \`${PRODUCTION_API_ORIGIN}${PRODUCTION_RECIPES_PATH}?view=prerender\``,
    `Ngày xuất: ${new Date().toISOString().slice(0, 10)}`,
    `Tổng số công thức: **${recipes.length}**`,
    "",
    "> Đây là snapshot public production chỉ gồm tên món và nguyên liệu. Khi trả JSON,",
    "> giữ nguyên chính tả, thứ tự, tên và định lượng nguyên liệu như trong file này.",
    "",
  ];

  recipes.forEach((recipe, index) => {
    const ordinal = String(index + 1).padStart(4, "0");
    lines.push(`## ${ordinal}. ${markdownEscape(recipe.name)}`, "");
    lines.push("### Nguyên liệu", "");
    recipe.ingredients.forEach((ingredient) => {
      const name = markdownEscape(ingredient.name);
      const measure = markdownEscape(ingredient.measure);
      lines.push(`- **${name}**${measure ? ` — ${measure}` : ""}`);
    });
    lines.push("");
  });

  return `${lines.join("\n")}\n`;
};

const recipes = await fetchAllRecipes();
await writeFile(OUTPUT_PATH, renderCatalog(recipes), "utf8");
process.stdout.write(
  `${JSON.stringify({ output: OUTPUT_PATH, recipes: recipes.length })}\n`,
);
