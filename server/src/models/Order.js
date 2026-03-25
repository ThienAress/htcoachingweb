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

export default mongoose.model("Order", orderSchema);
