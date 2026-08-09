export const FOOD_NUTRITION_BASES = ["per_100g"];
export const FOOD_SOURCE_TYPES = [
  "legacy_unknown",
  "manual_verified",
  "usda_fdc",
  "nutrition_label",
];

const EXTERNAL_SOURCE_TYPES = new Set(["usda_fdc"]);
const VERIFIED_SOURCE_TYPES = new Set([
  "manual_verified",
  "nutrition_label",
]);

export const createFoodProvenanceError = (code, message) =>
  Object.assign(new Error(message), { code, status: 400 });

const cleanText = (value, maximum) =>
  typeof value === "string" ? value.trim().slice(0, maximum) : "";

const normalizeDate = (value, field) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw createFoodProvenanceError(
      "FOOD_SOURCE_INVALID",
      `${field} không hợp lệ`,
    );
  }
  return date;
};

export const legacyFoodSource = () => ({ type: "legacy_unknown" });

export const normalizeFoodSource = (source, { allowLegacy = false } = {}) => {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    if (allowLegacy) return legacyFoodSource();
    throw createFoodProvenanceError(
      "FOOD_SOURCE_REQUIRED",
      "Nguồn dữ liệu dinh dưỡng là bắt buộc",
    );
  }

  const type = cleanText(source.type, 40);
  if (!FOOD_SOURCE_TYPES.includes(type) || (!allowLegacy && type === "legacy_unknown")) {
    throw createFoodProvenanceError(
      "FOOD_SOURCE_INVALID",
      "Loại nguồn dữ liệu dinh dưỡng không hợp lệ",
    );
  }
  if (type === "legacy_unknown") return legacyFoodSource();

  const normalized = {
    type,
    provider: cleanText(source.provider, 120),
    externalId: cleanText(source.externalId, 120),
    datasetVersion: cleanText(source.datasetVersion, 80),
    license: cleanText(source.license, 80),
    attribution: cleanText(source.attribution, 240),
    sourceUrl: cleanText(source.sourceUrl, 500),
    retrievedAt: normalizeDate(source.retrievedAt, "retrievedAt"),
    verifiedAt: normalizeDate(source.verifiedAt, "verifiedAt"),
  };

  for (const field of ["provider", "datasetVersion", "license", "attribution"]) {
    if (!normalized[field]) {
      throw createFoodProvenanceError(
        "FOOD_SOURCE_INVALID",
        `${field} của nguồn dinh dưỡng là bắt buộc`,
      );
    }
  }
  if (EXTERNAL_SOURCE_TYPES.has(type)) {
    if (!normalized.externalId || !normalized.retrievedAt) {
      throw createFoodProvenanceError(
        "FOOD_SOURCE_INVALID",
        "Nguồn external cần externalId và retrievedAt",
      );
    }
  }
  if (VERIFIED_SOURCE_TYPES.has(type) && !normalized.verifiedAt) {
    throw createFoodProvenanceError(
      "FOOD_SOURCE_INVALID",
      "Nguồn đã xác minh cần verifiedAt",
    );
  }

  return normalized;
};

export const hasKnownFoodSource = (source) =>
  Boolean(source?.type && source.type !== "legacy_unknown");

export const hasFoodMacroMutation = (payload = {}) =>
  ["protein", "carb", "fat", "calories", "nutritionBasis"].some(
    (field) => payload[field] !== undefined,
  );
