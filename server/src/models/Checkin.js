import mongoose from "mongoose";

const checkinSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
    },
    name: String,
    package: String,

    time: {
      type: Date,
    },

    muscle: String,
    note: String,
    remainingSessions: Number,
  },
  { timestamps: true },
);
// ✅ Indexes

checkinSchema.index({ orderId: 1 });
checkinSchema.index({ createdAt: -1 });
checkinSchema.index({ name: 1 });

// Index cho tìm kiếm theo name (text index hoặc compound)
checkinSchema.index({ name: 1, time: 1 }); // nếu hay kết hợp search + time

// Nếu dùng nhiều query lọc theo thời gian
checkinSchema.index({ time: -1 });

export default mongoose.model("Checkin", checkinSchema);
