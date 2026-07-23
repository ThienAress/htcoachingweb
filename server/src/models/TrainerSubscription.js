import mongoose from "mongoose";

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

    // Chu kỳ thanh toán: "month" | "year"
    billingCycle: {
      type: String,
      enum: ["month", "year"],
      required: true,
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
      enum: ["active", "expired", "cancelled"],
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
  },
  { timestamps: true }
);

// ✅ Indexes
trainerSubscriptionSchema.index({ userId: 1, status: 1 });
trainerSubscriptionSchema.index({ endDate: 1, status: 1 });
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
