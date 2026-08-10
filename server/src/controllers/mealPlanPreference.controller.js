import {
  getOwnMealPlanPreferences,
  updateOwnMealPlanPreferences,
} from "../services/mealPlanPreference.service.js";
import { safeLog } from "../utils/safeLogger.js";

const sendError = (res, error, operation) => {
  const status = error?.statusCode || 500;
  if (status >= 500) {
    safeLog.warn(
      `meal_plan_preferences.${operation}_failed`,
      "Meal Plan preference operation failed",
      { code: error?.code || "INTERNAL_ERROR" },
    );
  }
  return res.status(status).json({
    success: false,
    code: error?.code || "MEAL_PLAN_PREFERENCES_FAILED",
    message: status >= 500 ? "Không thể xử lý điều kiện thực đơn" : error.message,
  });
};

export const getMyMealPlanPreferences = async (req, res) => {
  try {
    const data = await getOwnMealPlanPreferences(req.user.id);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendError(res, error, "read");
  }
};

export const updateMyMealPlanPreferences = async (req, res) => {
  try {
    const data = await updateOwnMealPlanPreferences(req.user.id, req.body);
    return res.status(200).json({
      success: true,
      message: "Đã lưu điều kiện thực đơn",
      data,
    });
  } catch (error) {
    return sendError(res, error, "update");
  }
};
