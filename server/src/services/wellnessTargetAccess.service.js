import mongoose from "mongoose";
import { assertEffectiveCoachAccess, resolveEffectiveClientCoach } from "./effectiveCoach.service.js";

export const wellnessTargetError = (statusCode, message, codeName) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.codeName = codeName;
  return error;
};

export const assertWellnessTargetWritesEnabled = () => {
  if (process.env.TODAY_WELLNESS_TARGET_WRITES_ENABLED !== "true") {
    throw wellnessTargetError(
      503,
      "Tính năng mục tiêu sức khỏe đang tạm dừng ghi dữ liệu",
      "WELLNESS_TARGET_WRITES_DISABLED",
    );
  }
};

export const resolveCoachClientTargetAccess = async ({
  actor,
  clientId,
  session = null,
}) => {
  if (!mongoose.isValidObjectId(clientId)) {
    throw wellnessTargetError(
      400,
      "clientId không hợp lệ",
      "INVALID_CLIENT",
    );
  }
  try {
    // Keep audited admin operations separate from the responsible coach identity.
    const assignment = actor.isAdmin
      ? await resolveEffectiveClientCoach({ clientId, session })
      : await assertEffectiveCoachAccess({ actor, clientId, session });
    return { orderId: assignment.order._id, trainerId: assignment.trainerId };
  } catch (error) {
    if (error.statusCode !== 403) throw error;
    throw wellnessTargetError(
      403,
      "Học viên không thuộc phạm vi huấn luyện đang hoạt động",
      "WELLNESS_TARGET_FORBIDDEN",
    );
  }
};
