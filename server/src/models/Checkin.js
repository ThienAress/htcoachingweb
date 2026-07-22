import mongoose from "mongoose";

const checkinSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    clientRequestId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    package: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },

    time: {
      type: Date,
      required: true,
    },

    muscle: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    note: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },
    remainingSessions: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { timestamps: true },
);
// ✅ Indexes

checkinSchema.index({ orderId: 1 });
checkinSchema.index(
  { orderId: 1, clientRequestId: 1 },
  {
    unique: true,
    partialFilterExpression: { clientRequestId: { $type: "string" } },
  },
);
checkinSchema.index({ createdAt: -1 });
checkinSchema.index({ name: 1 });

// Index cho tìm kiếm theo name (text index hoặc compound)
checkinSchema.index({ name: 1, time: 1 }); // nếu hay kết hợp search + time

// Nếu dùng nhiều query lọc theo thời gian
checkinSchema.index({ time: -1 });
checkinSchema.index({ orderId: 1, time: -1 });

export default mongoose.model("Checkin", checkinSchema);
