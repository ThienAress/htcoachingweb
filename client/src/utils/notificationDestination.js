const isSafeInternalPath = (value) =>
  typeof value === "string" && /^\/(?![\\/])[^\s\\]*$/.test(value);

export const notificationDestination = (notification) => {
  if (isSafeInternalPath(notification?.deepLink)) {
    return notification.deepLink;
  }

  return notification?.targetType === "weekly_checkin"
    ? "/dashboard/progress"
    : "/dashboard";
};
