import mongoose from "mongoose";
import Order from "../models/Order.js";
import {
  getMonthWeekPeriod,
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
      "Báo cáo tuần đang tạm dừng ghi dữ liệu",
      "WEEKLY_CHECKIN_WRITES_DISABLED",
    );
  }
};

export const assertMonthWeekPeriodKey = (weekStartDateKey) => {
  parseDateKey(weekStartDateKey);
  if (getMonthWeekPeriod(weekStartDateKey).startDateKey !== weekStartDateKey) {
    throw weeklyCheckinError(
      400,
      "weekStartDateKey phải là ngày đầu kỳ báo cáo trong tháng",
      "INVALID_WEEK_START",
    );
  }
};

export const assertWeeklyCheckinEditWindow = (
  weekStartDateKey,
  now = new Date(),
) => {
  assertMonthWeekPeriodKey(weekStartDateKey);
  const today = getVietnamDateKey(now);
  const currentPeriod = getMonthWeekPeriod(today);
  if (weekStartDateKey === currentPeriod.startDateKey) return "current";

  const selectedPeriod = getMonthWeekPeriod(weekStartDateKey);
  const currentMonth =
    Number(today.slice(0, 4)) * 12 + Number(today.slice(5, 7));
  const selectedMonth =
    Number(selectedPeriod.rangeStartDateKey.slice(0, 4)) * 12 +
    Number(selectedPeriod.rangeStartDateKey.slice(5, 7));
  const monthAge = currentMonth - selectedMonth;
  const isHistorical =
    selectedPeriod.endDateKey < currentPeriod.rangeStartDateKey;

  if (isHistorical && monthAge >= 0 && monthAge <= 3) return "historical";

  throw weeklyCheckinError(
    422,
    "Chỉ có thể ghi kỳ hiện tại hoặc kỳ đã qua trong ba tháng gần nhất",
    "WEEKLY_CHECKIN_EDIT_WINDOW_CLOSED",
  );
};

export const resolveWeeklyCheckinWriteAccess = async ({
  clientId,
  session = null,
}) => {
  const assignment = await resolveClientTrainer({
    clientId,
    session,
    includeClientName: true,
  });
  return {
    trainerId: assignment.trainerId,
    orderId: assignment.order._id,
    clientName: assignment.clientName,
  };
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
