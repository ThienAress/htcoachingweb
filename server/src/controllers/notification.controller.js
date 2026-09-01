import {
  listInAppNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/inAppNotification.service.js";
import {
  getNotificationPreference,
  updateNotificationPreference,
} from "../services/notificationPreference.service.js";
import { safeLog } from "../utils/safeLogger.js";

const privateResponse = (res) =>
  res.setHeader("Cache-Control", "private, no-store");
const sendError = (res, error, event) => {
  const status = error.statusCode || 500;
  if (status >= 500) safeLog.error(event, error);
  return res.status(status).json({
    success: false,
    code: error.codeName || error.code || "NOTIFICATION_FAILED",
    message:
      status >= 500
        ? "Không thể xử lý notification lúc này"
        : error.message,
  });
};

export const listMyNotifications = async (req, res) => {
  privateResponse(res);
  try {
    const data = await listInAppNotifications({
      recipientId: req.user.id,
      status: req.query.status || "all",
      page: Number(req.query.page || 1),
      limit: Number(req.query.limit || 20),
    });
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error, "notification.list_failed");
  }
};

export const readNotification = async (req, res) => {
  privateResponse(res);
  try {
    const data = await markNotificationRead({
      recipientId: req.user.id,
      notificationId: req.params.notificationId,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error, "notification.read_failed");
  }
};

export const readAllNotifications = async (req, res) => {
  privateResponse(res);
  try {
    const data = await markAllNotificationsRead({
      recipientId: req.user.id,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error, "notification.read_all_failed");
  }
};

export const getMyNotificationPreference = async (req, res) => {
  privateResponse(res);
  try {
    const data = await getNotificationPreference(req.user.id);
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error, "notification.preference_read_failed");
  }
};

export const updateMyNotificationPreference = async (req, res) => {
  privateResponse(res);
  try {
    const data = await updateNotificationPreference({
      recipientId: req.user.id,
      expectedRevision: req.body.expectedRevision,
      input: {
        inAppEnabled: req.body.inAppEnabled,
        comments: req.body.comments,
        journal: req.body.journal,
        weekly: req.body.weekly,
        ...(req.body.morningHealthEmail !== undefined
          ? { morningHealthEmail: req.body.morningHealthEmail }
          : {}),
      },
    });
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error, "notification.preference_update_failed");
  }
};
