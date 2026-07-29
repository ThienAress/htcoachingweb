import mongoose from "mongoose";
import Order from "../models/Order.js";
import {
  addDaysToDateKey,
  getAppDayOfWeek,
  getVietnamDateKey,
  parseDateKey,
} from "../utils/dateKey.js";
import { resolveClientTrainer } from "./trainingScheduleCommand.service.js";

export const weeklyCheckinError = (statusCode, message, codeName) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.codeName = codeName;
  return error;
};

export const assertWeeklyCheckinWritesEnabled = () => {
  if (process.env.TODAY_WEEKLY_CHECKIN_WRITES_ENABLED !== "true") {
    throw weeklyCheckinError(
      503,
      "Weekly Check-in đang tạm dừng ghi dữ liệu",
      "WEEKLY_CHECKIN_WRITES_DISABLED",
    );
  }
};

export const assertMondayWeekKey = (weekStartDateKey) => {
  parseDateKey(weekStartDateKey);
  if (getAppDayOfWeek(weekStartDateKey) !== 0) {
    throw weeklyCheckinError(
      400,
      "weekStartDateKey phải là thứ Hai",
      "INVALID_WEEK_START",
    );
  }
};

export const assertWeeklyCheckinEditWindow = (
  weekStartDateKey,
  now = new Date(),
) => {
  assertMondayWeekKey(weekStartDateKey);
  const today = getVietnamDateKey(now);
  const currentWeek = addDaysToDateKey(today, -getAppDayOfWeek(today));
  const previousWeek = addDaysToDateKey(currentWeek, -7);
  if (weekStartDateKey !== currentWeek && weekStartDateKey !== previousWeek) {
    throw weeklyCheckinError(
      422,
      "Chỉ có thể ghi check-in của tuần hiện tại hoặc tuần trước",
      "WEEKLY_CHECKIN_EDIT_WINDOW_CLOSED",
    );
  }
};

export const resolveWeeklyCheckinWriteAccess = async ({
  clientId,
  session = null,
}) => {
  const assignment = await resolveClientTrainer({ clientId, session });
  return { trainerId: assignment.trainerId, orderId: assignment.order._id };
};

export const assertTrainerWeeklyCheckinRead = async ({
  actor,
  clientId,
  session = null,
}) => {
  if (!mongoose.isValidObjectId(clientId)) {
    throw weeklyCheckinError(400, "clientId không hợp lệ", "INVALID_CLIENT");
  }
  if (actor.role === "admin") return { adminRead: true };
  let query = Order.findOne({
    userId: clientId,
    trainerId: actor.id,
    status: "approved",
    sessions: { $gt: 0 },
  }).select("_id");
  if (session) query = query.session(session);
  const order = await query.lean();
  if (!order) {
    throw weeklyCheckinError(
      403,
      "Khách hàng không thuộc phạm vi quản lý hiện tại",
      "WEEKLY_CHECKIN_FORBIDDEN",
    );
  }
  return { adminRead: false, orderId: order._id };
};
