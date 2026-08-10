import {
  createFoodPriceObservation,
  deleteFoodPriceObservation,
  listFoodPriceObservations,
} from "../services/foodPrice.service.js";
import { safeLog } from "../utils/safeLogger.js";

const sendError = (res, error, operation) => {
  const status = error?.statusCode || 500;
  if (status >= 500) {
    safeLog.warn(`food_price.${operation}_failed`, "Food price operation failed", {
      code: error?.code || "INTERNAL_ERROR",
    });
  }
  return res.status(status).json({
    success: false,
    code: error?.code || "FOOD_PRICE_FAILED",
    message: status >= 500 ? "Không thể xử lý dữ liệu giá" : error.message,
  });
};

export const getFoodPriceObservations = async (req, res) => {
  try {
    const data = await listFoodPriceObservations(req.params.id);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendError(res, error, "list");
  }
};

export const addFoodPriceObservation = async (req, res) => {
  try {
    const data = await createFoodPriceObservation(req.params.id, req.body);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return sendError(res, error, "create");
  }
};

export const removeFoodPriceObservation = async (req, res) => {
  try {
    await deleteFoodPriceObservation(req.params.id, req.params.observationId);
    return res.status(200).json({ success: true });
  } catch (error) {
    return sendError(res, error, "delete");
  }
};
