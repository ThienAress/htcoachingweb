import { savedMealPlanError } from "./savedMealPlanAccess.service.js";
import { containsVietnameseOffensiveTerm } from "./vietnameseOffensiveWords.service.js";

const MAX_LENGTH = 30;

export const normalizeSavedMealPlanTitle = (value) => {
  const normalized =
    typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (
    normalized.length < 1 ||
    normalized.length > MAX_LENGTH ||
    containsVietnameseOffensiveTerm(normalized)
  ) {
    throw savedMealPlanError(
      400,
      "Tên thực đơn phải từ 1 đến 30 ký tự và không chứa từ ngữ không phù hợp",
      "INVALID_SAVED_MEAL_PLAN_TITLE",
    );
  }
  return normalized;
};
