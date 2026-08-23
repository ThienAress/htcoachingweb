const GTIN_LENGTHS = new Set([8, 12, 13, 14]);
const REQUIRED_NUTRIENTS = ["calories", "protein", "carb", "fat"];
const OPTIONAL_NUTRIENTS = ["saturates", "sugars", "fibre", "salt"];
const FDC_SEARCH_URL = "https://api.nal.usda.gov/fdc/v1/foods/search";
const OFF_PRODUCT_URL = "https://world.openfoodfacts.org/api/v2/product";
const enabled = (value) => String(value || "").toLowerCase() === "true";
const cleanText = (value, maximum = 240) => typeof value === "string"
  ? value.trim().slice(0, maximum)
  : "";
const finiteNonNegative = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
};
const roundNutrition = (value) => Math.round(value * 100) / 100;
export const normalizeGtin = (value) => String(value || "").trim();
export const isValidGtin = (value) => {
  const gtin = normalizeGtin(value);
  if (!GTIN_LENGTHS.has(gtin.length) || !/^\d+$/.test(gtin)) return false;

  const digits = [...gtin].map(Number);
  const expectedCheckDigit = digits.pop();
  const sum = digits.reverse().reduce(
    (total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1),
    0,
  );
  return (10 - (sum % 10)) % 10 === expectedCheckDigit;
};
export const createFoodReferenceLookupError = (code, message, status = 503) =>
  Object.assign(new Error(message), { code, status });
const completeNutrition = (nutrition) => REQUIRED_NUTRIENTS.every(
  (key) => finiteNonNegative(nutrition[key]) !== null,
);

const normalizeNutrition = (nutrition) => {
  const normalized = Object.fromEntries(
    REQUIRED_NUTRIENTS.map((key) => [
      key,
      roundNutrition(finiteNonNegative(nutrition[key])),
    ]),
  );
  for (const key of OPTIONAL_NUTRIENTS) {
    const value = finiteNonNegative(nutrition[key]);
    if (value !== null) normalized[key] = roundNutrition(value);
  }
  return normalized;
};

const readJsonWithLimit = async (response, maximumBytes) => {
  const declaredBytes = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(declaredBytes) && declaredBytes > maximumBytes) {
    throw new Error("Food reference provider response too large");
  }

  if (!response.body?.getReader) return response.json();
  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maximumBytes) {
      await reader.cancel();
      throw new Error("Food reference provider response too large");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
};

const fetchJson = async (url, request, options) => {
  const { fetchImpl, timeoutMs, maxResponseBytes } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      ...request,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("Food reference provider unavailable");
    return await readJsonWithLimit(response, maxResponseBytes);
  } finally {
    clearTimeout(timeout);
  }
};

const fdcNutrients = (food) => {
  const byNumber = new Map(
    (Array.isArray(food?.foodNutrients) ? food.foodNutrients : []).map(
      (nutrient) => [String(nutrient.nutrientNumber || ""), nutrient.value],
    ),
  );
  return {
    calories: byNumber.get("208"),
    protein: byNumber.get("203"),
    carb: byNumber.get("205"),
    fat: byNumber.get("204"),
    saturates: byNumber.get("606"),
    sugars: byNumber.get("269"),
    fibre: byNumber.get("291"),
    salt: finiteNonNegative(byNumber.get("307")) === null
      ? null
      : Number(byNumber.get("307")) * 0.0025,
  };
};

const lookupUsda = async (gtin, options) => {
  const apiKey = cleanText(process.env.FDC_API_KEY, 500);
  if (!apiKey) return { attempted: false, reference: null };

  const payload = await fetchJson(
    `${FDC_SEARCH_URL}?api_key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: gtin,
        dataType: ["Branded"],
        pageSize: 10,
      }),
    },
    options,
  );
  const foods = Array.isArray(payload?.foods) ? payload.foods : [];
  const food = foods.find((candidate) => normalizeGtin(candidate?.gtinUpc) === gtin);
  if (!food) return { attempted: true, reference: null };

  const nutrition = fdcNutrients(food);
  if (!completeNutrition(nutrition)) {
    return { attempted: true, reference: null };
  }

  const externalId = String(food.fdcId || "").trim();
  const label = cleanText(food.description, 200);
  if (!externalId || !label) return { attempted: true, reference: null };

  return {
    attempted: true,
    reference: {
      id: `usda_fdc-${externalId}`,
      gtin,
      label,
      brand: cleanText(food.brandOwner || food.brandName, 160),
      nutritionBasis: "per_100g",
      ...normalizeNutrition(nutrition),
      serving: {
        size: finiteNonNegative(food.servingSize),
        unit: cleanText(food.servingSizeUnit, 30),
        text: cleanText(food.householdServingFullText, 120),
      },
      source: {
        type: "usda_fdc",
        provider: "USDA FoodData Central",
        externalId,
        datasetVersion:
          cleanText(food.publicationDate || food.modifiedDate, 80) ||
          "FoodData Central live API",
        license: "CC0 1.0",
        attribution: "U.S. Department of Agriculture, Agricultural Research Service",
        sourceUrl: `https://fdc.nal.usda.gov/fdc-app.html#/food-details/${externalId}/nutrients`,
        retrievedAt: options.now().toISOString(),
      },
    },
  };
};

