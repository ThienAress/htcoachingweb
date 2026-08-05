import { fetchMealScanEstimate } from "./mealScan.provider.js";
import {
  excludeDeclaredIngredientDuplicates,
  mergeDeclaredIngredientsIntoResult,
  resolveDeclaredIngredients,
} from "./mealScanDeclaredIngredients.js";
import {
  createMealScanError,
  normalizeMealScanResult,
} from "./mealScanResult.js";

export { normalizeMealScanResult } from "./mealScanResult.js";

const mockProviderResult = (locale) => {
  const english = locale === "en";
  return {
    analysisStatus: "ok",
    imageAssessment: {
      foodVisible: true,
      quality: "usable",
      scenario: "plated_meal",
      servingsVisible: 1,
      nutritionLabelVisible: false,
      barcodeVisible: false,
      issues: [],
    },
    mealName: english
      ? "Sample chicken rice bowl"
      : "Dữ liệu mẫu: Cơm gà và rau củ",
    confidence: "medium",
    scaleReferenceVisible: false,
    confidenceReasons: [
      english
        ? "Portion size is estimated from one image without a size reference."
        : "Khẩu phần được ước tính từ một ảnh và không có vật chuẩn kích thước.",
    ],
    items: [
      {
        label: english ? "Cooked rice" : "Cơm trắng",
        portionGrams: { min: 160, estimate: 200, max: 240 },
        calories: { min: 208, estimate: 260, max: 312 },
        protein: { min: 4, estimate: 5.4, max: 6.5 },
        carb: { min: 45, estimate: 56, max: 68 },
        fat: { min: 0.4, estimate: 0.6, max: 0.8 },
        note: english ? "Confirm the rice portion." : "Cần xác nhận lượng cơm.",
        needsConfirmation: true,
      },
      {
        label: english ? "Chicken" : "Thịt gà",
        portionGrams: { min: 120, estimate: 150, max: 180 },
        calories: { min: 220, estimate: 280, max: 350 },
        protein: { min: 30, estimate: 38, max: 45 },
        carb: { min: 0, estimate: 2, max: 5 },
        fat: { min: 8, estimate: 12, max: 18 },
        note: english
          ? "Cooking oil is not visible."
          : "Không thấy rõ lượng dầu.",
        needsConfirmation: true,
      },
      {
        label: english ? "Mixed vegetables" : "Rau củ",
        portionGrams: { min: 80, estimate: 120, max: 160 },
        calories: { min: 45, estimate: 85, max: 130 },
        protein: { min: 2, estimate: 3, max: 5 },
        carb: { min: 8, estimate: 14, max: 21 },
        fat: { min: 0, estimate: 2, max: 5 },
        note: english
          ? "Sauce may change the estimate."
          : "Sốt có thể làm thay đổi kết quả.",
        needsConfirmation: false,
      },
    ],
    questions: [
      english
        ? "Was oil, butter or sauce added?"
        : "Món có thêm dầu, bơ hoặc sốt không?",
    ],
  };
};

export const analyzeMealImage = async ({
  mimeType,
  base64,
  locale = "vi",
  declaredIngredients = [],
}) => {
  const provider =
    process.env.NODE_ENV === "production"
      ? process.env.AI_PROVIDER || ""
      : process.env.MEAL_SCAN_PROVIDER || "mock";
  const resolvedDeclaredIngredients = await resolveDeclaredIngredients(
    declaredIngredients,
  );

  let raw;
  if (provider === "mock") {
    raw = mockProviderResult(locale);
  } else {
    if (provider !== "gemini") {
      throw createMealScanError(
        "MEAL_SCAN_PROVIDER_NOT_CONFIGURED",
        503,
        "A supported AI provider is required",
      );
    }
    raw = await fetchMealScanEstimate({
      mimeType,
      base64,
      locale,
      declaredIngredients,
    });
  }

  const deduplicated = excludeDeclaredIngredientDuplicates(
    raw,
    resolvedDeclaredIngredients,
  );
  const result = normalizeMealScanResult(deduplicated, locale);
  return mergeDeclaredIngredientsIntoResult(
    result,
    resolvedDeclaredIngredients,
  );
};
