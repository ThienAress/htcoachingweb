import mongoose from "mongoose";

const exerciseSuggestionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    muscleGroup: {
      type: String,
      default: "",
    },
    description: {
      type: String,
      default: "",
    },
    suggestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    adminNote: {
      type: String,
      default: "",
    },
  },
  { timestamps: true },
);

exerciseSuggestionSchema.index({ createdAt: -1 });
exerciseSuggestionSchema.index({ status: 1 });

export default mongoose.model("ExerciseSuggestion", exerciseSuggestionSchema);
