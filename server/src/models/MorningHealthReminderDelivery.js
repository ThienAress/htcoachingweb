import mongoose from "mongoose";

const morningHealthReminderDeliverySchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
      match: /^[a-f0-9]{64}$/,
    },
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    dateKey: {
      type: String,
      required: true,
      match: /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/,
    },
    status: {
      type: String,
      enum: ["pending", "claimed", "sent", "failed"],
      default: "pending",
      required: true,
    },
    attempts: {
      type: Number,
      min: 0,
      default: 0,
      required: true,
    },
    claimedAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    nextAttemptAt: { type: Date, default: null },
    lastErrorCode: {
      type: String,
      maxlength: 80,
      default: "",
    },
  },
  { timestamps: true },
);

morningHealthReminderDeliverySchema.index(
  { recipientId: 1, dateKey: 1 },
  { name: "morning_health_delivery_recipient_date" },
);
morningHealthReminderDeliverySchema.index({ status: 1, nextAttemptAt: 1 });

export default mongoose.model(
  "MorningHealthReminderDelivery",
  morningHealthReminderDeliverySchema,
);
