import mongoose from "mongoose";

import Order from "../models/Order.js";
import User from "../models/User.js";

const relationshipError = () =>
  Object.assign(
    new Error("Không tìm thấy quan hệ huấn luyện đã được phê duyệt và còn buổi"),
    {
      code: "WORKOUT_PLAN_RELATIONSHIP_REQUIRED",
      statusCode: 403,
    },
  );

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

export const resolveWorkoutPlanRelationship = async ({
  actorId,
  isAdmin = false,
  clientId = null,
  clientEmail = "",
  trainerId = null,
}) => {
  const normalizedEmail = normalizeEmail(clientEmail);
  const clientFilter = mongoose.isValidObjectId(clientId)
    ? { _id: clientId }
    : normalizedEmail
      ? { email: normalizedEmail }
      : null;
  if (!clientFilter) throw relationshipError();

  const client = await User.findOne(clientFilter).select("_id email name").lean();
  if (!client || (normalizedEmail && normalizeEmail(client.email) !== normalizedEmail)) {
    throw relationshipError();
  }

  const orderFilter = {
    userId: client._id,
    status: "approved",
    sessions: { $gt: 0 },
  };
  if (isAdmin) {
    if (trainerId) orderFilter.trainerId = trainerId;
  } else {
    orderFilter.trainerId = actorId;
  }

  const order = await Order.findOne(orderFilter)
    .select("trainerId")
    .sort({ approvedAt: -1, updatedAt: -1, _id: -1 })
    .lean();
  if (!order?.trainerId) throw relationshipError();

  return {
    clientId: client._id,
    clientEmail: normalizeEmail(client.email),
    trainerId: order.trainerId,
  };
};

export const isWorkoutPlanRelationshipError = (error) =>
  error?.code === "WORKOUT_PLAN_RELATIONSHIP_REQUIRED";
