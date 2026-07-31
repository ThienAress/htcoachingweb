import api from "../utils/api";

export const listNotifications = (params) =>
  api.get("/notifications", { params });

export const markNotificationRead = (notificationId) =>
  api.post(
    "/notifications/" + encodeURIComponent(notificationId) + "/read",
  );

export const markAllNotificationsRead = () =>
  api.post("/notifications/read-all");

export const getNotificationPreferences = () =>
  api.get("/notifications/preferences");

export const updateNotificationPreferences = (payload) =>
  api.put("/notifications/preferences", payload);
