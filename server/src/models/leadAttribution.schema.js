import mongoose from "mongoose";

const ALLOWED_KEYS = new Set([
  "source",
  "medium",
  "campaign",
  "referrerHost",
  "landingPath",
  "contentType",
  "contentSlug",
  "capturedAt",
]);
const SAFE_TOKEN = /^[a-z0-9._-]+$/;
const SAFE_CAMPAIGN = /^[\p{L}\p{N} ._-]*$/u;
const SAFE_HOST = /^(?:[a-z0-9-]+\.)*[a-z0-9-]+$/;
const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const CONTENT_TYPES = new Set(["page", "blog"]);

const requireBoundedString = (value, field, maxLength, pattern, allowEmpty = false) => {
  if (typeof value !== "string") throw new TypeError(`${field} không hợp lệ`);
  const normalized = value.trim();
  if ((!allowEmpty && !normalized) || normalized.length > maxLength) {
    throw new TypeError(`${field} không hợp lệ`);
  }
  if (normalized && pattern && !pattern.test(normalized)) {
    throw new TypeError(`${field} không hợp lệ`);
  }
  return normalized;
};

export const normalizeLeadAttribution = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("attribution phải là object");
  }
  const keys = Object.keys(value);
  if (keys.some((key) => !ALLOWED_KEYS.has(key))) {
    throw new TypeError("attribution chứa field không được hỗ trợ");
  }

  const contentType = requireBoundedString(
    value.contentType,
    "attribution.contentType",
    10,
  ).toLowerCase();
  if (!CONTENT_TYPES.has(contentType)) {
    throw new TypeError("attribution.contentType không hợp lệ");
  }
  const contentSlug = requireBoundedString(
    value.contentSlug ?? "",
    "attribution.contentSlug",
    160,
    SAFE_SLUG,
    contentType !== "blog",
  ).toLowerCase();
  const landingPath = requireBoundedString(
    value.landingPath,
    "attribution.landingPath",
    300,
  );
  if (
    !landingPath.startsWith("/") ||
    landingPath.startsWith("//") ||
    /[?#\\\s]/.test(landingPath)
  ) {
    throw new TypeError("attribution.landingPath không hợp lệ");
  }
  if (
    typeof value.capturedAt !== "string" ||
    !ISO_DATETIME.test(value.capturedAt)
  ) {
    throw new TypeError("attribution.capturedAt không hợp lệ");
  }
  const capturedAt = new Date(value.capturedAt);
  if (Number.isNaN(capturedAt.getTime())) {
    throw new TypeError("attribution.capturedAt không hợp lệ");
  }

  return {
    source: requireBoundedString(
      typeof value.source === "string" ? value.source.toLowerCase() : value.source,
      "attribution.source",
      64,
      SAFE_TOKEN,
    ).toLowerCase(),
    medium: requireBoundedString(
      typeof value.medium === "string" ? value.medium.toLowerCase() : value.medium,
      "attribution.medium",
      64,
      SAFE_TOKEN,
    ).toLowerCase(),
    campaign: requireBoundedString(
      value.campaign ?? "",
      "attribution.campaign",
      100,
      SAFE_CAMPAIGN,
      true,
    ),
    referrerHost: requireBoundedString(
      typeof value.referrerHost === "string"
        ? value.referrerHost.toLowerCase()
        : value.referrerHost ?? "",
      "attribution.referrerHost",
      253,
      SAFE_HOST,
      true,
    ).toLowerCase(),
    landingPath,
    contentType,
    contentSlug,
    capturedAt: capturedAt.toISOString(),
  };
};

const leadAttributionSchema = new mongoose.Schema(
  {
    source: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 64,
      match: SAFE_TOKEN,
    },
    medium: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 64,
      match: SAFE_TOKEN,
    },
    campaign: {
      type: String,
      default: "",
      trim: true,
      maxlength: 100,
      match: SAFE_CAMPAIGN,
    },
    referrerHost: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      maxlength: 253,
      validate: {
        validator: (value) => !value || SAFE_HOST.test(value),
        message: "referrerHost không hợp lệ",
      },
    },
    landingPath: { type: String, required: true, maxlength: 300 },
    contentType: {
      type: String,
      required: true,
      enum: [...CONTENT_TYPES],
    },
    contentSlug: {
      type: String,
      default: "",
      lowercase: true,
      maxlength: 160,
      validate: {
        validator(value) {
          return this.contentType !== "blog" || SAFE_SLUG.test(value);
        },
        message: "contentSlug không hợp lệ",
      },
    },
    capturedAt: { type: Date, required: true },
  },
  { _id: false, id: false, strict: "throw" },
);

export default leadAttributionSchema;
