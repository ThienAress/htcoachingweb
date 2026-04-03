import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    gym: { type: String, required: true },
    schedule: { type: String, required: true },
    note: { type: String, default: "" },
    package: { type: String, required: true },
    sessions: { type: Number, required: true },
    discountCode: { type: String, default: null },
    gifts: { type: [String], default: [] },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "contacted", "completed", "cancelled"],
      default: "pending",
    },
    contactedAt: { type: Date },
    noteAdmin: { type: String, default: "" },
  },
  { timestamps: true },
);

bookingSchema.index({ createdAt: -1 });
bookingSchema.index({ email: 1 });
bookingSchema.index({ status: 1 });

export default mongoose.model("Booking", bookingSchema);
