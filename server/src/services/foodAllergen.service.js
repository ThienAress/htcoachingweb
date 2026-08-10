import {
  MEAL_PLAN_ALLERGEN_KEYS,
  MEAL_PLAN_ALLERGEN_REVIEW_SCOPES,
  MEAL_PLAN_SPECIFIC_FOOD_KEYS,
} from "../constants/mealPlanPreferences.js";

const allergenError = (message) =>
  Object.assign(new Error(message), {
    code: "FOOD_ALLERGEN_PROFILE_INVALID",
    statusCode: 400,
  });

const normalizeKeys = (values, allowed = MEAL_PLAN_ALLERGEN_KEYS) => {
  if (!Array.isArray(values)) throw allergenError("Metadata dị ứng không hợp lệ");
  const normalized = [...new Set(values)];
  if (
    normalized.length !== values.length ||
    normalized.some((value) => !allowed.includes(value))
  ) {
    throw allergenError("Metadata dị ứng không hợp lệ");
  }
  return normalized;
};

export const normalizeFoodAllergenProfile = (
  input,
  { allowUnreviewed = true } = {},
) => {
  if (input == null && allowUnreviewed) {
    return {
      reviewStatus: "unreviewed",
      contains: [],
      mayContain: [],
      reviewedScopes: [],
      specificContains: [],
      sourceType: null,
      sourceUrl: "",
      reviewedAt: null,
    };
  }
  const reviewStatus = String(input?.reviewStatus || "");
  const contains = normalizeKeys(input?.contains || []);
  const mayContain = normalizeKeys(input?.mayContain || []);
  const reviewedScopes = normalizeKeys(
    input?.reviewedScopes || [],
    MEAL_PLAN_ALLERGEN_REVIEW_SCOPES,
  );
  const specificContains = normalizeKeys(
    input?.specificContains || [],
    MEAL_PLAN_SPECIFIC_FOOD_KEYS,
  );
  if (contains.some((value) => mayContain.includes(value))) {
    throw allergenError("Một allergen không thể thuộc cả contains và mayContain");
  }
  if (reviewStatus === "unreviewed" && allowUnreviewed) {
    if (
      contains.length ||
      mayContain.length ||
      reviewedScopes.length ||
      specificContains.length ||
      input?.sourceType ||
      input?.sourceUrl ||
      input?.reviewedAt
    ) {
      throw allergenError("Food chưa kiểm duyệt không được có metadata nguồn");
    }
    return normalizeFoodAllergenProfile(null);
  }
  const allowedSourceTypes = [
    "package_label",
    "manufacturer",
    "official_database",
  ];
  if (reviewStatus !== "reviewed" || !allowedSourceTypes.includes(input?.sourceType)) {
    throw allergenError("Thiếu nguồn kiểm duyệt dị ứng");
  }
  if (
    specificContains.length > 0 &&
    !reviewedScopes.includes("specific_foods")
  ) {
    throw allergenError("Metadata thực phẩm cụ thể chưa được kiểm duyệt");
  }
  const reviewedAt = new Date(input?.reviewedAt);
  if (Number.isNaN(reviewedAt.getTime()) || reviewedAt.getTime() > Date.now() + 86_400_000) {
    throw allergenError("Ngày kiểm duyệt dị ứng không hợp lệ");
  }
  let sourceUrl = "";
  if (input?.sourceUrl) {
    try {
      const parsed = new URL(input.sourceUrl);
      if (parsed.protocol !== "https:") throw new Error("https required");
      parsed.hash = "";
      sourceUrl = parsed.toString();
    } catch {
      throw allergenError("URL nguồn dị ứng không hợp lệ");
    }
  }
  return {
    reviewStatus,
    contains,
    mayContain,
    reviewedScopes,
    specificContains,
    sourceType: input.sourceType,
    sourceUrl,
    reviewedAt,
  };
};
