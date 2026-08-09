import mongoose from "mongoose";

const contactMessageSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    social: {
      type: String,
      required: true,
      trim: true,
    },
    package: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "processed"],
      default: "pending",
    },
    processedAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

// Indexes
contactMessageSchema.index({ createdAt: -1 });
contactMessageSchema.index({ email: 1 });
contactMessageSchema.index({ status: 1 });
contactMessageSchema.index({ name: 1 });

export default mongoose.model("ContactMessage", contactMessageSchema);
