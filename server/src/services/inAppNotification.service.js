import mongoose from "mongoose";
import InAppNotification from "../models/InAppNotification.js";
import NotificationPreference from "../models/NotificationPreference.js";
import { incrementMetric } from "../observability/metrics.js";
import { COACHING_SUBMISSION_FIELD_KEYS } from "../constants/coachingSubmissionFields.js";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SAFE_INTERNAL_PATH_PATTERN = /^\/(?![\\/])[^\s\\]*$/;
const MISSING_FIELD_KEYS = new Set(COACHING_SUBMISSION_FIELD_KEYS);
const TASK_REPORT_SECTIONS = new Set(["journal", "nutrition-report"]);

const normalizedMissingFields = (values) => [
  ...new Set(
    (Array.isArray(values) ? values : []).filter((value) =>
      MISSING_FIELD_KEYS.has(value),
    ),
  ),
];

const normalizedClientName = (value) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 70);

const clientEventTitle = (clientName, action) => {
  const name = normalizedClientName(clientName);
  return name
    ? "Khách hàng " + name + " " + action
    : "Khách hàng " + action;
};

const trainerClientDeepLink = ({
  clientId,
  contextDateKey,
  section,
}) => {
  const base = "/trainer/clients/" + encodeURIComponent(String(clientId));
  const params = new URLSearchParams();
  if (TASK_REPORT_SECTIONS.has(section)) params.set("tab", "tasks");
  if (DATE_KEY_PATTERN.test(String(contextDateKey || ""))) {
    params.set("date", contextDateKey);
  }
  const query = params.toString();
  return base + (query ? "?" + query : "") + "#" + section;
};

const clientWeeklyDeepLink = ({ contextDateKey }) =>
  DATE_KEY_PATTERN.test(String(contextDateKey || ""))
    ? "/dashboard/today/" +
      encodeURIComponent(contextDateKey) +
      "/journal#weekly-report"
    : "/dashboard";

const TYPE_CONFIG = {
  journal_submitted: {
    category: "journal",
    title: ({ clientName }) =>
      clientEventTitle(clientName, "đã gửi nhật ký ngày"),
    deepLink: (context) =>
      trainerClientDeepLink({ ...context, section: "journal" }),
  },
  journal_corrected: {
    category: "journal",
    title: ({ clientName }) =>
      clientEventTitle(clientName, "đã cập nhật nhật ký ngày"),
    deepLink: (context) =>
      trainerClientDeepLink({ ...context, section: "journal" }),
  },
  nutrition_submitted: {
    category: "journal",
    title: ({ clientName }) =>
      clientEventTitle(clientName, "đã gửi báo cáo dinh dưỡng"),
    deepLink: (context) =>
      trainerClientDeepLink({ ...context, section: "nutrition-report" }),
  },
  coaching_comment_created: {
    category: "comments",
    title: () => "Có bình luận huấn luyện mới",
    deepLink: "/today",
  },
  weekly_submitted: {
    category: "weekly",
    title: ({ clientName }) =>
      clientEventTitle(clientName, "đã gửi báo cáo tuần"),
    deepLink: (context) =>
      trainerClientDeepLink({ ...context, section: "weekly-report" }),
  },
  weekly_corrected: {
    category: "weekly",
    title: ({ clientName }) =>
      clientEventTitle(clientName, "đã cập nhật báo cáo tuần"),
    deepLink: (context) =>
      trainerClientDeepLink({ ...context, section: "weekly-report" }),
  },
  weekly_reviewed: {
    category: "weekly",
    title: () => "Huấn luyện viên đã nhận xét báo cáo tuần",
    deepLink: clientWeeklyDeepLink,
  },
};

export const notificationError = (statusCode, message, codeName) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.codeName = codeName;
  return error;
};

const preferenceAllows = async ({ recipientId, category, session }) => {
  let query = NotificationPreference.findOne({ recipientId });
  if (session) query = query.session(session);
  const preference = await query.lean();
  return (
    !preference ||
    (preference.inAppEnabled === true && preference[category] === true)
  );
};

