import { analyzeMealImage } from "../services/mealScan.service.js";
import { safeLog } from "../utils/safeLogger.js";

const ERROR_MESSAGES = {
  MEAL_SCAN_PROVIDER_NOT_CONFIGURED:
    "Tính năng phân tích ảnh chưa được cấu hình. Vui lòng thử lại sau.",
  MEAL_SCAN_PROVIDER_BUSY:
    "Dịch vụ phân tích đang bận. Vui lòng thử lại sau ít phút.",
  MEAL_SCAN_TIMEOUT:
    "Ảnh mất quá nhiều thời gian để phân tích. Vui lòng thử lại.",
  MEAL_SCAN_INVALID_OUTPUT:
    "AI chưa thể nhận diện món ăn đủ tin cậy. Hãy thử ảnh rõ hơn hoặc góc chụp khác.",
};

const LOCALIZED_ERROR_MESSAGES = {
  vi: {
    ...ERROR_MESSAGES,
    MEAL_SCAN_NO_FOOD:
      "Ảnh chưa có món ăn hoặc đồ uống có thể phân tích. Hãy chụp lại phần ăn rõ hơn.",
    MEAL_SCAN_RETAKE_REQUIRED:
      "Ảnh quá tối, mờ, cháy sáng hoặc bị che. Hãy chụp lại trong điều kiện rõ hơn.",
  },
  en: {
    MEAL_SCAN_PROVIDER_NOT_CONFIGURED:
      "Image analysis is not configured yet. Please try again later.",
    MEAL_SCAN_PROVIDER_BUSY:
      "Image analysis is busy. Please try again in a few minutes.",
    MEAL_SCAN_TIMEOUT:
      "The image took too long to analyze. Please try again.",
    MEAL_SCAN_INVALID_OUTPUT:
      "The meal could not be identified reliably. Try a clearer photo or another angle.",
    MEAL_SCAN_NO_FOOD:
      "No analyzable food or drink is visible. Retake the photo with the serving clearly in frame.",
    MEAL_SCAN_RETAKE_REQUIRED:
      "The photo is too dark, blurry, overexposed or obstructed. Retake it in clearer conditions.",
  },
};

const errorMessageFor = (code, locale) => {
  const language = locale === "en" ? "en" : "vi";
  return LOCALIZED_ERROR_MESSAGES[language][code];
};

export const analyzeMealScan = async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  const startedAt = performance.now();

  try {
    const result = await analyzeMealImage(req.mealScanImage);
    safeLog.info("meal_scan.analyze_succeeded", {
      latencyMs: Math.round(performance.now() - startedAt),
      confidence: result.confidence,
      scenario: result.imageAssessment?.scenario || "unknown",
      itemCount: result.items.length,
    });
    return res.json({ success: true, data: result });
  } catch (error) {
    const status = Number(error?.status) || 500;
    const code = error?.code || "MEAL_SCAN_FAILED";
    safeLog.error("meal_scan.analyze_failed", error, { code, status });

    return res.status(status).json({
      success: false,
      code,
      message:
        errorMessageFor(code, req.mealScanImage?.locale) ||
        "Không thể phân tích ảnh lúc này. Vui lòng thử lại.",
    });
  }
};
