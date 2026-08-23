import mongoose from "mongoose";
import Order from "../models/Order.js";
import {
  addDaysToDateKey,
  getVietnamDateKey,
  parseDateKey,
} from "../utils/dateKey.js";
import { resolveClientTrainer } from "./trainingScheduleCommand.service.js";

export const journalError = (statusCode, message, codeName) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.codeName = codeName;
  return error;
};

export const assertJournalWritesEnabled = () => {
  if (process.env.TODAY_JOURNAL_WRITES_ENABLED !== "true") {
    throw journalError(
      503,
      "Nhật ký ngày đang tạm dừng ghi dữ liệu",
      "TODAY_JOURNAL_WRITES_DISABLED",
    );
  }
};

export const isJournalDateEditable = (
  dateKey,
  now = new Date(),
) => {
  parseDateKey(dateKey);
  const todayKey = getVietnamDateKey(now);
  const earliestKey = addDaysToDateKey(todayKey, -7);
  return dateKey <= todayKey && dateKey >= earliestKey;
};

export const assertJournalEditWindow = (
  dateKey,
  now = new Date(),
) => {
  if (!isJournalDateEditable(dateKey, now)) {
    throw journalError(
      422,
      "Chỉ có thể ghi nhật ký hôm nay và 7 ngày gần nhất",
      "JOURNAL_EDIT_WINDOW_CLOSED",
    );
  }
};

export const resolveJournalWriteAccess = async ({
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

export const assertTrainerJournalRead = async ({
  actor,
  clientId,
}) => {
  if (!mongoose.isValidObjectId(clientId)) {
    throw journalError(400, "clientId không hợp lệ", "INVALID_CLIENT");
  }
  if (actor.role === "admin") return { adminRead: true };
  const order = await Order.findOne({
    userId: clientId,
    trainerId: actor.id,
    status: "approved",
    sessions: { $gt: 0 },
  })
    .select("_id")
    .lean();
  if (!order) {
    throw journalError(
      403,
      "Khách hàng không thuộc phạm vi quản lý hiện tại",
      "JOURNAL_FORBIDDEN",
    );
  }
  return { adminRead: false, orderId: order._id };
};
