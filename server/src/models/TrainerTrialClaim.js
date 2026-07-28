import mongoose from "mongoose";

const trainerTrialClaimSchema = new mongoose.Schema(
  {
    normalizedEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 320,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TrainerSubscription",
      default: null,
    },
    source: {
      type: String,
      enum: ["free_trial", "admin_grant", "pending_grant"],
      default: "free_trial",
    },
    claimedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  { timestamps: true },
);

trainerTrialClaimSchema.index(
  { normalizedEmail: 1 },
  { unique: true, name: "uniq_trainer_free_trial_email" },
);
trainerTrialClaimSchema.index({ userId: 1, claimedAt: -1 });

export default mongoose.model("TrainerTrialClaim", trainerTrialClaimSchema);
