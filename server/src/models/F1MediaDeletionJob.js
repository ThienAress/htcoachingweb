import mongoose from "mongoose";

const f1MediaDeletionJobSchema = new mongoose.Schema(
  {
    mediaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "F1Media",
      required: true,
      unique: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "F1Customer",
      required: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    provider: {
      type: String,
      required: true,
      trim: true,
    },
    storageKey: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "failed", "completed"],
      default: "pending",
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
    lastErrorCode: {
      type: String,
      default: "",
      trim: true,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

f1MediaDeletionJobSchema.index({ status: 1, nextAttemptAt: 1 });
f1MediaDeletionJobSchema.index({ customerId: 1, status: 1 });

export default mongoose.model(
  "F1MediaDeletionJob",
  f1MediaDeletionJobSchema,
);
