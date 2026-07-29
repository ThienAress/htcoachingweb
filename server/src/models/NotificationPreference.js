import mongoose from "mongoose";

const notificationPreferenceSchema = new mongoose.Schema(
  {
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    inAppEnabled: { type: Boolean, default: true, required: true },
    comments: { type: Boolean, default: true, required: true },
    journal: { type: Boolean, default: true, required: true },
    weekly: { type: Boolean, default: true, required: true },
    revision: { type: Number, min: 1, default: 1, required: true },
  },
  { timestamps: true },
);

notificationPreferenceSchema.index(
  { recipientId: 1 },
  { unique: true, name: "uniq_notification_preference_recipient" },
);

export default mongoose.model(
  "NotificationPreference",
  notificationPreferenceSchema,
);
