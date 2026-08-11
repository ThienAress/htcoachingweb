import { LOCAL_FOOD_PRICE_OBSERVATIONS } from "../constants/localFoodPriceObservations.js";
import { FOOD_PRICE_SOURCE_KEYS } from "../models/FoodPriceObservation.js";

export { LOCAL_FOOD_PRICE_OBSERVATIONS };

export const LOCAL_PRICE_DATABASE = "htcoaching_local";
export const LOCAL_PRICE_MONGO_URI =
  "mongodb://127.0.0.1:27017/htcoaching_local?replicaSet=rs0";

const SOURCE_HOSTS = Object.freeze({
  bach_hoa_xanh: new Set(["bachhoaxanh.com", "www.bachhoaxanh.com"]),
  winmart: new Set(["winmart.vn", "www.winmart.vn"]),
  coop_online: new Set(["cooponline.vn", "www.cooponline.vn"]),
});

export const makeLocalFoodPriceImportError = (code, message = code) =>
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

export const validateLocalPriceTarget = (mongoUri) => {
  const { hostname, database } = getMongoTarget(mongoUri);
  const errors = [];
  if (!["127.0.0.1", "localhost", "::1"].includes(hostname)) {
    errors.push("LOCAL_FOOD_PRICE_HOST_REQUIRED");
  }
  if (database !== LOCAL_PRICE_DATABASE) {
    errors.push("LOCAL_FOOD_PRICE_DATABASE_REQUIRED");
  }
  return { valid: errors.length === 0, errors };
};

const validateSourceUrl = ({ sourceKey, sourceUrl }) => {
  try {
    const url = new URL(sourceUrl);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      SOURCE_HOSTS[sourceKey]?.has(url.hostname.toLowerCase()) &&
      url.pathname !== "/" &&
      !url.pathname.startsWith("/c/")
    );
  } catch {
    return false;
  }
};

export const validatePriceManifest = (
  observations = LOCAL_FOOD_PRICE_OBSERVATIONS,
) => {
  const errors = [];
  const identities = new Set();
  const sourcesByFood = new Map();
  const observationsByFood = new Map();

  if (!Array.isArray(observations) || observations.length === 0) {
    errors.push("MANIFEST_EMPTY");
  }

  for (const observation of observations || []) {
    const {
      foodLabel,
      sourceKey,
      packGrams,
      regularPriceVnd,
      promotionalPriceVnd,
      observedAt,
    } = observation;
    const observedDate = new Date(observedAt);
    const identity = `${foodLabel}|${sourceKey}|${observedAt}`;

    if (!foodLabel || String(foodLabel).trim() !== foodLabel) {
      errors.push(`FOOD_LABEL_INVALID:${foodLabel}`);
    }
    if (!FOOD_PRICE_SOURCE_KEYS.includes(sourceKey)) {
      errors.push(`SOURCE_KEY_INVALID:${foodLabel}`);
    }
    if (
      !Number.isInteger(packGrams) ||
      packGrams < 1 ||
      packGrams > 100_000
    ) {
      errors.push(`PACK_GRAMS_INVALID:${foodLabel}:${sourceKey}`);
    }
    if (
      !Number.isInteger(regularPriceVnd) ||
      regularPriceVnd < 1 ||
      regularPriceVnd > 100_000_000
    ) {
      errors.push(`REGULAR_PRICE_INVALID:${foodLabel}:${sourceKey}`);
    }
    if (
      promotionalPriceVnd !== null &&
      (!Number.isInteger(promotionalPriceVnd) ||
        promotionalPriceVnd < 1 ||
        promotionalPriceVnd > regularPriceVnd)
    ) {
      errors.push(`PROMOTIONAL_PRICE_INVALID:${foodLabel}:${sourceKey}`);
    }
    if (
      Number.isNaN(observedDate.getTime()) ||
      observedDate.toISOString() !== observedAt
    ) {
      errors.push(`OBSERVED_AT_INVALID:${foodLabel}:${sourceKey}`);
    }
    if (!validateSourceUrl(observation)) {
      errors.push(`SOURCE_URL_INVALID:${foodLabel}:${sourceKey}`);
    }
    if (identities.has(identity)) errors.push(`DUPLICATE_IDENTITY:${identity}`);
    identities.add(identity);

    if (!sourcesByFood.has(foodLabel)) sourcesByFood.set(foodLabel, new Set());
    sourcesByFood.get(foodLabel).add(sourceKey);
    observationsByFood.set(foodLabel, (observationsByFood.get(foodLabel) || 0) + 1);
  }

  for (const [foodLabel, sources] of sourcesByFood) {
    if (sources.size !== 1 || observationsByFood.get(foodLabel) !== 1) {
      errors.push(`ONE_SOURCE_REQUIRED:${foodLabel}`);
    }
  }

  if (errors.length > 0) {
    throw makeLocalFoodPriceImportError(
      "LOCAL_FOOD_PRICE_MANIFEST_INVALID",
      `Local Food price manifest invalid: ${errors.join(", ")}`,
    );
  }
  return { observations: observations.length, foods: sourcesByFood.size };
};

const comparableFields = [
  "packGrams",
  "regularPriceVnd",
  "promotionalPriceVnd",
  "sourceUrl",
];

export const classifyExistingObservation = (existing, expected) => {
  if (!existing) return "insert";
  const exact = comparableFields.every(
    (field) => (existing[field] ?? null) === (expected[field] ?? null),
  );
  if (!exact) {
    throw makeLocalFoodPriceImportError(
      "LOCAL_FOOD_PRICE_HISTORY_DRIFT",
      `Existing price history differs for ${expected.foodLabel}/${expected.sourceKey}/${expected.observedAt}`,
    );
  }
  return "skip";
};
