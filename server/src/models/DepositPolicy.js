import mongoose from "mongoose";

import {
  DEFAULT_DEPOSIT_BONUS_RATES,
  DEPOSIT_POLICY_ID,
  DEPOSIT_POLICY_KEY,
} from "../constants/depositPolicy.js";

const safeRate = {
  type: Number,
  required: true,
  min: 0,
  max: 100,
  validate: Number.isSafeInteger,
};

const depositPolicySchema = new mongoose.Schema(
  {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(DEPOSIT_POLICY_ID),
      immutable: true,
    },
    policyKey: {
      type: String,
      enum: [DEPOSIT_POLICY_KEY],
      default: DEPOSIT_POLICY_KEY,
      immutable: true,
      required: true,
    },
    policyVersion: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
      validate: Number.isSafeInteger,
    },
    rates: {
      starter: { ...safeRate, default: DEFAULT_DEPOSIT_BONUS_RATES.starter },
      growth: { ...safeRate, default: DEFAULT_DEPOSIT_BONUS_RATES.growth },
      premium: { ...safeRate, default: DEFAULT_DEPOSIT_BONUS_RATES.premium },
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

export default mongoose.model("DepositPolicy", depositPolicySchema);
