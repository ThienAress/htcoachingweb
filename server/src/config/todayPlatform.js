const normalizedFlag = (value) => String(value || "").trim().toLowerCase();

export const getTodayPlatformMode = (env = process.env) => {
  const configuredValue = normalizedFlag(env.TODAY_DASHBOARD_ENABLED);
  const explicit = ["true", "false"].includes(configuredValue);
  const runtime = normalizedFlag(env.NODE_ENV);
  const appEnvironment = normalizedFlag(env.APP_ENV);
  const productionApproval =
    normalizedFlag(env.TODAY_PLATFORM_PRODUCTION_APPROVED) === "true";
  const isProduction =
    runtime === "production" && appEnvironment !== "staging";
  const safeNonProductionDefault =
    appEnvironment === "staging" ||
    runtime === "development" ||
    runtime === "test";
  const requested = explicit
    ? configuredValue === "true"
    : safeNonProductionDefault;

  return {
    enabled: requested && (!isProduction || productionApproval),
    explicit,
    productionApproval,
  };
};

export const isTodayPlatformEnabled = (env = process.env) =>
  getTodayPlatformMode(env).enabled;

export const TODAY_PLATFORM_API_PREFIXES = [
  "/api/today-dashboard",
  "/api/daily-journals",
  "/api/wellness-targets",
  "/api/saved-meal-plans",
  "/api/coaching-habits",
  "/api/weekly-checkins",
  "/api/progress",
  "/api/coaching-comments",
  "/api/trainer-overview",
  "/api/notifications",
  "/api/trainer-client-overview",
  "/api/coaching-activity",
];
