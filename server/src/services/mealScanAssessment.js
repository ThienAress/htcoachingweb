export const MEAL_SCAN_ANALYSIS_STATUSES = ["ok", "retake", "non_food"];
export const MEAL_SCAN_SCENARIOS = [
  "plated_meal",
  "shared_meal",
  "packaged_food",
  "drink",
  "dessert",
  "unknown",
];
export const MEAL_SCAN_IMAGE_QUALITIES = ["good", "usable", "poor"];
export const MEAL_SCAN_DATA_SOURCES = [
  "visual_estimate",
  "nutrition_label",
];

const cleanText = (value, maxLength) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

const allowedValue = (value, allowed, fallback) =>
  allowed.includes(value) ? value : fallback;

export const normalizeMealScanAssessment = (raw = {}) => {
  const assessment = raw.imageAssessment || {};
  return {
    status: allowedValue(
      raw.analysisStatus,
      MEAL_SCAN_ANALYSIS_STATUSES,
      "ok",
    ),
    foodVisible: assessment.foodVisible !== false,
    quality: allowedValue(
      assessment.quality,
      MEAL_SCAN_IMAGE_QUALITIES,
      "usable",
    ),
    scenario: allowedValue(
      assessment.scenario,
      MEAL_SCAN_SCENARIOS,
      "unknown",
    ),
    servingsVisible: Math.min(
      Math.max(Number.parseInt(assessment.servingsVisible, 10) || 1, 1),
      20,
    ),
    nutritionLabelVisible: assessment.nutritionLabelVisible === true,
    barcodeVisible: assessment.barcodeVisible === true,
    issues: (Array.isArray(assessment.issues) ? assessment.issues : [])
      .map((issue) => cleanText(issue, 120))
      .filter(Boolean)
      .slice(0, 4),
  };
};

export const getMealScanAssessmentError = (assessment) => {
  if (assessment.status === "non_food" || !assessment.foodVisible) {
    return {
      code: "MEAL_SCAN_NO_FOOD",
      status: 422,
      message: "No analyzable food is visible",
    };
  }
  if (assessment.status === "retake" || assessment.quality === "poor") {
    return {
      code: "MEAL_SCAN_RETAKE_REQUIRED",
      status: 422,
      message: "The image must be retaken before nutrition estimation",
    };
  }
  return null;
};

export const shouldForceLowMealScanConfidence = (assessment) =>
  assessment.quality === "poor" ||
  assessment.scenario === "shared_meal" ||
  assessment.servingsVisible > 1 ||
  (assessment.scenario === "packaged_food" &&
    !assessment.nutritionLabelVisible);

export const normalizeMealScanDataSource = (value) =>
  allowedValue(value, MEAL_SCAN_DATA_SOURCES, "visual_estimate");
