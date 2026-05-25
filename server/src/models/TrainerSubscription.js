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
  },
  { timestamps: true }
);

// ✅ Indexes
trainerSubscriptionSchema.index({ userId: 1, status: 1 });
trainerSubscriptionSchema.index({ endDate: 1, status: 1 });

export default mongoose.model("TrainerSubscription", trainerSubscriptionSchema);
