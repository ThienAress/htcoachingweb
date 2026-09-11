import mongoose from "mongoose";
import { resolveEffectiveClientCoach } from "./effectiveCoach.service.js";
import SavedMealPlan from "../models/SavedMealPlan.js";

export const savedMealPlanError = (statusCode, message, codeName) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.codeName = codeName;
  return error;
};

export const assertSavedMealPlanWritesEnabled = () => {
  if (process.env.TODAY_MEAL_PLAN_WRITES_ENABLED !== "true") {
    throw savedMealPlanError(
      503,
      "Tính năng lưu meal plan đang tạm dừng",
      "SAVED_MEAL_PLAN_WRITES_DISABLED",
    );
  }
};

export const resolveSavedMealPlanTrainerMetadata = async ({
  ownerId,
  session = null,
}) => {
  try {
    const assignment = await resolveEffectiveClientCoach({ clientId: ownerId, session });
    return { trainerId: assignment.trainerId, orderId: assignment.order._id };
  } catch (error) {
    if (error.codeName === "NO_ACTIVE_ORDER") return { trainerId: null, orderId: null };
    throw error;
  }
};

export const findOwnedSavedMealPlan = async ({
  ownerId,
  planId,
  session = null,
  includeInternal = false,
}) => {
  if (!mongoose.isValidObjectId(planId)) {
    throw savedMealPlanError(
      400,
      "Meal plan ID không hợp lệ",
      "INVALID_SAVED_MEAL_PLAN_ID",
    );
  }
  let query = SavedMealPlan.findOne({ _id: planId, ownerId });
  if (includeInternal) {
    query = query.select(
      "+commandType +createdByRequestId +payloadFingerprint +archiveRequestId +archiveFingerprint",
    );
  }
  if (session) query = query.session(session);
  const plan = await query;
  if (!plan) {
    throw savedMealPlanError(
      404,
      "Không tìm thấy meal plan",
      "SAVED_MEAL_PLAN_NOT_FOUND",
    );
  }
  return plan;
};
