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
    sessions: Number,
    totalSessions: Number,

    gym: String,
    schedule: String,
    note: String,

    status: {
      type: String,
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
// ✅ Indexes
orderSchema.index({ trainerId: 1 });
orderSchema.index({ userId: 1 });
orderSchema.index({ email: 1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ trainerId: 1, status: 1 });

export default mongoose.model("Order", orderSchema);
