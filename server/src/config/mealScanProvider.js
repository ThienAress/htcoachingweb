const normalized = (value) => String(value || "").trim().toLowerCase();

export const isStagingMealScanMock = (env = process.env) =>
  env.NODE_ENV === "production" &&
  normalized(env.APP_ENV) === "staging" &&
  normalized(env.MEAL_SCAN_PROVIDER) === "mock";

export const isProductionMealScanDisabled = (env = process.env) =>
  env.NODE_ENV === "production" &&
  normalized(env.APP_ENV) === "production" &&
  normalized(env.MEAL_SCAN_PROVIDER) === "disabled";

export const resolveMealScanProvider = (env = process.env) => {
  if (isStagingMealScanMock(env)) return "mock";
  if (isProductionMealScanDisabled(env)) return "disabled";
  if (env.NODE_ENV === "production") return normalized(env.AI_PROVIDER);
  return normalized(env.MEAL_SCAN_PROVIDER) || "mock";
};
