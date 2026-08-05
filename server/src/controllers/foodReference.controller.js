import { lookupFoodReferenceByGtin } from "../services/foodReferenceLookup.service.js";
import { safeLog } from "../utils/safeLogger.js";

export const getFoodReferenceByBarcode = async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  const startedAt = performance.now();

  try {
    const reference = await lookupFoodReferenceByGtin(req.gtin);
    if (!reference) {
      return res.status(404).json({
        success: false,
        code: "FOOD_REFERENCE_NOT_FOUND",
        message: "Không tìm thấy dữ liệu dinh dưỡng đầy đủ cho sản phẩm này",
      });
    }

    safeLog.info("food_reference.lookup_succeeded", {
      latencyMs: Math.round(performance.now() - startedAt),
      provider: reference.source.type,
    });
    return res.json({ success: true, data: reference });
  } catch (error) {
    const status = Number(error?.status) || 503;
    const code = error?.code || "FOOD_REFERENCE_PROVIDER_UNAVAILABLE";
    safeLog.warn("food_reference.lookup_failed", code, { status });
    return res.status(status).json({
      success: false,
      code,
      message: error?.message || "Không thể tra cứu dữ liệu sản phẩm lúc này",
    });
  }
};
