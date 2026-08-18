import mongoose from "mongoose";
import {
  applyConversionOriginContract,
  createConversionOriginFields,
} from "./conversionOrigin.schema.js";

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    name: String,
    email: String,
    phone: String,

    package: String,
    sessions: {
      type: Number,
      min: 0,
      max: 10000,
      validate: Number.isSafeInteger,
    },
    totalSessions: {
      type: Number,
      min: 1,
      max: 10000,
      validate: Number.isSafeInteger,
    },

    gym: String,
    schedule: String,
    note: String,

    status: {
      type: String,
      enum: ["pending", "approved", "completed", "cancelled"],
      default: "pending",
    },

    approvedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    sessionsExhaustedAt: {
      type: Date,
      default: null,
    },

    trainerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    entitlementPolicyVersion: {
      type: String,
      default: null,
      maxlength: 40,
      select: false,
    },
    entitlementPolicySnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      select: false,
    },
    ...createConversionOriginFields(),
  },
  { timestamps: true },
);

orderSchema.pre("validate", function validateSessionBalance() {
  if (
    Number.isSafeInteger(this.sessions) &&
    Number.isSafeInteger(this.totalSessions) &&
    this.sessions > this.totalSessions
  ) {
    this.invalidate(
      "sessions",
      "Số buổi còn lại không thể lớn hơn tổng số buổi",
    );
  }
});
applyConversionOriginContract(orderSchema, "uniq_order_conversion");
// ✅ Indexes
orderSchema.index({ trainerId: 1 });
orderSchema.index({ userId: 1 });
orderSchema.index({ email: 1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ trainerId: 1, status: 1 });
orderSchema.index({ trainerId: 1, status: 1, sessions: 1 });
orderSchema.index({ trainerId: 1, createdAt: -1 });
orderSchema.index({ userId: 1, createdAt: -1 });

orderSchema.set("toJSON", {
  transform: (_document, result) => {
    delete result.entitlementPolicyVersion;
    delete result.entitlementPolicySnapshot;
    return result;
  },
});

export default mongoose.model("Order", orderSchema);
