import mongoose from "mongoose";

import {
  AI_MEMORY_CONSENT_VERSION,
  AI_MEMORY_KINDS,
  AI_MEMORY_TTL_MS,
  AI_MEMORY_VALUES,
} from "../constants/aiMemory.js";

const aiMemorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },
    kind: {
      type: String,
      enum: AI_MEMORY_KINDS,
      required: true,
      immutable: true,
    },
    value: {
      type: String,
      required: true,
      validate: {
        validator(value) {
          return AI_MEMORY_VALUES[this.kind]?.includes(value) === true;
        },
        message: "Giá trị AI memory không hợp lệ",
      },
    },
    status: {
      type: String,
      enum: ["active", "superseded"],
      default: "active",
      required: true,
    },
    version: { type: Number, required: true, min: 1 },
    source: {
      type: String,
      enum: ["explicit_user"],
      default: "explicit_user",
      immutable: true,
    },
    consentVersion: {
      type: String,
      enum: [AI_MEMORY_CONSENT_VERSION],
      required: true,
      immutable: true,
    },
    supersedesMemoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AiMemory",
      default: null,
      immutable: true,
    },
    supersededAt: { type: Date, default: null },
    lastConfirmedAt: { type: Date, required: true },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + AI_MEMORY_TTL_MS),
    },
  },
  { timestamps: true },
);

aiMemorySchema.index(
  { userId: 1, kind: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "active" },
    name: "uniq_active_ai_memory_kind",
  },
);
aiMemorySchema.index(
  { userId: 1, status: 1, updatedAt: -1 },
  { name: "ai_memory_owner_status_updated" },
);
aiMemorySchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, name: "ai_memory_expiry_ttl" },
);

export default mongoose.model("AiMemory", aiMemorySchema);
