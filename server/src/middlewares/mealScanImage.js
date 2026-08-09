import { resolveGeminiMealScanDataUseMode } from "../config/geminiMealScanDataUse.js";

const SUPPORTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const MAX_MEAL_SCAN_IMAGE_BYTES = 300 * 1024;
export const MAX_MEAL_SCAN_DECLARED_INGREDIENTS = 8;
const MAX_DECLARED_INGREDIENT_NAME_LENGTH = 80;
const MAX_DECLARED_INGREDIENT_GRAMS = 3_000;

const dataUrlByteLength = (base64) => {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
};

const normalizeDeclaredIngredients = (value) => {
  if (value === undefined) return [];
  if (
    !Array.isArray(value) ||
    value.length > MAX_MEAL_SCAN_DECLARED_INGREDIENTS
  ) {
    return null;
  }

  const ingredients = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const name = String(item.name || "").trim().replace(/\s+/g, " ");
    const grams = Number(item.grams);
    if (
      !name ||
      name.length > MAX_DECLARED_INGREDIENT_NAME_LENGTH ||
      !Number.isFinite(grams) ||
      grams < 1 ||
      grams > MAX_DECLARED_INGREDIENT_GRAMS
    ) {
      return null;
    }
    ingredients.push({ name, grams: Math.round(grams * 10) / 10 });
  }
  return ingredients;
};

export const validateMealScanImage = (req, res, next) => {
  const image = req.body?.image;
  const locale = req.body?.locale ?? "vi";
  const declaredIngredients = normalizeDeclaredIngredients(
    req.body?.declaredIngredients,
  );

  if (locale !== "vi" && locale !== "en") {
    return res.status(400).json({
      success: false,
      code: "MEAL_SCAN_INVALID_LOCALE",
      message: "Ngôn ngữ không hợp lệ.",
    });
  }

  if (declaredIngredients === null) {
    return res.status(400).json({
      success: false,
      code: "MEAL_SCAN_DECLARED_INGREDIENTS_INVALID",
      message: "Thành phần khai báo hoặc trọng lượng không hợp lệ.",
    });
  }

  if (typeof image !== "string") {
    return res.status(400).json({
      success: false,
      code: "MEAL_SCAN_IMAGE_REQUIRED",
      message: "Vui lòng chọn một ảnh món ăn.",
    });
  }

  const match = image.match(
    /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/,
  );
  if (!match || !SUPPORTED_IMAGE_TYPES.has(match[1])) {
    return res.status(400).json({
      success: false,
      code: "MEAL_SCAN_IMAGE_TYPE_INVALID",
      message: "Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP.",
    });
  }

  if (dataUrlByteLength(match[2]) > MAX_MEAL_SCAN_IMAGE_BYTES) {
    return res.status(413).json({
      success: false,
      code: "MEAL_SCAN_IMAGE_TOO_LARGE",
      message: "Ảnh sau khi nén không được vượt quá 300 KB.",
    });
  }

  if (
    resolveGeminiMealScanDataUseMode(process.env) === "unpaid" &&
    req.body?.providerDataUseAccepted !== true
  ) {
    return res.status(400).json({
      success: false,
      code: "MEAL_SCAN_DATA_USE_CONSENT_REQUIRED",
      message: locale === "en"
        ? "Confirm Google Gemini Free Tier data use before analysis."
        : "Vui lòng xác nhận việc Google Gemini Free Tier xử lý dữ liệu trước khi phân tích.",
    });
  }

  req.mealScanImage = {
    mimeType: match[1],
    base64: match[2],
    locale,
    declaredIngredients,
  };
  delete req.body.image;
  delete req.body.declaredIngredients;
  delete req.body.providerDataUseAccepted;
  next();
};
