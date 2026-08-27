import mongoose from "mongoose";
import { COACHING_SUBMISSION_FIELD_KEYS } from "../constants/coachingSubmissionFields.js";

const inAppNotificationSchema = new mongoose.Schema(
  {
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: [
        "journal_submitted",
        "journal_corrected",
        "nutrition_submitted",
        "coaching_comment_created",
        "weekly_submitted",
        "weekly_corrected",
        "weekly_reviewed",
      ],
      required: true,
    },
    category: {
      type: String,
      enum: ["journal", "comments", "weekly"],
      required: true,
    },
    targetType: {
      type: String,
      enum: [
        "daily_journal",
        "weekly_checkin",
        "coaching_comment",
      ],
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    title: { type: String, trim: true, maxlength: 120, required: true },
    missingFields: {
      type: [
        {
          type: String,
          enum: COACHING_SUBMISSION_FIELD_KEYS,
        },
      ],
      default: () => [],
      validate: {
        validator: (items) => items.length <= COACHING_SUBMISSION_FIELD_KEYS.length,
        message: "Danh sách trường thiếu vượt giới hạn",
      },
    },
    deepLink: {
      type: String,
      trim: true,
      maxlength: 220,
      match: /^\/(?![\\/])[^\s\\]*$/,
      required: true,
    },
    dedupeKey: { type: String, maxlength: 180, required: true },
    readAt: { type: Date, default: null },
    retentionExpiresAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

inAppNotificationSchema.index(
  { recipientId: 1, dedupeKey: 1 },
  { unique: true, name: "uniq_in_app_notification_delivery" },
);
inAppNotificationSchema.index(
  { recipientId: 1, readAt: 1, createdAt: -1 },
  { name: "in_app_notification_inbox" },
);
inAppNotificationSchema.index(
  { recipientId: 1, createdAt: -1 },
  { name: "in_app_notification_history" },
);
inAppNotificationSchema.index(
  { retentionExpiresAt: 1 },
  { name: "in_app_notification_retention_candidates" },
);

export default mongoose.model("InAppNotification", inAppNotificationSchema);
