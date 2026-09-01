export const F1_INTAKE_DRAFT_ROOT_BY_STEP = Object.freeze({
  1: "customerInfo",
  2: "healthScreening",
  3: "lifestyleNutrition",
  4: "bodyMetrics",
  5: "trainingProfileGoal",
  6: "consent",
});

const F1_INTAKE_DRAFT_FIELDS_BY_ROOT = Object.freeze({
  customerInfo: Object.freeze([
    "fullName",
    "age",
    "gender",
    "occupation",
    "phone",
    "email",
  ]),
  healthScreening: Object.freeze([
    "hasPainNow",
    "painLocation",
    "painLevel",
    "injuries",
    "currentConditions",
    "surgeries",
    "medications",
    "doctorRestrictions",
    "warningSigns",
  ]),
  lifestyleNutrition: Object.freeze([
    "mealsPerDay",
    "usuallyEatOut",
    "foodAllergies",
    "drinkEnoughWater",
    "sleepHours",
    "stressLevel",
    "workActivityLevel",
  ]),
  bodyMetrics: Object.freeze([
    "heightCm",
    "weightKg",
    "bodyFatPercent",
    "waistCm",
    "hipCm",
    "restingHeartRate",
  ]),
  trainingProfileGoal: Object.freeze([
    "currentlyTraining",
    "trainingDaysPerWeek",
    "sessionDurationMinutes",
    "sportsHistory",
    "trainingExperience",
    "breakDuration",
    "primaryGoal",
    "targetWeightKg",
    "targetDeadline",
  ]),
  consent: Object.freeze([
    "allowDataStorage",
    "allowMediaStorage",
    "allowAiAnalysis",
  ]),
});

export const getF1IntakeDraftRoot = (step) =>
  F1_INTAKE_DRAFT_ROOT_BY_STEP[Number(step)] || null;

const isRecord = (value) =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype ||
    Object.getPrototypeOf(value) === null);

const hasUnsafeKey = (value) => {
  if (Array.isArray(value)) return value.some(hasUnsafeKey);
  if (!isRecord(value)) return false;
  return Object.entries(value).some(
    ([key, nested]) =>
      key.startsWith("$") ||
      key.includes(".") ||
      ["__proto__", "constructor", "prototype"].includes(key) ||
      hasUnsafeKey(nested),
  );
};

export const isValidF1IntakeDraftData = ({ step, data }) => {
  const root = getF1IntakeDraftRoot(step);
  if (!root || !isRecord(data) || hasUnsafeKey(data)) return false;
  const keys = Object.keys(data);
  if (keys.length !== 1 || keys[0] !== root || !isRecord(data[root])) {
    return false;
  }
  const allowedFields = F1_INTAKE_DRAFT_FIELDS_BY_ROOT[root];
  return Object.keys(data[root]).every((field) => allowedFields.includes(field));
};

export const sanitizeF1IntakeDraftData = ({ step, data }) => {
  if (!isValidF1IntakeDraftData({ step, data })) return null;
  const root = getF1IntakeDraftRoot(step);
  const value = Object.fromEntries(
    F1_INTAKE_DRAFT_FIELDS_BY_ROOT[root]
      .filter((field) => data[root][field] !== undefined)
      .map((field) => [field, data[root][field]]),
  );
  return { root, value };
};
