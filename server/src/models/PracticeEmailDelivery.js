import mongoose from "mongoose";

const deliverySchema = new mongoose.Schema(
  {
    key: { type: String, enum: ["order", "checkin"], required: true },
    status: {
      type: String,
      enum: ["pending", "processing", "sent", "unknown"],
      default: "pending",
      required: true,
    },
    claimedAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    providerMessageId: { type: String, default: "", maxlength: 200 },
  },
  { _id: false },
);

const practiceEmailDeliverySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },
    requestId: {
      type: String,
      required: true,
      immutable: true,
      match: /^[0-9a-f-]{36}$/i,
    },
    scenario: {
      type: String,
      enum: ["order", "checkin", "journey"],
      required: true,
      immutable: true,
    },
    deliveries: { type: [deliverySchema], required: true },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

practiceEmailDeliverySchema.index(
  { userId: 1, requestId: 1 },
  { unique: true, name: "uniq_practice_email_delivery_request" },
);
practiceEmailDeliverySchema.index(
  { "deliveries.status": 1, "deliveries.claimedAt": 1 },
  { name: "practice_email_delivery_claim" },
);

export default mongoose.model(
  "PracticeEmailDelivery",
  practiceEmailDeliverySchema,
);
