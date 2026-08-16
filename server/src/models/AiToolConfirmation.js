import mongoose from "mongoose";

const aiToolConfirmationSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      maxlength: 64,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },
    toolName: {
      type: String,
      required: true,
      immutable: true,
      maxlength: 80,
    },
    parameters: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      immutable: true,
      select: false,
    },
    status: {
      type: String,
      enum: ["pending", "consumed", "cancelled"],
      default: "pending",
      required: true,
    },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true },
);

aiToolConfirmationSchema.index(
  { userId: 1, status: 1, expiresAt: 1 },
  { name: "ai_tool_confirmation_owner_state" },
);
aiToolConfirmationSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, name: "ai_tool_confirmation_expiry_ttl" },
);

export default mongoose.model("AiToolConfirmation", aiToolConfirmationSchema);
