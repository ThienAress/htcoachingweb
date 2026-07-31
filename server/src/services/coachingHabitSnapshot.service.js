import crypto from "node:crypto";
import { parseDateKey } from "../utils/dateKey.js";
import { habitError } from "./coachingHabitAccess.service.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CATEGORIES = new Set([
  "nutrition",
  "movement",
  "recovery",
  "mindset",
  "other",
]);

const text = (value, { field, min = 0, max }) => {
  if (typeof value !== "string") {
    throw habitError(400, field + " không hợp lệ", "INVALID_HABIT");
  }
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) {
    throw habitError(400, field + " không hợp lệ", "INVALID_HABIT");
  }
  return normalized;
};

export const assertHabitRequestId = (requestId) => {
  if (!UUID_PATTERN.test(String(requestId || ""))) {
    throw habitError(400, "requestId không hợp lệ", "INVALID_REQUEST_ID");
  }
};

export const normalizeHabitInput = (input, { createdByRole, scheduleOverride = null }) => {
  assertHabitRequestId(input?.requestId);
  const allowed = new Set([
    "requestId",
    "title",
    "description",
    "category",
    "schedule",
    "target",
    "unit",
    "visibility",
  ]);
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => !allowed.has(key))
  ) {
    throw habitError(400, "Habit chứa field không được phép", "INVALID_HABIT");
  }
  if (!CATEGORIES.has(input?.category)) {
    throw habitError(400, "category không hợp lệ", "INVALID_HABIT");
  }
  const schedule = input?.schedule;
  if (!schedule || typeof schedule !== "object" || Array.isArray(schedule)) {
    throw habitError(400, "schedule không hợp lệ", "INVALID_HABIT");
  }
  if (
    Object.keys(schedule).some(
      (key) => !new Set(["daysOfWeek", "startDateKey", "endDateKey"]).has(key),
    )
  ) {
    throw habitError(400, "schedule chứa field không được phép", "INVALID_HABIT");
  }
  const days = schedule.daysOfWeek;
  if (
    !Array.isArray(days) ||
    days.length < 1 ||
    days.length > 7 ||
    days.some((day) => !Number.isInteger(day) || day < 0 || day > 6) ||
    new Set(days).size !== days.length
  ) {
    throw habitError(400, "daysOfWeek không hợp lệ", "INVALID_HABIT");
  }
  parseDateKey(schedule.startDateKey);
  const endDateKey = schedule.endDateKey || null;
  if (endDateKey) {
    parseDateKey(endDateKey);
    if (endDateKey < schedule.startDateKey) {
      throw habitError(400, "endDateKey trước startDateKey", "INVALID_HABIT");
    }
  }
  const target = input.target === undefined || input.target === null
    ? null
    : Number(input.target);
  if (target !== null && (!Number.isFinite(target) || target < 0 || target > 100000)) {
    throw habitError(400, "target không hợp lệ", "INVALID_HABIT");
  }
  const visibility =
    createdByRole === "trainer" ? "shared" : input.visibility || "private";
  if (!new Set(["private", "shared"]).has(visibility)) {
    throw habitError(400, "visibility không hợp lệ", "INVALID_HABIT");
  }
  return {
    title: text(input.title, { field: "title", min: 1, max: 100 }),
    description:
      input.description === undefined
        ? ""
        : text(input.description, { field: "description", max: 500 }),
    category: input.category,
    schedule: scheduleOverride || {
      daysOfWeek: [...days].sort((left, right) => left - right),
      startDateKey: schedule.startDateKey,
      endDateKey,
    },
    target,
    unit:
      input.unit === undefined
        ? ""
        : text(input.unit, { field: "unit", max: 40 }),
    visibility,
  };
};

const stable = (value) => {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, stable(value[key])]),
    );
  }
  return value;
};

export const habitFingerprint = (value) =>
  crypto.createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
