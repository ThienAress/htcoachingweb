import mongoose from "mongoose";

import { SERVICE_ACCESS_TIERS } from "../constants/serviceAccessPolicies.js";

const serviceUsageBucketSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      maxlength: 64,
    },
    serviceKey: {
      type: String,
      enum: ["ai_chat", "meal_scan"],
      required: true,
      immutable: true,
    },
    actorKind: {
      type: String,
      enum: ["user", "guest"],
      required: true,
      immutable: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      immutable: true,
    },
    guestKey: {
      type: String,
      default: null,
      maxlength: 64,
      select: false,
      immutable: true,
    },
    tier: {
      type: String,
      enum: Object.values(SERVICE_ACCESS_TIERS),
      required: true,
    },
    limit: { type: Number, required: true, min: 1 },
    count: { type: Number, required: true, min: 0 },
    operationHashes: {
      type: [String],
      default: [],
      select: false,
    },
    windowStartedAt: { type: Date, required: true },
    resetAt: { type: Date, required: true },
  },
  { timestamps: true },
);

serviceUsageBucketSchema.pre("validate", function validateUsageOwner() {
  const ownerCount = Number(Boolean(this.userId)) + Number(Boolean(this.guestKey));
  if (ownerCount !== 1) {
    this.invalidate(
      "userId",
      "Usage bucket phải thuộc đúng một user hoặc guest actor",
    );
  }
});

// Correctness uses the deterministic built-in _id index. These indexes support
// owner-scoped operations and asynchronous expiry once separately applied.
serviceUsageBucketSchema.index(
  { resetAt: 1 },
  { expireAfterSeconds: 0, name: "service_usage_expiry_ttl" },
);
serviceUsageBucketSchema.index(
  { userId: 1, serviceKey: 1 },
  {
    partialFilterExpression: { userId: { $type: "objectId" } },
    name: "service_usage_user_service",
  },
);
serviceUsageBucketSchema.index(
  { guestKey: 1, serviceKey: 1 },
  {
    partialFilterExpression: { guestKey: { $type: "string" } },
    name: "service_usage_guest_service",
  },
);

export default mongoose.model("ServiceUsageBucket", serviceUsageBucketSchema);
