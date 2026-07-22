import mongoose from "mongoose";

const trainingScheduleSchema = new mongoose.Schema(
  {
    trainerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    clientName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    // Concrete occurrence fields. Legacy weekday/time fields are dual-written
    // during rollout because the calendar and AI tool still consume them.
    occurrenceDateKey: {
      type: String,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    startAt: Date,
    endAt: Date,
    timeZone: {
      type: String,
      default: "Asia/Ho_Chi_Minh",
      enum: ["Asia/Ho_Chi_Minh"],
    },
    dayOfWeek: {
      type: Number,
      required: true,
      min: 0,
      max: 6,
    },
    startTime: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):([0-5]\d)$/,
    },
    endTime: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):([0-5]\d)$/,
    },

    exerciseType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    notes: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },
    color: {
      type: String,
      default: "#ff5500",
      match: /^#([0-9A-Fa-f]{6})$/,
    },

    status: {
      type: String,
      enum: ["scheduled", "cancelled", "completed"],
      default: "scheduled",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    revision: {
      type: Number,
      default: 0,
      min: 0,
    },
    createdByType: {
      type: String,
      enum: ["client", "trainer", "admin", "migration"],
      default: "trainer",
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    requestId: {
      type: String,
      maxlength: 64,
    },

    lastClientEdit: {
      type: Date,
      default: null,
    },
    lastClientEditAt: {
      type: Date,
      default: null,
    },
    cancelledAt: Date,
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    cancellationReason: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },
    completedAt: Date,
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    reminderSent: {
      type: Boolean,
      default: false,
    },
    lastReminderOccurrenceKey: {
      type: String,
      default: "",
      maxlength: 64,
    },
    lastReminderSentAt: {
      type: Date,
      default: null,
    },
    reminderClaimedOccurrenceKey: {
      type: String,
      default: "",
      maxlength: 64,
    },
    reminderClaimedAt: {
      type: Date,
      default: null,
    },

    // Kept as a compatibility cutoff. It is no longer a TTL field.
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true },
);

trainingScheduleSchema.pre("validate", function validateOccurrence() {
  if (this.startAt && this.endAt && this.endAt <= this.startAt) {
    this.invalidate("endAt", "Thời gian kết thúc phải sau thời gian bắt đầu");
  }
  this.isActive = this.status === "scheduled";
});

trainingScheduleSchema.index(
  { clientId: 1, occurrenceDateKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      isActive: true,
      occurrenceDateKey: { $type: "string" },
    },
    name: "uniq_active_client_occurrence_date",
  },
);
trainingScheduleSchema.index(
  { requestedBy: 1, requestId: 1 },
  {
    unique: true,
    partialFilterExpression: { requestId: { $type: "string" } },
    name: "uniq_schedule_request",
  },
);
trainingScheduleSchema.index({ trainerId: 1, status: 1, startAt: 1 });
trainingScheduleSchema.index({ clientId: 1, status: 1, startAt: 1 });
trainingScheduleSchema.index({ status: 1, startAt: 1 });
trainingScheduleSchema.index({ trainerId: 1, dayOfWeek: 1, startTime: 1 });
trainingScheduleSchema.index({ expiresAt: 1, status: 1 });

export default mongoose.model("TrainingSchedule", trainingScheduleSchema);
