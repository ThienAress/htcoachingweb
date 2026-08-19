import mongoose from "mongoose";

const fitnessPlusQuotaUsageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    serviceKey: {
      type: String,
      enum: ["ai_chat", "meal_scan"],
      required: true,
    },
    timestamps: {
      type: [Date],
      default: [],
      select: false,
    },
    expiresAt: {
      type: Date,
      required: true,
      select: false,
    },
  },
  { timestamps: true },
);

fitnessPlusQuotaUsageSchema.index(
  { userId: 1, serviceKey: 1 },
  { unique: true, name: "uniq_fitness_plus_quota_usage" },
);
fitnessPlusQuotaUsageSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, name: "fitness_plus_quota_usage_ttl" },
);

export default mongoose.model(
  "FitnessPlusQuotaUsage",
  fitnessPlusQuotaUsageSchema,
);
