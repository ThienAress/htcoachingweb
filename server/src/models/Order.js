import mongoose from "mongoose";

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

    trainerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
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
// ✅ Indexes
orderSchema.index({ trainerId: 1 });
orderSchema.index({ userId: 1 });
orderSchema.index({ email: 1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ trainerId: 1, status: 1 });
orderSchema.index({ trainerId: 1, status: 1, sessions: 1 });
orderSchema.index({ trainerId: 1, createdAt: -1 });
orderSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model("Order", orderSchema);
