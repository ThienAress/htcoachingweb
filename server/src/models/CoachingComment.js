import mongoose from "mongoose";

const coachingCommentSchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    targetType: {
      type: String,
      enum: [
        "daily_journal",
        "weekly_checkin",
        "coaching_day",
        "workout_plan",
      ],
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    targetDateKey: {
      type: String,
      default: "",
      match: /^$|^[0-9]{4}-[0-9]{2}-[0-9]{2}$/,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    actorRole: {
      type: String,
      enum: ["trainer", "user"],
      required: true,
    },
    body: { type: String, trim: true, maxlength: 2000, default: "" },
    status: {
      type: String,
      enum: ["visible", "removed"],
      default: "visible",
      required: true,
    },
    revision: { type: Number, min: 1, default: 1, required: true },
    editedAt: { type: Date, default: null },
    removedAt: { type: Date, default: null },
    retentionExpiresAt: { type: Date, default: null },
  },
  { timestamps: true },
);

coachingCommentSchema.index(
  { targetType: 1, targetId: 1, createdAt: 1 },
  { name: "coaching_comment_target_thread" },
);
coachingCommentSchema.index(
  { clientId: 1, createdAt: -1 },
  { name: "coaching_comment_client_history" },
);
coachingCommentSchema.index(
  { retentionExpiresAt: 1 },
  {
    name: "coaching_comment_retention_candidates",
    partialFilterExpression: { retentionExpiresAt: { $type: "date" } },
  },
);

export default mongoose.model("CoachingComment", coachingCommentSchema);
