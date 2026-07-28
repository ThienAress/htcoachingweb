import mongoose from "mongoose";
import {
  TRAINER_BILLING_CYCLES,
  TRAINER_PLAN_CODES,
} from "../constants/trainerPlans.js";

const trainerSubscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Tên gói: "Tiêu chuẩn", "Chuyên nghiệp", "Doanh nghiệp"
    planTitle: {
      type: String,
      required: true,
    },
    planCode: {
      type: String,
      enum: TRAINER_PLAN_CODES,
      default: null,
    },

    // Chu kỳ thanh toán: "month" | "year"
    billingCycle: {
      type: String,
      enum: TRAINER_BILLING_CYCLES,
      required: true,
    },
    source: {
      type: String,
      enum: [
        "legacy",
        "self_purchase",
        "free_trial",
        "admin_grant",
        "pending_grant",
      ],
      default: "legacy",
    },
    normalizedEmail: {
      type: String,
      lowercase: true,
      trim: true,
      maxlength: 320,
      default: null,
    },

    // Số tiền đã thanh toán
    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    // Ngày bắt đầu & kết thúc
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },

    // active | expired | cancelled
    status: {
      type: String,
      enum: ["active", "expired", "cancelled", "superseded"],
      default: "active",
    },
    isActive: {
      type: Boolean,
      default: true,
      required: true,
    },
    purchaseRequestId: {
      type: String,
      default: null,
      maxlength: 100,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    cancelReason: {
      type: String,
      default: null,
      maxlength: 500,
    },
    previousSubscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TrainerSubscription",
      default: null,
    },
    supersededAt: { type: Date, default: null },
    supersededBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TrainerSubscription",
      default: null,
    },
    structuredRetentionExpiresAt: { type: Date, default: null },
    mediaRetentionExpiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// ✅ Indexes
trainerSubscriptionSchema.index({ userId: 1, status: 1 });
trainerSubscriptionSchema.index({ endDate: 1, status: 1 });
trainerSubscriptionSchema.index({ normalizedEmail: 1, status: 1 });
trainerSubscriptionSchema.index({ structuredRetentionExpiresAt: 1, status: 1 });
trainerSubscriptionSchema.index({ mediaRetentionExpiresAt: 1, status: 1 });
trainerSubscriptionSchema.index(
  { userId: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true },
    name: "uniq_active_trainer_subscription",
  },
);
trainerSubscriptionSchema.index(
  { userId: 1, purchaseRequestId: 1 },
  {
    unique: true,
    partialFilterExpression: { purchaseRequestId: { $type: "string" } },
    name: "uniq_trainer_purchase_request",
  },
);

trainerSubscriptionSchema.pre("validate", function syncActiveState() {
  this.isActive = this.status === "active";
});

export default mongoose.model("TrainerSubscription", trainerSubscriptionSchema);
