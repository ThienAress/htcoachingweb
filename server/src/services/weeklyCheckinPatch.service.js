import crypto from "node:crypto";
import { weeklyCheckinError } from "./weeklyCheckinAccess.service.js";

const BODY_RULES = {
  weightKg: { min: 30, max: 350 },
  waistCm: { min: 30, max: 300 },
  energy: { min: 1, max: 10, integer: true },
  adherence: { min: 1, max: 10, integer: true },
};
const TEXT_FIELDS = new Set(["wins", "challenges", "note"]);
const BODY_FIELDS = new Set([...Object.keys(BODY_RULES), ...TEXT_FIELDS]);

const assertObject = (value, name) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw weeklyCheckinError(
      400,
      name + " phải là object",
      "INVALID_WEEKLY_CHECKIN_PATCH",
    );
  }
};

const assertKnownKeys = (value, allowed, name) => {
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    throw weeklyCheckinError(
      400,
      name + " chứa field không được phép",
      "INVALID_WEEKLY_CHECKIN_PATCH",
    );
  }
};

const normalizeNumber = (value, rule, name) => {
  if (value === null) return null;
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < rule.min ||
    value > rule.max ||
    (rule.integer && !Number.isInteger(value))
  ) {
    throw weeklyCheckinError(
      400,
      name + " không hợp lệ",
      "INVALID_WEEKLY_CHECKIN_PATCH",
    );
  }
  return value;
};

export const normalizeWeeklyCheckinPatch = (patch) => {
  assertObject(patch, "patch");
  assertKnownKeys(patch, new Set(["body"]), "patch");
  assertObject(patch.body, "body");
  assertKnownKeys(patch.body, BODY_FIELDS, "body");
  const setFields = {};
  for (const [key, value] of Object.entries(patch.body)) {
    if (TEXT_FIELDS.has(key)) {
      if (value !== null && typeof value !== "string") {
        throw weeklyCheckinError(
          400,
          "body." + key + " không hợp lệ",
          "INVALID_WEEKLY_CHECKIN_PATCH",
        );
      }
      const normalized = String(value || "").trim();
      if (normalized.length > 2000) {
        throw weeklyCheckinError(
          400,
          "body." + key + " quá dài",
          "INVALID_WEEKLY_CHECKIN_PATCH",
        );
      }
      setFields["body." + key] = normalized;
    } else {
      setFields["body." + key] = normalizeNumber(
        value,
        BODY_RULES[key],
        "body." + key,
      );
    }
  }
  if (Object.keys(setFields).length === 0) {
    throw weeklyCheckinError(
      400,
      "patch phải có ít nhất một thay đổi",
      "EMPTY_WEEKLY_CHECKIN_PATCH",
    );
  }
  return setFields;
};

export const normalizeTrainerReview = (review) => {
  assertObject(review, "review");
  assertKnownKeys(review, new Set(["message", "rating"]), "review");
  if (typeof review.message !== "string") {
    throw weeklyCheckinError(400, "review.message không hợp lệ", "INVALID_REVIEW");
  }
  const message = review.message.trim();
  if (message.length < 1 || message.length > 2000) {
    throw weeklyCheckinError(400, "review.message không hợp lệ", "INVALID_REVIEW");
  }
  const rating =
    review.rating === undefined || review.rating === null
      ? null
      : normalizeNumber(
          review.rating,
          { min: 1, max: 10, integer: true },
          "review.rating",
        );
  return { message, rating };
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

const valueAtPath = (document, path) =>
  typeof document.get === "function"
    ? document.get(path)
    : path.split(".").reduce((value, key) => value?.[key], document);

export const buildWeeklyCheckinChanges = (document, setFields) =>
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

export const weeklyCheckinFingerprint = (value) =>
  crypto
    .createHash("sha256")
    .update(JSON.stringify(stableValue(value)))
    .digest("hex");
