import mongoose from "mongoose";
import {
  getMonthWeekPeriod,
  getVietnamDateKey,
  parseDateKey,
} from "../utils/dateKey.js";
import { resolveClientTrainer } from "./trainingScheduleCommand.service.js";
import { resolveCustomerDashboardAccess } from "./customerDashboardAccess.service.js";
import { assertEffectiveCoachAccess } from "./effectiveCoach.service.js";

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
    throw weeklyCheckinError(
      403,
      "Bạn cần có gói coaching hoặc HT Fitness+ còn hiệu lực để lưu số đo",
      "WEEKLY_CHECKIN_ENTITLEMENT_REQUIRED",
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

export const assertTrainerWeeklyCheckinRead = async ({
  actor,
  clientId,
  session = null,
}) => {
  if (!mongoose.isValidObjectId(clientId)) {
    throw weeklyCheckinError(400, "clientId không hợp lệ", "INVALID_CLIENT");
  }
  if (actor.role === "admin") return { adminRead: true };
  try {
    const { order } = await assertEffectiveCoachAccess({ actor, clientId, session });
    return { adminRead: false, orderId: order._id };
  } catch (error) {
    if (error.statusCode !== 403) throw error;
    throw weeklyCheckinError(
      403,
      "Khách hàng không thuộc phạm vi quản lý hiện tại",
      "WEEKLY_CHECKIN_FORBIDDEN",
    );
  }
};
