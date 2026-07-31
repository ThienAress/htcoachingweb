import mongoose from "mongoose";

const scheduleSchema = new mongoose.Schema(
  {
    daysOfWeek: {
      type: [Number],
      required: true,
      validate: {
        validator: (days) =>
          days.length >= 1 &&
          days.length <= 7 &&
          days.every((day) => Number.isInteger(day) && day >= 0 && day <= 6) &&
          new Set(days).size === days.length,
        message: "daysOfWeek phải unique trong khoảng 0-6",
      },
    },
    startDateKey: {
      type: String,
      required: true,
      match: /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/,
    },
    endDateKey: {
      type: String,
      default: null,
      match: /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/,
    },
  },
  { _id: false },
);

const coachingHabitSchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    trainerIdAtCreation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    createdById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    createdByRole: {
      type: String,
      enum: ["user", "trainer"],
      required: true,
    },
    lineageKey: {
      type: String,
      required: true,
      match:
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    },
    version: { type: Number, min: 1, required: true },
    isLatest: { type: Boolean, required: true, default: true },
    status: {
      type: String,
      enum: ["active", "paused", "archived"],
      required: true,
      default: "active",
    },
    title: { type: String, trim: true, maxlength: 100, required: true },
    description: { type: String, trim: true, maxlength: 500, default: "" },
    category: {
      type: String,
      enum: ["nutrition", "movement", "recovery", "mindset", "other"],
      required: true,
    },
    schedule: { type: scheduleSchema, required: true },
    target: { type: Number, min: 0, max: 100000, default: null },
    unit: { type: String, trim: true, maxlength: 40, default: "" },
    visibility: {
      type: String,
      enum: ["private", "shared"],
      required: true,
      default: "private",
    },
    commandActorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      select: false,
    },
    commandType: {
      type: String,
      enum: ["create", "status", "update"],
      required: true,
      select: false,
    },
    commandRequestId: { type: String, required: true, select: false },
    payloadFingerprint: {
      type: String,
      minlength: 64,
      maxlength: 64,
      required: true,
      select: false,
    },
    retentionExpiresAt: { type: Date, default: null },
  },
  { timestamps: true },
);

coachingHabitSchema.index(
  { clientId: 1, lineageKey: 1, version: 1 },
  { unique: true, name: "uniq_coaching_habit_version" },
);
coachingHabitSchema.index(
  { commandActorId: 1, commandRequestId: 1 },
  { unique: true, name: "uniq_coaching_habit_request" },
);
coachingHabitSchema.index(
  { clientId: 1, lineageKey: 1 },
  {
    unique: true,
    name: "uniq_coaching_habit_latest",
    partialFilterExpression: { isLatest: true },
  },
);
coachingHabitSchema.index(
  { clientId: 1, isLatest: 1, status: 1, "schedule.startDateKey": 1 },
  { name: "coaching_habit_client_list" },
);
coachingHabitSchema.index(
  { clientId: 1, createdAt: 1, "schedule.startDateKey": 1 },
  { name: "coaching_habit_client_progress_range" },
);
coachingHabitSchema.index(
  { retentionExpiresAt: 1 },
  {
    name: "coaching_habit_retention_candidates",
    partialFilterExpression: { retentionExpiresAt: { $type: "date" } },
  },
);

export default mongoose.model("CoachingHabit", coachingHabitSchema);
