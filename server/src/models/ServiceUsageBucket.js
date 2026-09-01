import mongoose from "mongoose";

import { SERVICE_ACCESS_TIERS } from "../constants/serviceAccessPolicies.js";

const serviceUsageEventSchema = new mongoose.Schema(
  {
    operationHash: {
      type: String,
      required: true,
      match: /^[a-f0-9]{64}$/,
    },
    consumedAt: { type: Date, required: true },
    units: { type: Number, required: true, default: 1, min: 1, max: 1000 },
  },
  { _id: false },
);

const serviceUsageBucketSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      maxlength: 64,
    },
    serviceKey: {
      type: String,
      enum: ["ai_chat", "meal_scan", "practice_email"],
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
    policyGroup: {
      type: String,
      default: "legacy",
      maxlength: 32,
    },
    usageEvents: {
      type: [serviceUsageEventSchema],
      default: [],
      select: false,
    },
    // Compatibility/debug summary fields. Enforcement reads usageEvents only.
    limit: { type: Number, default: null, min: 1 },
    count: { type: Number, default: 0, min: 0 },
    operationHashes: {
      type: [String],
      default: [],
      select: false,
    },
    windowStartedAt: { type: Date, default: null },
    resetAt: { type: Date, default: null },
    lastOperationHash: { type: String, default: null, select: false },
    lastOperationAccepted: { type: Boolean, default: false, select: false },
    lastOperationConsumed: { type: Boolean, default: false, select: false },
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
