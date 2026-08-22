import { validateStagingOperation } from "../config/stagingOperationSafety.js";

export const FIXTURE_KEY = "plan-058a-public-recipe-catalog";
export const LOCAL_RECIPE_DATABASE = "htcoaching_local";
export const STAGING_RECIPE_DATABASE = "htcoaching_staging";
export const LOCAL_RECIPE_MONGO_URI =
  "mongodb://127.0.0.1:27017/htcoaching_local?replicaSet=rs0";
export const PRODUCTION_RECIPE_API_ORIGIN =
  "https://htcoachingweb.onrender.com";

export const RECIPE_MANIFEST = Object.freeze([
  { slug: "vietnamese-style-veggie-hotpot" },
  { slug: "vietnamese-veg-parcels" },
  { slug: "tofu-greens-cashew-stir-fry" },
  { slug: "tangy-carrot-cabbage-onion-salad" },
  { slug: "vegan-banh-mi" },
  { slug: "vietnamese-prawn-spiralized-rolls" },
  { slug: "vietnamese-caramel-trout" },
  { slug: "sea-bass-with-sizzled-ginger-chilli-spring-onions" },
  { slug: "salt-pepper-squid" },
  { slug: "salmon-noodle-wraps" },
]);

const STAGING_CONFIRMATION = "CONFIRM_STAGING_RECIPE_CATALOG_SYNC";
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const makeRecipeCatalogError = (code, message = code) =>
  Object.assign(new Error(message), { code });

const getMongoTarget = (value) => {
  try {
    const url = new URL(String(value || ""));
    return {
      hostname: url.hostname.toLowerCase(),
      database: decodeURIComponent(url.pathname)
        .replace(/^\/+/, "")
        .split("/")[0],
    };
  } catch {
    return { hostname: "", database: "" };
  }
};

export const validateLocalRecipeTarget = (mongoUri) => {
  const { hostname, database } = getMongoTarget(mongoUri);
  const errors = [];
  if (!["127.0.0.1", "localhost", "::1"].includes(hostname)) {
    errors.push("LOCAL_RECIPE_CATALOG_HOST_REQUIRED");
  }
  if (database !== LOCAL_RECIPE_DATABASE) {
    errors.push("LOCAL_RECIPE_CATALOG_DATABASE_REQUIRED");
  }
  return { valid: errors.length === 0, errors };
};

export const validateRecipeSyncTarget = ({
  target,
  env = process.env,
  mongoUri = target === "local" ? LOCAL_RECIPE_MONGO_URI : env.MONGO_URI,
} = {}) => {
  if (target === "local") return validateLocalRecipeTarget(mongoUri);
  if (target === "staging") {
    return validateStagingOperation({
      env,
      confirmationVariable: STAGING_CONFIRMATION,
    });
  }
  return { valid: false, errors: ["RECIPE_CATALOG_TARGET_INVALID"] };
};

export const assertRecipeSyncTarget = (options) => {
  const result = validateRecipeSyncTarget(options);
  if (!result.valid) {
    throw makeRecipeCatalogError(
      "RECIPE_CATALOG_TARGET_REJECTED",
      `Recipe catalog target rejected: ${result.errors.join(", ")}`,
    );
  }
};

export const validateRecipeManifest = (manifest = RECIPE_MANIFEST) => {
  const slugs = Array.isArray(manifest)
    ? manifest.map((entry) => entry?.slug)
    : [];
  if (
    slugs.length !== 10 ||
    new Set(slugs).size !== 10 ||
    slugs.some(
      (slug) =>
        typeof slug !== "string" ||
        slug.length > 180 ||
        !SLUG_PATTERN.test(slug),
    )
  ) {
    throw makeRecipeCatalogError("RECIPE_CATALOG_MANIFEST_INVALID");
  }
  return { recipes: slugs.length };
};

const asString = (value, maximum) =>
  String(value || "").trim().slice(0, maximum);

const asStringArray = (value, maximumItems, maximumLength) =>
  (Array.isArray(value) ? value : [])
    .map((item) => asString(item, maximumLength))
    .filter(Boolean)
    .slice(0, maximumItems);

export const sanitizeProductionRecipe = (source) => {
  const recipe = {
    name: asString(source?.name, 200),
    nameEn: asString(source?.nameEn, 200),
    slug: asString(source?.slug, 180).toLowerCase(),
    category: asString(source?.category, 100),
    area: asString(source?.area, 100),
    thumbnail: asString(source?.thumbnail, 2048),
    prepTime: asString(source?.prepTime, 100),
    ingredients: (Array.isArray(source?.ingredients)
      ? source.ingredients
      : []
    )
      .map((ingredient) => ({
        name: asString(ingredient?.name, 200),
        measure: asString(ingredient?.measure, 100),
      }))
      .filter((ingredient) => ingredient.name)
      .slice(0, 100),
    instructions: asStringArray(source?.instructions, 100, 2000),
    youtubeUrl: "",
    sourceUrl: asString(source?.sourceUrl, 2048),
    source: ["mealdb", "ai", "manual"].includes(source?.source)
      ? source.source
      : "manual",
    mealDbId: source?.mealDbId ? asString(source.mealDbId, 100) : null,
    tags: asStringArray(source?.tags, 50, 100),
    isPublished: true,
  };

  if (
    !recipe.name ||
    !SLUG_PATTERN.test(recipe.slug) ||
    recipe.ingredients.length === 0 ||
    recipe.instructions.length === 0
  ) {
    throw makeRecipeCatalogError("RECIPE_CATALOG_SOURCE_RECIPE_INVALID");
  }
  return recipe;
};

export const classifyRecipeRecord = (existing) => {
  if (!existing) return "insert";
  const marker = existing._recipeCatalogFixture;
  return marker?.managed === true && marker?.key === FIXTURE_KEY
    ? "update"
    : "conflict";
};
