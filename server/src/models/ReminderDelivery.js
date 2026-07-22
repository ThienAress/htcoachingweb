import mongoose from "mongoose";

const reminderDeliverySchema = new mongoose.Schema(
  {
    scheduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TrainingSchedule",
      required: true,
    },
    occurrenceKey: {
      type: String,
      required: true,
      maxlength: 64,
    },
    channel: {
      type: String,
      enum: ["email"],
      default: "email",
    },
    status: {
      type: String,
      enum: ["pending", "claimed", "sent", "failed"],
      default: "pending",
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    claimedAt: Date,
    sentAt: Date,
    nextAttemptAt: Date,
    lastError: {
      type: String,
      maxlength: 500,
      default: "",
    },
  },
  { timestamps: true },
);

reminderDeliverySchema.index(
  { scheduleId: 1, occurrenceKey: 1, channel: 1 },
  { unique: true, name: "uniq_schedule_reminder_delivery" },
);
reminderDeliverySchema.index({ status: 1, nextAttemptAt: 1 });

export default mongoose.model("ReminderDelivery", reminderDeliverySchema);
