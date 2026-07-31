import mongoose from "mongoose";
import Order from "../models/Order.js";

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
  const filter = {
    userId: clientId,
    status: "approved",
    sessions: { $gt: 0 },
    ...(actor.isAdmin ? {} : { trainerId: actor.id }),
  };
  let query = Order.findOne(filter).select("_id trainerId");
  if (session) query = query.session(session);
  const order = await query.lean();
  if (!order) {
    throw wellnessTargetError(
      403,
      "Học viên không thuộc phạm vi huấn luyện đang hoạt động",
      "WELLNESS_TARGET_FORBIDDEN",
    );
  }
  return { orderId: order._id, trainerId: order.trainerId };
};
