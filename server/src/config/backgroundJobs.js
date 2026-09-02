import { isTodayPlatformEnabled } from "./todayPlatform.js";

const booleanMode = (value) => {
  const configuredValue = String(value || "").trim().toLowerCase();
  return {
    enabled: configuredValue === "true",
    explicit: ["true", "false"].includes(configuredValue),
  };
};

export const getBackgroundJobsMode = (env = process.env) => {
  return booleanMode(env.BACKGROUND_JOBS_ENABLED);
};

export const getMorningHealthReminderMode = (env = process.env) => {
  const configured = booleanMode(env.MORNING_HEALTH_REMINDER_ENABLED);
  return {
    enabled:
      configured.enabled &&
      isTodayPlatformEnabled(env) &&
      String(env.TODAY_JOURNAL_WRITES_ENABLED || "").toLowerCase() === "true",
    explicit: configured.explicit,
  };
};
