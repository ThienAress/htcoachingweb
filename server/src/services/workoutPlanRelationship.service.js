import mongoose from "mongoose";

import User from "../models/User.js";
import { resolveEffectiveClientCoach } from "./effectiveCoach.service.js";

const relationshipError = ({
  statusCode = 403,
  code = "WORKOUT_PLAN_RELATIONSHIP_REQUIRED",
  message = "Không tìm thấy quan hệ huấn luyện đã được phê duyệt và còn buổi",
} = {}) =>
  Object.assign(
    new Error(message),
    {
      code,
      statusCode,
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

  let assignment;
  try {
    assignment = await resolveEffectiveClientCoach({ clientId: client._id });
  } catch (error) {
    if (error?.codeName === "COACH_ASSIGNMENT_CONFLICT") {
      throw relationshipError({
        statusCode: 409,
        code: error.codeName,
        message: error.message,
      });
    }
    throw relationshipError();
  }
  if (trainerId && String(assignment.trainerId) !== String(trainerId)) {
    throw relationshipError();
  }
  if (!isAdmin && String(assignment.trainerId) !== String(actorId)) {
    throw relationshipError();
  }

  return {
    clientId: client._id,
    clientEmail: normalizeEmail(client.email),
    trainerId: assignment.trainerId,
  };
};

export const isWorkoutPlanRelationshipError = (error) =>
  [
    "WORKOUT_PLAN_RELATIONSHIP_REQUIRED",
    "COACH_ASSIGNMENT_CONFLICT",
  ].includes(error?.code);
