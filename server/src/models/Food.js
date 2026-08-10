// models/Food.js
import mongoose from "mongoose";

import {
  FOOD_NUTRITION_BASES,
  FOOD_SOURCE_TYPES,
} from "../services/foodProvenance.js";
import {
  MEAL_PLAN_ALLERGEN_KEYS,
  MEAL_PLAN_ALLERGEN_REVIEW_SCOPES,
  MEAL_PLAN_SPECIFIC_FOOD_KEYS,
} from "../constants/mealPlanPreferences.js";

const foodAllergenSchema = new mongoose.Schema(
  {
    reviewStatus: {
      type: String,
      enum: ["unreviewed", "reviewed"],
      default: "unreviewed",
      required: true,
    },
    contains: {
      type: [{ type: String, enum: MEAL_PLAN_ALLERGEN_KEYS }],
      default: [],
    },
    mayContain: {
      type: [{ type: String, enum: MEAL_PLAN_ALLERGEN_KEYS }],
      default: [],
    },
    reviewedScopes: {
      type: [{ type: String, enum: MEAL_PLAN_ALLERGEN_REVIEW_SCOPES }],
      default: [],
    },
    specificContains: {
      type: [{ type: String, enum: MEAL_PLAN_SPECIFIC_FOOD_KEYS }],
      default: [],
    },
    sourceType: {
      type: String,
      enum: ["package_label", "manufacturer", "official_database", null],
      default: null,
    },
    sourceUrl: { type: String, trim: true, maxlength: 500, default: "" },
    reviewedAt: { type: Date, default: null },
  },
  { _id: false, strict: "throw" },
);

foodAllergenSchema.path("mayContain").validate(function validateAllergens(value) {
  const contains = new Set(this.contains || []);
  return (
    new Set(value).size === value.length &&
    new Set(this.contains || []).size === (this.contains || []).length &&
    !value.some((item) => contains.has(item))
  );
}, "Metadata dị ứng không hợp lệ");

foodAllergenSchema.path("specificContains").validate(function validateSpecificFoods(value) {
  return (
    new Set(value).size === value.length &&
    (value.length === 0 || (this.reviewedScopes || []).includes("specific_foods"))
  );
}, "Metadata thực phẩm cụ thể không hợp lệ");

foodAllergenSchema.path("reviewedScopes").validate(function validateReviewScopes(value) {
  return (
    new Set(value).size === value.length &&
    (this.reviewStatus === "reviewed" || value.length === 0)
  );
}, "Scope kiểm duyệt dị ứng không hợp lệ");

foodAllergenSchema.path("reviewedAt").validate(function validateReview(value) {
  return this.reviewStatus === "reviewed"
    ? Boolean(value && this.sourceType)
    : value == null &&
        this.sourceType == null &&
        (this.reviewedScopes || []).length === 0 &&
        (this.specificContains || []).length === 0;
}, "Nguồn kiểm duyệt dị ứng không hợp lệ");

const foodSourceSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: FOOD_SOURCE_TYPES,
      default: "legacy_unknown",
      required: true,
    },
    provider: { type: String, trim: true, maxlength: 120, default: "" },
    externalId: { type: String, trim: true, maxlength: 120, default: "" },
    datasetVersion: { type: String, trim: true, maxlength: 80, default: "" },
    license: { type: String, trim: true, maxlength: 80, default: "" },
    attribution: { type: String, trim: true, maxlength: 240, default: "" },
    sourceUrl: { type: String, trim: true, maxlength: 500, default: "" },
    retrievedAt: { type: Date, default: null },
    verifiedAt: { type: Date, default: null },
  },
  { _id: false },
);

const foodSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true,
      unique: true, // tránh trùng tên thực phẩm
    },
    protein: {
      type: Number,
      required: true,
      min: 0,
    },
    carb: {
      type: Number,
      required: true,
      min: 0,
    },
    fat: {
      type: Number,
      required: true,
      min: 0,
    },
    calories: { type: Number, required: true, min: 0 },
    nutritionBasis: {
      type: String,
      enum: FOOD_NUTRITION_BASES,
      default: "per_100g",
      required: true,
    },
    source: {
      type: foodSourceSchema,
      default: () => ({ type: "legacy_unknown" }),
      required: true,
    },
    allergenProfile: {
      type: foodAllergenSchema,
      default: () => ({ reviewStatus: "unreviewed" }),
      required: true,
    },
  },
  { timestamps: true },
);

// Indexes
foodSchema.index({ label: "text" }); // hỗ trợ tìm kiếm
foodSchema.index({ createdAt: -1 });

export default mongoose.model("Food", foodSchema);
