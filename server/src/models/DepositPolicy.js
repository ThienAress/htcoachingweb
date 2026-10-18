import mongoose from "mongoose";

import {
  DEFAULT_DEPOSIT_BONUS_RATES,
  DEFAULT_DEPOSIT_TIER_MINIMUMS,
  DEPOSIT_POLICY_ID,
  MAX_DEPOSIT_TIER_LABEL_LENGTH,
  DEPOSIT_POLICY_KEY,
} from "../constants/depositPolicy.js";

const safeRate = {
  type: Number,
  required: true,
  min: 0,
  max: 100,
  validate: Number.isSafeInteger,
};

const safeMinimum = {
  type: Number,
  required: true,
  min: 1,
  validate: Number.isSafeInteger,
};

const tierLabel = {
  type: String,
  default: "",
  trim: true,
  maxlength: MAX_DEPOSIT_TIER_LABEL_LENGTH,
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
    // Mốc nạp của bậc 2 và bậc 3 (bậc 1 luôn là mức nạp tối thiểu). Thiếu = mốc mặc định.
    minimums: {
      growth: { ...safeMinimum, default: DEFAULT_DEPOSIT_TIER_MINIMUMS.growth },
      premium: { ...safeMinimum, default: DEFAULT_DEPOSIT_TIER_MINIMUMS.premium },
    },
    // Tên hiển thị tùy chọn; rỗng = dùng tên mặc định ở giao diện.
    labels: {
      starter: tierLabel,
      growth: tierLabel,
      premium: tierLabel,
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
