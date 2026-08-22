import mongoose from "mongoose";

const recipeReviewSchema = new mongoose.Schema(
  {
    recipeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Recipe",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: { validator: Number.isInteger, message: "Rating phải là số nguyên" },
    },
    comment: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },
  },
  { timestamps: true },
);

recipeReviewSchema.index(
  { recipeId: 1, userId: 1 },
  { unique: true, name: "uniq_recipe_review_user" },
);
recipeReviewSchema.index(
  { recipeId: 1, createdAt: -1 },
  { name: "recipe_reviews_recipe_created" },
);

export default mongoose.model("RecipeReview", recipeReviewSchema);
