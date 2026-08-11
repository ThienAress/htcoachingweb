import mongoose from "mongoose";

import { AI_MEMORY_CONSENT_VERSION } from "../constants/aiMemory.js";

const aiMemoryPreferenceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      immutable: true,
    },
    enabled: { type: Boolean, default: false },
    consentVersion: {
      type: String,
      enum: [AI_MEMORY_CONSENT_VERSION, null],
      default: null,
    },
    consentedAt: { type: Date, default: null },
    disabledAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export default mongoose.model("AiMemoryPreference", aiMemoryPreferenceSchema);
