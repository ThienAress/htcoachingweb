const isSafeInternalPath = (value) =>
  typeof value === "string" && /^\/(?![\\/])[^\s\\]*$/.test(value);

const TRAINER_REPORT_PATH = /^\/trainer\/(?:health\/)?clients\/[^/?#]+$/;
const TASK_REPORT_HASHES = new Set(["#journal", "#nutrition-report"]);

const canonicalizeTrainerReportPath = (value) => {
  try {
    const url = new URL(value, "https://htcoaching.local");
    if (
      !TRAINER_REPORT_PATH.test(url.pathname) ||
      !TASK_REPORT_HASHES.has(url.hash)
    ) {
      return value;
    }
    const nextParams = new URLSearchParams();
    nextParams.set("tab", "tasks");
    for (const [key, entryValue] of url.searchParams.entries()) {
      if (key !== "tab") nextParams.append(key, entryValue);
    }
    const search = nextParams.toString();
    return url.pathname + (search ? "?" + search : "") + url.hash;
  } catch {
    return value;
  }
};

export const notificationDestination = (notification) => {
  if (isSafeInternalPath(notification?.deepLink)) {
    return canonicalizeTrainerReportPath(notification.deepLink);
  }

  return notification?.targetType === "weekly_checkin"
    ? "/dashboard/progress"
    : "/dashboard";
};
