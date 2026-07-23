import mongoose from "mongoose";

const f1DataDeletionJobSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "F1Customer",
      required: true,
      unique: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    requestedByRole: {
      type: String,
      enum: ["admin", "trainer", "user"],
      required: true,
    },
    reason: {
      type: String,
      enum: ["user_request", "retention_expired", "admin_request"],
      default: "admin_request",
    },
    status: {
      type: String,
      enum: [
        "pending_media_cleanup",
        "processing",
        "completed",
        "failed",
      ],
      default: "pending_media_cleanup",
      required: true,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    nextAttemptAt: {
      type: Date,
      default: Date.now,
    },
    claimedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    lastErrorCode: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true },
);

f1DataDeletionJobSchema.index({ status: 1, nextAttemptAt: 1 });

export default mongoose.model("F1DataDeletionJob", f1DataDeletionJobSchema);
