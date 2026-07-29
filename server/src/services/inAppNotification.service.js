import mongoose from "mongoose";
import InAppNotification from "../models/InAppNotification.js";
import NotificationPreference from "../models/NotificationPreference.js";
import { incrementMetric } from "../observability/metrics.js";

const TYPE_CONFIG = {
  journal_submitted: {
    category: "journal",
    title: "Có nhật ký ngày mới",
    deepLink: "/trainer/coaching",
  },
  coaching_comment_created: {
    category: "comments",
    title: "Có bình luận coaching mới",
    deepLink: "/today",
  },
  weekly_submitted: {
    category: "weekly",
    title: "Có Weekly Check-in mới",
    deepLink: "/trainer/coaching",
  },
  weekly_corrected: {
    category: "weekly",
    title: "Weekly Check-in đã được cập nhật",
    deepLink: "/trainer/coaching",
  },
  weekly_reviewed: {
    category: "weekly",
    title: "HLV đã review Weekly Check-in",
    deepLink: "/progress",
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
}) => {
  const config = TYPE_CONFIG[type];
  if (!config) {
    throw notificationError(
      400,
      "Notification type không hợp lệ",
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
    const payload = {
      recipientId,
      actorId,
      clientId,
      type,
      category: config.category,
      targetType,
      targetId,
      title: config.title,
      deepLink: deepLink || config.deepLink,
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
    throw notificationError(400, "notificationId không hợp lệ", "INVALID_NOTIFICATION_ID");
  }
  const notification = await InAppNotification.findOneAndUpdate(
    { _id: notificationId, recipientId },
    { $set: { readAt: now } },
    { returnDocument: "after" },
  );
  if (!notification) {
    throw notificationError(404, "Không tìm thấy notification", "NOTIFICATION_NOT_FOUND");
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
