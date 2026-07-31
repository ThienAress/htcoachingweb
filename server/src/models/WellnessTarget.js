import mongoose from "mongoose";

const targetsSchema = new mongoose.Schema(
  {
    sleepHours: { type: Number, min: 1, max: 24, required: true },
    waterMl: { type: Number, min: 250, max: 20000, required: true },
    steps: { type: Number, min: 100, max: 200000, required: true },
  },
  { _id: false },
);

const wellnessTargetSchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    trainerIdAtCreation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedByActorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      select: false,
    },
    updatedByRole: {
      type: String,
      enum: ["trainer", "admin"],
      required: true,
    },
    version: { type: Number, min: 1, required: true },
    isLatest: { type: Boolean, default: true, required: true },
    status: {
      type: String,
      enum: ["active", "superseded"],
      default: "active",
      required: true,
    },
    effectiveFromDateKey: {
      type: String,
      match: /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/,
      required: true,
    },
    targets: { type: targetsSchema, required: true },
    note: { type: String, trim: true, maxlength: 500, default: "" },
    commandRequestId: {
      type: String,
      required: true,
      select: false,
    },
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

wellnessTargetSchema.index(
  { clientId: 1, version: 1 },
  { unique: true, name: "uniq_wellness_target_version" },
);
wellnessTargetSchema.index(
  { clientId: 1 },
  {
    unique: true,
    name: "uniq_wellness_target_latest",
    partialFilterExpression: { isLatest: true },
  },
);
wellnessTargetSchema.index(
  { updatedByActorId: 1, commandRequestId: 1 },
  { unique: true, name: "uniq_wellness_target_command" },
);
wellnessTargetSchema.index(
  { clientId: 1, effectiveFromDateKey: -1, version: -1 },
  { name: "wellness_target_client_history" },
);
wellnessTargetSchema.index(
  { retentionExpiresAt: 1 },
  {
    name: "wellness_target_retention_candidates",
    partialFilterExpression: { retentionExpiresAt: { $type: "date" } },
  },
);

export default mongoose.model("WellnessTarget", wellnessTargetSchema);
