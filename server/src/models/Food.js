// models/Food.js
import mongoose from "mongoose";

import {
  FOOD_NUTRITION_BASES,
  FOOD_SOURCE_TYPES,
} from "../services/foodProvenance.js";

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
  },
  { timestamps: true },
);

// Indexes
foodSchema.index({ label: "text" }); // hỗ trợ tìm kiếm
foodSchema.index({ createdAt: -1 });

export default mongoose.model("Food", foodSchema);
