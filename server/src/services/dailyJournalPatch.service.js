import crypto from "node:crypto";
import { journalError } from "./dailyJournalAccess.service.js";
import { normalizeNutritionPatch } from "./dailyJournalNutrition.service.js";
import { normalizeHabitCompletions } from "./dailyJournalHabit.service.js";

const WELLNESS_RULES = {
  sleepHours: { min: 0, max: 24, integer: false },
  waterMl: { min: 0, max: 20000, integer: true },
  steps: { min: 0, max: 200000, integer: true },
  energy: { min: 1, max: 10, integer: true },
  hunger: { min: 1, max: 10, integer: true },
  stress: { min: 1, max: 10, integer: true },
  soreness: { min: 1, max: 10, integer: true },
  pain: { min: 0, max: 10, integer: true },
};
const WELLNESS_KEYS = new Set([
  ...Object.keys(WELLNESS_RULES),
  "painArea",
]);
const NOTE_KEYS = new Set(["private", "shared"]);

const assertPlainObject = (value, field) => {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw journalError(
      400,
      field + " phải là object",
      "INVALID_JOURNAL_PATCH",
    );
  }
};

const validateKeys = (value, allowed, field) => {
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    throw journalError(
      400,
      field + " chứa field không được phép",
      "INVALID_JOURNAL_PATCH",
    );
  }
};

const normalizeNumber = (value, rule, field) => {
  if (value === null) return null;
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < rule.min ||
    value > rule.max ||
    (rule.integer && !Number.isInteger(value))
  ) {
    throw journalError(
      400,
      field + " không hợp lệ",
      "INVALID_JOURNAL_PATCH",
    );
  }
  return value;
};

const normalizeText = (value, maxLength, field) => {
  if (value === null) return "";
  if (typeof value !== "string" || value.trim().length > maxLength) {
    throw journalError(
      400,
      field + " không hợp lệ",
      "INVALID_JOURNAL_PATCH",
    );
  }
  return value.trim();
};

export const normalizeJournalPatch = (patch) => {
  assertPlainObject(patch, "patch");
  validateKeys(
    patch,
    new Set(["wellness", "notes", "nutrition", "habitCompletions"]),
    "patch",
  );
  const setFields = {};

  if (patch.wellness !== undefined) {
    assertPlainObject(patch.wellness, "wellness");
    validateKeys(patch.wellness, WELLNESS_KEYS, "wellness");
    for (const [key, value] of Object.entries(patch.wellness)) {
      setFields["wellness." + key] =
        key === "painArea"
          ? normalizeText(value, 120, "wellness.painArea")
          : normalizeNumber(
              value,
              WELLNESS_RULES[key],
              "wellness." + key,
            );
    }
  }
  if (patch.notes !== undefined) {
    assertPlainObject(patch.notes, "notes");
    validateKeys(patch.notes, NOTE_KEYS, "notes");
    for (const [key, value] of Object.entries(patch.notes)) {
      setFields["notes." + key] = normalizeText(
        value,
        2000,
        "notes." + key,
      );
    }
  }
  if (patch.nutrition !== undefined) {
    Object.assign(setFields, normalizeNutritionPatch(patch.nutrition));
  }
  if (patch.habitCompletions !== undefined) {
    setFields.habitCompletions = normalizeHabitCompletions(
      patch.habitCompletions,
    );
  }
  if (Object.keys(setFields).length === 0) {
    throw journalError(
      400,
      "patch phải có ít nhất một thay đổi",
      "EMPTY_JOURNAL_PATCH",
    );
  }
  return setFields;
};

const comparable = (value) => {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (value?._bsontype === "ObjectId") return String(value);
  if (typeof value.toObject === "function") {
    return comparable(value.toObject({ depopulate: true }));
  }
  if (Array.isArray(value)) return value.map(comparable);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, comparable(value[key])]),
    );
  }
  return value;
};

const valueAtPath = (document, path) => {
  if (typeof document.get === "function") return document.get(path);
  return path.split(".").reduce((value, key) => value?.[key], document);
};

export const buildJournalChanges = (document, setFields) =>
  Object.entries(setFields).flatMap(([path, after]) => {
    const before = comparable(valueAtPath(document, path));
    const normalizedAfter = comparable(after);
    return JSON.stringify(before) === JSON.stringify(normalizedAfter)
      ? []
      : [{ path, before, after: normalizedAfter }];
  });

const stableValue = (value) => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])]),
    );
  }
  return value;
};

export const journalFingerprint = (value) =>
  crypto
    .createHash("sha256")
    .update(JSON.stringify(stableValue(value)))
    .digest("hex");
