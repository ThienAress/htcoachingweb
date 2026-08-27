import mongoose from "mongoose";

const exerciseReviewSchema = new mongoose.Schema(
  {
    exerciseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exercise",
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
      validate: {
        validator: Number.isInteger,
        message: "Rating phải là số nguyên",
      },
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

exerciseReviewSchema.index(
  { exerciseId: 1, userId: 1 },
  { unique: true, name: "uniq_exercise_review_user" },
);
exerciseReviewSchema.index(
  { exerciseId: 1, createdAt: -1 },
  { name: "exercise_reviews_exercise_created" },
);

export default mongoose.model("ExerciseReview", exerciseReviewSchema);
