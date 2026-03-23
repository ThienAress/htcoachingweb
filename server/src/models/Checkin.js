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

export default mongoose.model("Checkin", checkinSchema);
