import mongoose from "mongoose";

import {
  FITNESS_PLUS_BILLING_CYCLES,
  FITNESS_PLUS_PLAN_CODES,
} from "../constants/fitnessPlusPlans.js";

const fitnessSubscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    planCode: {
      type: String,
      enum: FITNESS_PLUS_PLAN_CODES,
      required: true,
    },
    planTitle: {
      type: String,
      required: true,
      maxlength: 80,
    },
    billingCycle: {
      type: String,
      enum: FITNESS_PLUS_BILLING_CYCLES,
      required: true,
    },
    source: {
      type: String,
      enum: ["self_purchase", "admin_grant"],
      default: "self_purchase",
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isSafeInteger,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
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
    previousSubscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FitnessSubscription",
      default: null,
    },
    supersededAt: {
      type: Date,
      default: null,
    },
    supersededBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FitnessSubscription",
      default: null,
    },
  },
  { timestamps: true },
);

fitnessSubscriptionSchema.index(
  { userId: 1, status: 1 },
  { name: "fitness_subscription_user_status" },
);
fitnessSubscriptionSchema.index(
  { endDate: 1, status: 1 },
  { name: "fitness_subscription_end_status" },
);
fitnessSubscriptionSchema.index(
  { userId: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true },
    name: "uniq_active_fitness_plus_subscription",
  },
);
fitnessSubscriptionSchema.index(
  { userId: 1, purchaseRequestId: 1 },
  {
    unique: true,
    partialFilterExpression: { purchaseRequestId: { $type: "string" } },
    name: "uniq_fitness_plus_purchase_request",
  },
);

fitnessSubscriptionSchema.pre("validate", function syncActiveState() {
  this.isActive = this.status === "active";
});

export default mongoose.model("FitnessSubscription", fitnessSubscriptionSchema);
