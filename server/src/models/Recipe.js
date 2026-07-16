// models/Recipe.js
import mongoose from "mongoose";

const ingredientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    measure: { type: String, default: "" },
  },
  { _id: false },
);

const recipeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    nameEn: {
      type: String,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    category: {
      type: String,
      trim: true,
    },
    area: {
      type: String,
      trim: true,
    },
    thumbnail: {
      type: String,
      default: "",
    },
    prepTime: {
      type: String,
      default: "",
    },
    ingredients: [ingredientSchema],
    instructions: [String],
    youtubeUrl: {
      type: String,
      default: "",
    },
    sourceUrl: {
      type: String,
      default: "",
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
  },
  { timestamps: true },
);

// Indexes
recipeSchema.index({ name: "text", nameEn: "text" });
recipeSchema.index({ category: 1 });
recipeSchema.index({ area: 1 });
recipeSchema.index({ source: 1 });
recipeSchema.index({ tags: 1 });
recipeSchema.index({ createdAt: -1 });

export default mongoose.model("Recipe", recipeSchema);
