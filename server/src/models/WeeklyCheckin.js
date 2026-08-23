import mongoose from "mongoose";

const boundedNumber = (min, max, integer = false) => ({
  type: Number,
  min,
  max,
  default: null,
  ...(integer
    ? {
        validate: {
          validator: (value) => value === null || Number.isInteger(value),
          message: "Giá trị phải là số nguyên",
        },
      }
    : {}),
});

const bodySchema = new mongoose.Schema(
  {
    weightKg: boundedNumber(30, 350),
    waistCm: boundedNumber(30, 300),
    bodyFatPercent: boundedNumber(1, 80),
    skeletalMusclePercent: boundedNumber(1, 80),
    energy: boundedNumber(1, 10, true),
    adherence: boundedNumber(1, 10, true),
    wins: { type: String, trim: true, maxlength: 2000, default: "" },
    challenges: { type: String, trim: true, maxlength: 2000, default: "" },
    note: { type: String, trim: true, maxlength: 2000, default: "" },
  },
  { _id: false },
);

const trainerReviewSchema = new mongoose.Schema(
  {
    trainerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    message: { type: String, trim: true, maxlength: 2000, required: true },
    rating: boundedNumber(1, 10, true),
    reviewedAt: { type: Date, required: true },
  },
  { _id: false },
);

const weeklyCheckinSchema = new mongoose.Schema(
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
    weekStartDateKey: {
      type: String,
      required: true,
      match: /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/,
    },
    timeZone: {
      type: String,
      enum: ["Asia/Ho_Chi_Minh"],
      default: "Asia/Ho_Chi_Minh",
      required: true,
    },
    body: { type: bodySchema, default: () => ({}) },
    status: {
      type: String,
      enum: ["draft", "submitted", "reviewed"],
      default: "draft",
      required: true,
    },
    submittedAt: { type: Date, default: null },
    trainerReview: { type: trainerReviewSchema, default: null },
    revision: { type: Number, min: 0, default: 0, required: true },
    correctionCount: {
      type: Number,
      min: 0,
      max: 1,
      default: 0,
      required: true,
      validate: {
        validator: Number.isInteger,
        message: "Số lượt cập nhật phải là số nguyên",
      },
    },
    retentionExpiresAt: { type: Date, default: null },
  },
  { timestamps: true },
);

weeklyCheckinSchema.index(
  { clientId: 1, weekStartDateKey: 1 },
  { unique: true, name: "uniq_weekly_checkin_client_week" },
);
weeklyCheckinSchema.index(
  { trainerIdAtCreation: 1, weekStartDateKey: -1 },
  { name: "weekly_checkin_trainer_history" },
);
weeklyCheckinSchema.index(
  { retentionExpiresAt: 1 },
  {
    name: "weekly_checkin_retention_candidates",
    partialFilterExpression: { retentionExpiresAt: { $type: "date" } },
  },
);

export default mongoose.model("WeeklyCheckin", weeklyCheckinSchema);
