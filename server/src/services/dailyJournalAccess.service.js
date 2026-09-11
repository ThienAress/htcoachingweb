import mongoose from "mongoose";
import {
  addDaysToDateKey,
  getVietnamDateKey,
  parseDateKey,
} from "../utils/dateKey.js";
import { resolveClientTrainer } from "./trainingScheduleCommand.service.js";
import { resolveCustomerDashboardAccess } from "./customerDashboardAccess.service.js";
import { assertEffectiveCoachAccess } from "./effectiveCoach.service.js";

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
  clientRole = "user",
  session = null,
}) => {
  const access = await resolveCustomerDashboardAccess({
    id: clientId,
    role: clientRole,
  }, { session });
  if (access.accessMode === "self_managed") {
    return {
      mode: "self_managed",
      trainerId: null,
      orderId: null,
      clientName: "",
    };
  }
  if (access.accessMode === "blocked") {
    throw journalError(
      403,
      "Bạn cần có gói coaching hoặc HT Fitness+ còn hiệu lực để ghi nhật ký",
      "JOURNAL_ENTITLEMENT_REQUIRED",
    );
  }
  const assignment = await resolveClientTrainer({
    clientId,
    session,
    includeClientName: true,
  });
  return {
    mode: "coaching",
    trainerId: assignment.trainerId,
    orderId: assignment.order._id,
    clientName: assignment.clientName,
  };
};

export const assertTrainerJournalRead = async ({
  actor,
  clientId,
  session = null,
}) => {
  if (!mongoose.isValidObjectId(clientId)) {
    throw journalError(400, "clientId không hợp lệ", "INVALID_CLIENT");
  }
  if (actor.role === "admin") return { adminRead: true };
  try {
    const { order } = await assertEffectiveCoachAccess({ actor, clientId, session });
    return { adminRead: false, orderId: order._id };
  } catch (error) {
    if (error.statusCode !== 403) throw error;
    throw journalError(
      403,
      "Khách hàng không thuộc phạm vi quản lý hiện tại",
      "JOURNAL_FORBIDDEN",
    );
  }
};
