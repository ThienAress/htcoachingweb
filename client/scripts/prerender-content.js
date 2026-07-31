import { mapWithConcurrency } from "./prerender-routes.js";

const PAGE_SIZE = 50;
const PAGE_CONCURRENCY = 4;
const MAX_PAGES = 1_000;

const recipePagePath = (page) =>
  `/recipes?limit=${PAGE_SIZE}&page=${page}&view=prerender`;

const parsePage = (response, expectedPage) => {
  const items = response?.data?.data;
  const pagination = response?.data?.pagination;
  const parsed = {
    total: Number(pagination?.total),
    page: Number(pagination?.page),
    limit: Number(pagination?.limit),
    totalPages: Number(pagination?.totalPages),
  };
  if (
    !Array.isArray(items) ||
    !Number.isSafeInteger(parsed.total) ||
    parsed.total < 0 ||
    parsed.page !== expectedPage ||
    parsed.limit !== PAGE_SIZE ||
    !Number.isSafeInteger(parsed.totalPages) ||
    parsed.totalPages < 0 ||
    parsed.totalPages > MAX_PAGES ||
    parsed.totalPages !== Math.ceil(parsed.total / parsed.limit) ||
    items.length > parsed.limit
  ) {
    throw new Error("Prerender recipe pagination is invalid");
  }
  return { items, pagination: parsed };
};

export const fetchPrerenderRecipes = async (fetchApi) => {
  const first = parsePage(await fetchApi(recipePagePath(1)), 1);
  const remainingPages = Array.from(
    { length: Math.max(first.pagination.totalPages - 1, 0) },
    (_, index) => index + 2,
  );
  const remaining = await mapWithConcurrency(
    remainingPages,
    PAGE_CONCURRENCY,
    async (page) => parsePage(await fetchApi(recipePagePath(page)), page),
  );
  const recipes = [first, ...remaining].flatMap((entry) => entry.items);
  const slugs = recipes.map((recipe) => String(recipe?.slug || "").trim());

  if (
    recipes.length !== first.pagination.total ||
    slugs.some((slug) => !slug) ||
    new Set(slugs).size !== slugs.length
  ) {
    throw new Error("Prerender recipe content is incomplete");
  }
  return recipes;
};

export const createPrerenderResponseCache = (recipes) =>
  new Map(recipes.map((recipe) => [String(recipe.slug), recipe]));

const jsonResponse = (status, body) => ({
  status,
  contentType: "application/json; charset=utf-8",
  headers: { "Access-Control-Allow-Origin": "*" },
  body: JSON.stringify(body),
});

export const responseForPrerenderRequest = (requestUrl, recipeCache) => {
  let pathname;
  try {
    pathname = new URL(requestUrl).pathname;
  } catch {
    return null;
  }

  if (pathname.endsWith("/user/me")) {
    return jsonResponse(401, { success: false, message: "Unauthenticated" });
  }

  const marker = "/recipes/detail/";
  const markerIndex = pathname.lastIndexOf(marker);
  if (markerIndex === -1) return null;

  const slug = decodeURIComponent(pathname.slice(markerIndex + marker.length));
  const recipe = recipeCache.get(slug);
  return recipe
    ? jsonResponse(200, { success: true, data: recipe })
    : jsonResponse(404, { success: false, message: "Recipe not found" });
};
