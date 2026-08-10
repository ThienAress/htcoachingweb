import mongoose from "mongoose";

import {
  MEAL_PLAN_ALLERGEN_KEYS,
  MEAL_PLAN_ALLERGY_STATUSES,
  MEAL_PLAN_BUDGET_VND,
  MEAL_PLAN_OTHER_ALLERGEN_TEXT,
} from "../constants/mealPlanPreferences.js";

const UNSAFE_OTHER_ALLERGEN_TEXT = /[\u0000-\u001F\u007F<>@]|https?:\/\/|www\./iu;

const mealPlanPreferencesSchema = new mongoose.Schema(
  {
    allergyStatus: {
      type: String,
      enum: MEAL_PLAN_ALLERGY_STATUSES,
      required: true,
    },
    allergens: {
      type: [{ type: String, enum: MEAL_PLAN_ALLERGEN_KEYS }],
      default: [],
      validate: [
        {
          validator(value) {
            return new Set(value).size === value.length;
          },
          message: "Danh sách dị ứng không được trùng",
        },
        {
          validator(value) {
            return this.allergyStatus === "declared" || value.length === 0;
          },
          message: "Danh sách dị ứng không khớp trạng thái",
        },
      ],
    },
    otherAllergenText: {
      type: String,
      default: "",
      trim: true,
      maxlength: MEAL_PLAN_OTHER_ALLERGEN_TEXT.maxLength,
      validate: [
        {
          validator(value) {
            return !UNSAFE_OTHER_ALLERGEN_TEXT.test(String(value || ""));
          },
          message: "Dị ứng khác chứa nội dung không hợp lệ",
        },
        {
          validator(value) {
            const hasOther = Boolean(String(value || "").trim());
            const hasKnown = (this.allergens || []).length > 0;
            return this.allergyStatus === "declared"
              ? hasKnown || hasOther
              : !hasOther;
          },
          message: "Dị ứng khác không khớp trạng thái",
        },
      ],
    },
    budgetVndPerDay: {
      type: Number,
      default: null,
      min: MEAL_PLAN_BUDGET_VND.min,
      max: MEAL_PLAN_BUDGET_VND.max,
      validate: {
        validator: (value) => value == null || Number.isInteger(value),
        message: "Ngân sách phải là số nguyên VND",
      },
    },
    reviewedAt: { type: Date, required: true },
  },
  { _id: false, strict: "throw" },
);

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,

  password: {
    type: String,
    select: false,
  },
  role: {
    type: String,
    enum: ["admin", "trainer", "user"],
    default: "user",
  },

  avatar: String,
  address: String,

  mealPlanGenerations: {
    type: Number,
    default: 0,
  },

  mealPlanPreferences: {
    type: mealPlanPreferencesSchema,
    default: undefined,
    select: false,
  },

  refreshToken: {
    type: String,
    default: null,
    select: false,
  },

  isAiChatBanned: {
    type: Boolean,
    default: false,
  },

  savedRecipes: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Recipe",
    },
  ],
});
// ✅ Indexes
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });

export default mongoose.model("User", userSchema);