const lookupOpenFoodFacts = async (gtin, options) => {
  if (!enabled(process.env.OPEN_FOOD_FACTS_ENABLED)) {
    return { attempted: false, reference: null };
  }

  const fields = [
    "code",
    "product_name",
    "brands",
    "serving_size",
    "last_modified_t",
    "nutriments",
  ].join(",");
  const payload = await fetchJson(
    `${OFF_PRODUCT_URL}/${gtin}.json?fields=${fields}`,
    {
      method: "GET",
      headers: {
        "User-Agent": cleanText(process.env.FOOD_REFERENCE_USER_AGENT, 240) ||
          "HTCOACHING-Meal-Scan/1.0 (https://htcoachingweb.io.vn)",
      },
    },
    options,
  );
  const product = payload?.status === 1 ? payload.product : null;
  if (!product || normalizeGtin(product.code) !== gtin) {
    return { attempted: true, reference: null };
  }

  const nutrition = {
    calories: product.nutriments?.["energy-kcal_100g"],
    protein: product.nutriments?.proteins_100g,
    carb: product.nutriments?.carbohydrates_100g,
    fat: product.nutriments?.fat_100g,
    saturates: product.nutriments?.["saturated-fat_100g"],
    sugars: product.nutriments?.sugars_100g,
    fibre: product.nutriments?.fiber_100g,
    salt: product.nutriments?.salt_100g,
  };
  const label = cleanText(product.product_name, 200);
  if (!label || !completeNutrition(nutrition)) {
    return { attempted: true, reference: null };
  }

  const modifiedAt = finiteNonNegative(product.last_modified_t);
  const datasetVersion = modifiedAt
    ? new Date(modifiedAt * 1000).toISOString()
    : "Open Food Facts live API";

  return {
    attempted: true,
    reference: {
      id: `open_food_facts-${gtin}`,
      gtin,
      label,
      brand: cleanText(product.brands, 160),
      nutritionBasis: "per_100g",
      ...normalizeNutrition(nutrition),
      serving: {
        size: null,
        unit: "",
        text: cleanText(product.serving_size, 120),
      },
      source: {
        type: "open_food_facts",
        provider: "Open Food Facts",
        externalId: gtin,
        datasetVersion,
        license: "ODbL 1.0",
        attribution: "Open Food Facts contributors",
        sourceUrl: `https://world.openfoodfacts.org/product/${gtin}`,
        retrievedAt: options.now().toISOString(),
      },
    },
  };
};

export const lookupFoodReferenceByGtin = async (value, {
    fetchImpl = globalThis.fetch,
    now = () => new Date(),
    timeoutMs = Math.min(
      Math.max(500, Number(process.env.FOOD_REFERENCE_TIMEOUT_MS) || 5_000),
      15_000,
    ),
    maxResponseBytes = Math.min(
      Math.max(
        1_024,
        Number(process.env.FOOD_REFERENCE_MAX_RESPONSE_BYTES) || 2 * 1024 * 1024,
      ),
      5 * 1024 * 1024,
    ),
  } = {}) => {
  if (!enabled(process.env.FOOD_REFERENCE_LOOKUP_ENABLED)) {
    throw createFoodReferenceLookupError(
      "FOOD_REFERENCE_LOOKUP_DISABLED",
      "Tra cứu sản phẩm chưa được bật",
    );
  }

  const gtin = normalizeGtin(value);
  if (!isValidGtin(gtin)) {
    throw createFoodReferenceLookupError(
      "FOOD_REFERENCE_GTIN_INVALID",
      "Mã GTIN không hợp lệ",
      400,
    );
  }
  if (typeof fetchImpl !== "function") {
    throw createFoodReferenceLookupError(
      "FOOD_REFERENCE_PROVIDER_UNAVAILABLE",
      "Không thể tra cứu dữ liệu sản phẩm lúc này",
    );
  }

  const options = { fetchImpl, now, timeoutMs, maxResponseBytes };
  let attempted = false;
  let providerFailed = false;
  for (const lookup of [lookupUsda, lookupOpenFoodFacts]) {
    try {
      const result = await lookup(gtin, options);
      attempted ||= result.attempted;
      if (result.reference) return result.reference;
    } catch {
      providerFailed = true;
      attempted = true;
    }
  }

  if (!attempted) {
    throw createFoodReferenceLookupError(
      "FOOD_REFERENCE_NOT_CONFIGURED",
      "Nguồn tra cứu sản phẩm chưa được cấu hình",
    );
  }
  if (providerFailed) {
    throw createFoodReferenceLookupError(
      "FOOD_REFERENCE_PROVIDER_UNAVAILABLE",
      "Không thể tra cứu dữ liệu sản phẩm lúc này",
    );
  }
  return null;
};
