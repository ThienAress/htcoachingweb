import mongoose from "mongoose";

const aiModerationStateSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    warnings: {
      type: Number,
      default: 0,
      min: 0,
    },
    lockedUntil: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

aiModerationStateSchema.index({ lockedUntil: 1 });

export default mongoose.model("AiModerationState", aiModerationStateSchema);
