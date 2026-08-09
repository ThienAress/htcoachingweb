import mongoose from "mongoose";

import { parseDateKey } from "../utils/dateKey.js";

export const SEO_ANALYTICS_PROVIDERS = Object.freeze(["ga4", "gsc"]);
export const SEO_ANALYTICS_DIMENSIONS = Object.freeze([
  "overview",
  "page",
  "query",
  "source_medium",
  "device",
  "event",
]);

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SAFE_TOKEN = /^[a-z0-9._-]+$/;
const SAFE_SOURCE_MEDIUM = /^[a-z0-9._-]+\/[a-z0-9._-]+$/;
const SAFE_PAGE_PATH = /^\/[a-z0-9/_%.-]*$/i;
const SENSITIVE_QUERY = /@|https?:\/\/|\b\d{7,}\b/i;

const isValidDateKey = (value) => {
  if (!DATE_KEY_PATTERN.test(value)) return false;
  try {
    parseDateKey(value);
    return true;
  } catch {
    return false;
  }
};

const isValidDimensionKey = function validateDimensionKey(value) {
  if (typeof value !== "string" || value.length > 300 || !value.trim()) {
    return false;
  }
  if (this.dimension === "overview") return value === "all";
  if (this.dimension === "page") {
    return (
      value.startsWith("/") &&
      !value.startsWith("//") &&
      !/[?#\\\s]/.test(value) &&
      SAFE_PAGE_PATH.test(value)
    );
  }
  if (this.dimension === "query") {
    return value.length <= 200 && !SENSITIVE_QUERY.test(value);
  }
  if (this.dimension === "source_medium") {
    return SAFE_SOURCE_MEDIUM.test(value);
  }
  if (this.dimension === "device") {
    return ["desktop", "mobile", "tablet", "other"].includes(value);
  }
  if (this.dimension === "event") return SAFE_TOKEN.test(value);
  return false;
};

const isValidContentPath = (value) => {
  if (!value) return true;
  return (
    value.length <= 300 &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !/[?#\\\s]/.test(value) &&
    SAFE_PAGE_PATH.test(value)
  );
};

const metricFields = {
  impressions: { type: Number, default: 0, min: 0 },
  clicks: { type: Number, default: 0, min: 0 },
  ctr: { type: Number, default: 0, min: 0, max: 1 },
  position: { type: Number, default: 0, min: 0 },
  activeUsers: { type: Number, default: 0, min: 0 },
  newUsers: { type: Number, default: 0, min: 0 },
  returningUsers: { type: Number, default: 0, min: 0 },
  engagedReads: { type: Number, default: 0, min: 0 },
  ctaClicks: { type: Number, default: 0, min: 0 },
  leads: { type: Number, default: 0, min: 0 },
};

const seoDailyMetricSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      required: true,
      enum: SEO_ANALYTICS_PROVIDERS,
    },
    dateKey: {
      type: String,
      required: true,
      validate: { validator: isValidDateKey, message: "dateKey không hợp lệ" },
    },
    dimension: {
      type: String,
      required: true,
      enum: SEO_ANALYTICS_DIMENSIONS,
    },
    dimensionKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
      validate: {
        validator: isValidDimensionKey,
        message: "dimensionKey không hợp lệ",
      },
    },
    contentPath: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
      validate: {
        validator: isValidContentPath,
        message: "contentPath không hợp lệ",
      },
    },
    metrics: {
      type: new mongoose.Schema(metricFields, {
        _id: false,
        id: false,
        strict: "throw",
      }),
      required: true,
      default: () => ({}),
    },
    syncedAt: { type: Date, required: true },
  },
  { timestamps: true, strict: "throw" },
);

seoDailyMetricSchema.index(
  {
    provider: 1,
    dateKey: 1,
    dimension: 1,
    dimensionKey: 1,
    contentPath: 1,
  },
  { unique: true, name: "uniq_seo_daily_metric" },
);
seoDailyMetricSchema.index({ dateKey: -1, dimension: 1 });
seoDailyMetricSchema.index({ dimension: 1, dimensionKey: 1, dateKey: -1 });

export default mongoose.model("SeoDailyMetric", seoDailyMetricSchema);
