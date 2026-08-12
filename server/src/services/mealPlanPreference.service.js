import {
  MEAL_PLAN_ALLERGEN_KEYS,
  MEAL_PLAN_ALLERGY_STATUSES,
  MEAL_PLAN_BUDGET_VND,
  MEAL_PLAN_OTHER_ALLERGEN_TEXT,
} from "../constants/mealPlanPreferences.js";
import User from "../models/User.js";
import { parseOtherAllergenText } from "./mealPlanAllergenInput.service.js";

const preferenceError = (code, message, statusCode = 400) =>
  Object.assign(new Error(message), { code, statusCode });

const emptyPreferences = () => ({
  allergyStatus: null,
  allergens: [],
  otherAllergenText: "",
  budgetVndPerDay: null,
  reviewedAt: null,
});

const serializePreferences = (preferences) =>
  preferences
    ? {
        allergyStatus: preferences.allergyStatus,
        allergens: [...preferences.allergens],
        otherAllergenText: preferences.otherAllergenText || "",
        budgetVndPerDay: preferences.budgetVndPerDay ?? null,
        reviewedAt: preferences.reviewedAt,
      }
    : emptyPreferences();

export const normalizeMealPlanPreferences = (input) => {
  const allergyStatus = String(input?.allergyStatus || "");
  const allergens = Array.isArray(input?.allergens)
    ? [...new Set(input.allergens)]
    : [];
  const rawOtherAllergenText = input?.otherAllergenText ?? "";
  if (
    typeof rawOtherAllergenText !== "string" ||
    /[\u0000-\u001F\u007F]/u.test(rawOtherAllergenText)
  ) {
    throw preferenceError(
      "MEAL_PLAN_PREFERENCES_INVALID",
      "Dị ứng khác không hợp lệ",
    );
  }
  const normalizedOtherAllergenText = rawOtherAllergenText
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim();
  const otherAnalysis = parseOtherAllergenText(normalizedOtherAllergenText);
  const otherAllergenText = otherAnalysis.canonicalText;
  const budgetVndPerDay = input?.budgetVndPerDay ?? null;

  if (!MEAL_PLAN_ALLERGY_STATUSES.includes(allergyStatus)) {
    throw preferenceError(
      "MEAL_PLAN_PREFERENCES_INVALID",
      "Trạng thái dị ứng không hợp lệ",
    );
  }
  if (
    allergens.some((allergen) => !MEAL_PLAN_ALLERGEN_KEYS.includes(allergen)) ||
    (allergyStatus === "declared"
      ? allergens.length === 0 && !otherAllergenText
      : allergens.length > 0 || Boolean(otherAllergenText))
  ) {
    throw preferenceError(
      "MEAL_PLAN_PREFERENCES_INVALID",
      "Danh sách dị ứng không hợp lệ",
    );
  }
  if (
    otherAllergenText.length > MEAL_PLAN_OTHER_ALLERGEN_TEXT.maxLength ||
    /[\u0000-\u001F\u007F<>@]|https?:\/\/|www\./iu.test(otherAllergenText)
  ) {
    throw preferenceError(
      "MEAL_PLAN_PREFERENCES_INVALID",
      "Dị ứng khác không hợp lệ",
    );
  }
  if (
    budgetVndPerDay !== null &&
    (!Number.isInteger(budgetVndPerDay) ||
      budgetVndPerDay < MEAL_PLAN_BUDGET_VND.min ||
      budgetVndPerDay > MEAL_PLAN_BUDGET_VND.max)
  ) {
    throw preferenceError(
      "MEAL_PLAN_PREFERENCES_INVALID",
      "Ngân sách tham khảo không hợp lệ",
    );
  }
  return { allergyStatus, allergens, otherAllergenText, budgetVndPerDay };
};

export const getOwnMealPlanPreferences = async (userId) => {
  const user = await User.findById(userId)
    .select("+mealPlanPreferences")
    .lean();
  if (!user) {
    throw preferenceError("USER_NOT_FOUND", "Không tìm thấy tài khoản", 404);
  }
  return serializePreferences(user.mealPlanPreferences);
};

export const updateOwnMealPlanPreferences = async (
  userId,
  input,
  { now = () => new Date() } = {},
) => {
  const normalized = normalizeMealPlanPreferences(input);
  const user = await User.findById(userId).select("+mealPlanPreferences");
  if (!user) {
    throw preferenceError("USER_NOT_FOUND", "Không tìm thấy tài khoản", 404);
  }
  user.mealPlanPreferences = { ...normalized, reviewedAt: now() };
  await user.save();
  return serializePreferences(user.mealPlanPreferences);
};

export const deleteOwnMealPlanPreferences = async (userId) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { $unset: { mealPlanPreferences: 1 } },
    { returnDocument: "after" },
  )
    .select("_id")
    .lean();
  if (!user) {
    throw preferenceError("USER_NOT_FOUND", "Không tìm thấy tài khoản", 404);
  }
  return emptyPreferences();
};