export const createInAppNotification = async ({
  recipientId,
  actorId = null,
  clientId,
  type,
  targetType,
  targetId,
  dedupeKey,
  session = null,
  allowSelf = false,
  deepLink = null,
  clientName = "",
  contextDateKey = "",
  missingFields = [],
}) => {
  const config = TYPE_CONFIG[type];
  if (!config) {
    throw notificationError(
      400,
      "Loại thông báo không hợp lệ",
      "INVALID_NOTIFICATION_TYPE",
    );
  }
  if (
    !allowSelf &&
    actorId &&
    String(actorId) === String(recipientId)
  ) {
    return { created: false, suppressed: true, reason: "self" };
  }
  if (
    !(await preferenceAllows({
      recipientId,
      category: config.category,
      session,
    }))
  ) {
    incrementMetric("notification.suppressed");
    return { created: false, suppressed: true, reason: "preference" };
  }
  let existingQuery = InAppNotification.findOne({ recipientId, dedupeKey });
  if (session) existingQuery = existingQuery.session(session);
  const existing = await existingQuery;
  if (existing) {
    incrementMetric("notification.deduped");
    return { created: false, suppressed: false, notification: existing };
  }
  try {
    const notificationContext = {
      clientId,
      clientName,
      contextDateKey,
    };
    const resolvedDeepLink =
      deepLink ||
      (typeof config.deepLink === "function"
        ? config.deepLink(notificationContext)
        : config.deepLink);
    if (!SAFE_INTERNAL_PATH_PATTERN.test(resolvedDeepLink)) {
      throw notificationError(
        400,
        "Đường dẫn thông báo không hợp lệ",
        "INVALID_NOTIFICATION_DEEP_LINK",
      );
    }
    const payload = {
      recipientId,
      actorId,
      clientId,
      type,
      category: config.category,
      targetType,
      targetId,
      title:
        typeof config.title === "function"
          ? config.title(notificationContext)
          : config.title,
      missingFields: normalizedMissingFields(missingFields),
      deepLink: resolvedDeepLink,
      dedupeKey: String(dedupeKey).slice(0, 180),
    };
    const notification = session
      ? (await InAppNotification.create([payload], { session }))[0]
      : await InAppNotification.create(payload);
    incrementMetric("notification.created");
    return { created: true, suppressed: false, notification };
  } catch (error) {
    if (error?.code !== 11000) throw error;
    let replayQuery = InAppNotification.findOne({ recipientId, dedupeKey });
    if (session) replayQuery = replayQuery.session(session);
    const notification = await replayQuery;
    incrementMetric("notification.deduped");
    return { created: false, suppressed: false, notification };
  }
};

const dto = (notification) => ({
  _id: notification._id,
  type: notification.type,
  category: notification.category,
  targetType: notification.targetType,
  targetId: notification.targetId,
  title: notification.title,
  missingFields: notification.missingFields || [],
  deepLink: notification.deepLink,
  readAt: notification.readAt || null,
  createdAt: notification.createdAt,
});

export const listInAppNotifications = async ({
  recipientId,
  status = "all",
  page = 1,
  limit = 20,
}) => {
  const filter = {
    recipientId,
    ...(status === "unread" ? { readAt: null } : {}),
  };
  const [items, total, unreadCount] = await Promise.all([
    InAppNotification.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    InAppNotification.countDocuments(filter),
    InAppNotification.countDocuments({ recipientId, readAt: null }),
  ]);
  return {
    items: items.map(dto),
    unreadCount,
    pagination: { page, limit, total },
  };
};

export const markNotificationRead = async ({
  recipientId,
  notificationId,
  now = new Date(),
}) => {
  if (!mongoose.isValidObjectId(notificationId)) {
    throw notificationError(
      400,
      "Mã thông báo không hợp lệ",
      "INVALID_NOTIFICATION_ID",
    );
  }
  const notification = await InAppNotification.findOneAndUpdate(
    { _id: notificationId, recipientId },
    { $set: { readAt: now } },
    { returnDocument: "after" },
  );
  if (!notification) {
    throw notificationError(
      404,
      "Không tìm thấy thông báo",
      "NOTIFICATION_NOT_FOUND",
    );
  }
  incrementMetric("notification.read");
  return dto(notification);
};

export const markAllNotificationsRead = async ({
  recipientId,
  now = new Date(),
}) => {
  const updated = await InAppNotification.updateMany(
    { recipientId, readAt: null },
    { $set: { readAt: now } },
  );
  if (updated.modifiedCount > 0) {
    incrementMetric("notification.read", updated.modifiedCount);
  }
  return { updated: updated.modifiedCount };
};
