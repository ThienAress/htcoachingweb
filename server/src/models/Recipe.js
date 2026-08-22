// models/Recipe.js
import mongoose from "mongoose";

const ingredientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    measure: { type: String, default: "", trim: true, maxlength: 100 },
  },
  { _id: false },
);

const additionalNutritionSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 80 },
    unit: {
      type: String,
      enum: ["kcal", "g", "mg", "mcg"],
      required: true,
    },
    value: { type: Number, min: 0, required: true },
  },
  { _id: false },
);

const recipeNutritionSchema = new mongoose.Schema(
  {
    scope: {
      type: String,
      enum: ["whole_recipe"],
      default: "whole_recipe",
      required: true,
    },
    source: {
      type: String,
      enum: ["admin_manual"],
      default: "admin_manual",
      required: true,
    },
    calories: { type: Number, min: 0, default: null },
    protein: { type: Number, min: 0, default: null },
    fat: { type: Number, min: 0, default: null },
    carb: { type: Number, min: 0, default: null },
    sugars: { type: Number, min: 0, default: null },
    salt: { type: Number, min: 0, default: null },
    additional: {
      type: [additionalNutritionSchema],
      validate: {
        validator: (items) =>
          items.length <= 20 &&
          new Set(
            items.map((item) => item.label.trim().toLocaleLowerCase("vi")),
          ).size === items.length,
        message: "Tối đa 20 thành phần dinh dưỡng bổ sung, không trùng tên",
      },
      default: () => [],
    },
  },
  { _id: false },
);

const recipeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    nameEn: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 180,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    },
    category: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    area: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    thumbnail: {
      type: String,
      default: "",
      maxlength: 2048,
    },
    thumbnailPublicId: {
      type: String,
      default: "",
      select: false,
      maxlength: 300,
    },
    prepTime: {
      type: String,
      default: "",
      maxlength: 100,
    },
    ingredients: [ingredientSchema],
    nutrition: {
      type: recipeNutritionSchema,
      default: null,
    },
    instructions: [String],
    youtubeUrl: {
      type: String,
      default: "",
      maxlength: 2048,
    },
    sourceUrl: {
      type: String,
      default: "",
      maxlength: 2048,
    },
    source: {
      type: String,
      enum: ["mealdb", "ai", "manual"],
      default: "manual",
    },
    mealDbId: {
      type: String,
      default: null,
    },
    tags: [String],
    isPublished: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

recipeSchema.path("ingredients").validate(
  (items) => items.length <= 100,
  "Tối đa 100 nguyên liệu",
);
recipeSchema.path("instructions").validate(
  (items) =>
    items.length <= 100 &&
    items.every((item) => typeof item === "string" && item.length <= 2000),
  "Tối đa 100 bước, mỗi bước tối đa 2000 ký tự",
);
recipeSchema.path("tags").validate(
  (items) =>
    items.length <= 50 &&
    items.every((item) => typeof item === "string" && item.length <= 100),
  "Tối đa 50 tags, mỗi tag tối đa 100 ký tự",
);

// Indexes
recipeSchema.index({ name: "text", nameEn: "text" });
recipeSchema.index({ category: 1 });
recipeSchema.index({ area: 1 });
recipeSchema.index({ source: 1 });
recipeSchema.index({ tags: 1 });
recipeSchema.index({ createdAt: -1 });
recipeSchema.index({ isPublished: 1, createdAt: -1 });
recipeSchema.index({ isPublished: 1, category: 1, createdAt: -1 });
recipeSchema.index({ isPublished: 1, area: 1, createdAt: -1 });

export default mongoose.model("Recipe", recipeSchema);
