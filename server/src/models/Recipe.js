// models/Recipe.js
import mongoose from "mongoose";

const ingredientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    measure: { type: String, default: "", trim: true, maxlength: 100 },
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
