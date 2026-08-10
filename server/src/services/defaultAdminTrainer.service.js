import mongoose from "mongoose";

import User from "../models/User.js";

const defaultTrainerError = (message, codeName) => {
  const error = new Error(message);
  error.statusCode = 409;
  error.codeName = codeName;
  return error;
};

const firstAdminEmail = (value) =>
  String(value || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .find(Boolean) || null;

export const selectDefaultAdminTrainer = (env = process.env) => {
  const configuredId = String(env.DEFAULT_ADMIN_TRAINER_ID || "").trim();
  if (configuredId) {
    if (!mongoose.isValidObjectId(configuredId)) {
      throw defaultTrainerError(
        "Cấu hình huấn luyện viên mặc định không hợp lệ",
        "INVALID_DEFAULT_TRAINER_CONFIG",
      );
    }
    return { mode: "id", value: configuredId };
  }

  const configuredEmail = firstAdminEmail(env.ADMIN_EMAIL);
  if (!configuredEmail) {
    throw defaultTrainerError(
      "Gói tập chưa được phân công huấn luyện viên",
      "TRAINER_ASSIGNMENT_REQUIRED",
    );
  }
  return { mode: "email", value: configuredEmail };
};

export const resolveDefaultAdminTrainer = async ({
  env = process.env,
  session = null,
} = {}) => {
  const selector = selectDefaultAdminTrainer(env);
  const filter =
    selector.mode === "id"
      ? { _id: selector.value, role: "admin" }
      : { email: selector.value, role: "admin" };
  let query = User.findOne(filter).select("_id role email");
  if (session) query = query.session(session);
  const trainer = await query;
  if (!trainer) {
    throw defaultTrainerError(
      "Huấn luyện viên mặc định chưa được cấu hình hợp lệ",
      "INVALID_DEFAULT_TRAINER",
    );
  }
  return trainer;
};
