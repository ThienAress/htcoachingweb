import mongoose from "mongoose";

import { SEO_ANALYTICS_PROVIDERS } from "./SeoDailyMetric.js";
import { parseDateKey } from "../utils/dateKey.js";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const analyticsSyncStateSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      required: true,
      enum: SEO_ANALYTICS_PROVIDERS,
      unique: true,
    },
    status: {
      type: String,
      enum: ["disabled", "idle", "running", "success", "partial", "error"],
      default: "disabled",
    },
    windowStart: { type: String, default: "", match: /^$|^\d{4}-\d{2}-\d{2}$/ },
    windowEnd: { type: String, default: "", match: /^$|^\d{4}-\d{2}-\d{2}$/ },
    cursor: { type: Number, default: 0, min: 0 },
    lastAttemptAt: { type: Date, default: null },
    lastSuccessAt: { type: Date, default: null },
    lastErrorAt: { type: Date, default: null },
    lastErrorCode: { type: String, default: "", trim: true, maxlength: 64 },
    lastErrorMessage: { type: String, default: "", trim: true, maxlength: 200 },
    lockOwner: { type: String, default: "", trim: true, maxlength: 64 },
    lockUntil: { type: Date, default: null },
    revision: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true, strict: "throw" },
);

analyticsSyncStateSchema.path("windowStart").validate((value) => {
  if (!value) return true;
  if (!DATE_KEY_PATTERN.test(value)) return false;
  try {
    parseDateKey(value);
    return true;
  } catch {
    return false;
  }
}, "windowStart không hợp lệ");
analyticsSyncStateSchema.path("windowEnd").validate((value) => {
  if (!value) return true;
  if (!DATE_KEY_PATTERN.test(value)) return false;
  try {
    parseDateKey(value);
    return true;
  } catch {
    return false;
  }
}, "windowEnd không hợp lệ");

analyticsSyncStateSchema.index({ status: 1, lockUntil: 1 });

export default mongoose.model("AnalyticsSyncState", analyticsSyncStateSchema);
