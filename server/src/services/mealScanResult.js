import {
  applyMealScanUncertainty,
  calibrateMealScanConfidence,
  getMissingScaleReason,
  getUnverifiedScaleReason,
} from "./mealScanCalibration.js";
import {
  getMealScanAssessmentError,
  normalizeMealScanAssessment,
  normalizeMealScanDataSource,
  shouldForceLowMealScanConfidence,
} from "./mealScanAssessment.js";

const MAX_ITEMS = 8;

const DISCLAIMER = {
  vi: "Kết quả chỉ là ước tính từ một ảnh. Hãy kiểm tra khẩu phần, dầu, sốt và nhãn dinh dưỡng; không dùng thay cho tư vấn y tế.",
  en: "This is an estimate from one image. Check portions, oils, sauces and nutrition labels; it is not medical advice.",
};

const ALLERGY_DISCLAIMER = {
  vi: "Không dùng ảnh để xác nhận món không chứa chất gây dị ứng, gluten hoặc thành phần bị che khuất.",
  en: "Do not use a photo to confirm that food is free from allergens, gluten or hidden ingredients.",
};

export const MEAL_SCAN_MAX_ITEMS = MAX_ITEMS;

export const createMealScanError = (code, status, message) =>
  Object.assign(new Error(message), { code, status });

const cleanText = (value, maxLength) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

const round = (value, decimals = 0) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const normalizeRange = (range, maximum, decimals = 0) => {
  const values = [range?.min, range?.estimate, range?.max].map(Number);
  if (values.some((value) => !Number.isFinite(value))) {
    throw createMealScanError(
      "MEAL_SCAN_INVALID_OUTPUT",
      502,
      "Provider returned an invalid nutrition range",
    );
  }

  const bounded = values.map((value) => Math.min(Math.max(value, 0), maximum));
  const min = Math.min(...bounded);
  const max = Math.max(...bounded);
  const estimate = Math.min(Math.max(bounded[1], min), max);
  return {
    min: round(min, decimals),
    estimate: round(estimate, decimals),
    max: round(max, decimals),
  };
};

const sumRanges = (items, key, decimals) => ({
  min: round(items.reduce((sum, item) => sum + item[key].min, 0), decimals),
  estimate: round(
    items.reduce((sum, item) => sum + item[key].estimate, 0),
    decimals,
  ),
  max: round(items.reduce((sum, item) => sum + item[key].max, 0), decimals),
});

export const normalizeMealScanResult = (raw, locale = "vi") => {
  if (!raw || typeof raw !== "object") {
    throw createMealScanError(
      "MEAL_SCAN_INVALID_OUTPUT",
      502,
      "Provider returned an invalid meal result",
    );
  }

  const imageAssessment = normalizeMealScanAssessment(raw);
  const assessmentError = getMealScanAssessmentError(imageAssessment);
  if (assessmentError) {
    throw createMealScanError(
      assessmentError.code,
      assessmentError.status,
      assessmentError.message,
    );
  }
  if (!Array.isArray(raw.items)) {
    throw createMealScanError(
      "MEAL_SCAN_INVALID_OUTPUT",
      502,
      "Provider returned an invalid meal result",
    );
  }

  const normalizedItems = raw.items.slice(0, MAX_ITEMS).map((item, index) => {
    const label = cleanText(item?.label, 80);
    if (!label) {
      throw createMealScanError(
        "MEAL_SCAN_INVALID_OUTPUT",
        502,
        "Provider returned an ingredient without a label",
      );
    }

    return {
      id: `item-${index + 1}`,
      label,
      portionGrams: normalizeRange(item.portionGrams, 3_000),
      calories: normalizeRange(item.calories, 5_000),
      protein: normalizeRange(item.protein, 1_000, 1),
      carb: normalizeRange(item.carb, 1_000, 1),
      fat: normalizeRange(item.fat, 1_000, 1),
      note: cleanText(item.note, 180),
      needsConfirmation: Boolean(item.needsConfirmation),
      dataSource: normalizeMealScanDataSource(item.dataSource),
    };
  });

  if (normalizedItems.length === 0) {
    throw createMealScanError(
      "MEAL_SCAN_INVALID_OUTPUT",
      502,
      "Provider returned no ingredients",
    );
  }

  const language = locale === "en" ? "en" : "vi";
  const forcedLowConfidence = shouldForceLowMealScanConfidence(imageAssessment);
  const confidence = forcedLowConfidence
    ? "low"
    : calibrateMealScanConfidence(raw);
  const items = applyMealScanUncertainty(normalizedItems, confidence);
  const providerReasons = (Array.isArray(raw.confidenceReasons)
    ? raw.confidenceReasons
    : [])
    .map((reason) => cleanText(reason, 180))
    .filter(Boolean)
    .slice(0, 3);
  const calibrationReason = raw.scaleReferenceVisible !== true
    ? getMissingScaleReason(language)
    : raw.confidence === "high"
      ? getUnverifiedScaleReason(language)
      : "";
  const assessmentReason = forcedLowConfidence
    ? language === "en"
      ? "Multiple servings or uncertain image evidence require you to confirm your actual portion."
      : "Ảnh có nhiều phần ăn hoặc bằng chứng chưa rõ; bạn cần xác nhận khẩu phần thực tế."
    : "";
  const confidenceReasons = [
    calibrationReason,
    assessmentReason,
    ...providerReasons,
  ]
    .filter(Boolean)
    .filter((reason, index, reasons) => reasons.indexOf(reason) === index)
    .slice(0, 3);
  const mealName =
    cleanText(raw.mealName, 100) ||
    (language === "en" ? "Meal estimate" : "Món ăn ước tính");

  return {
    mealName,
    confidence,
    confidenceReasons,
    imageAssessment,
    total: {
      calories: sumRanges(items, "calories", 0),
      protein: sumRanges(items, "protein", 1),
      carb: sumRanges(items, "carb", 1),
      fat: sumRanges(items, "fat", 1),
    },
    items,
    questions: (Array.isArray(raw.questions) ? raw.questions : [])
      .map((question) => cleanText(question, 220))
      .filter(Boolean)
      .slice(0, 4),
    disclaimer: DISCLAIMER[language],
    allergyDisclaimer: ALLERGY_DISCLAIMER[language],
  };
};
