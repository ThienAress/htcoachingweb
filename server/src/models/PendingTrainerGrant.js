import mongoose from "mongoose";
import {
  TRAINER_BILLING_CYCLES,
  TRAINER_PLAN_CODES,
} from "../constants/trainerPlans.js";

const pendingTrainerGrantSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 320,
    },
    normalizedEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 320,
    },
    planCode: {
      type: String,
      required: true,
      enum: TRAINER_PLAN_CODES,
    },
    billingCycle: {
      type: String,
      required: true,
      enum: TRAINER_BILLING_CYCLES,
    },
    status: {
      type: String,
      required: true,
      enum: ["pending", "claimed", "revoked"],
      default: "pending",
    },
    grantedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    claimedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TrainerSubscription",
      default: null,
    },
    claimedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    revokedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true, optimisticConcurrency: true },
);

pendingTrainerGrantSchema.index(
  { normalizedEmail: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "pending" },
    name: "uniq_pending_trainer_grant_email",
  },
);
pendingTrainerGrantSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("PendingTrainerGrant", pendingTrainerGrantSchema);
