import { isValidGtin, normalizeGtin } from "../services/foodReferenceLookup.service.js";

export const validateFoodReferenceGtin = (req, res, next) => {
  const gtin = normalizeGtin(req.params.gtin);
  if (!isValidGtin(gtin)) {
    return res.status(400).json({
      success: false,
      code: "FOOD_REFERENCE_GTIN_INVALID",
      message: "Mã barcode/GTIN không hợp lệ",
    });
  }
  req.gtin = gtin;
  return next();
};
