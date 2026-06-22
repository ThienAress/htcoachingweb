import mongoose from "mongoose";

// ===== Exercise Item (1 bài tập trong section) =====
const exerciseItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    sets: { type: String, default: "" },
    reps: { type: String, default: "" },
    tempo: { type: String, default: "" },
    duration: { type: String, default: "" },
    coachingTips: { type: String, default: "" },
    maxWeight: { type: String, default: "" },
    assessment: {
      type: String,
      enum: ["", "pass", "fail"],
      default: "",
    },
    setsAssessment: { type: String, enum: ["", "pass", "fail"], default: "" },
    repsAssessment: { type: String, enum: ["", "pass", "fail"], default: "" },
    tempoAssessment: { type: String, enum: ["", "pass", "fail"], default: "" },
    failReason: { type: String, default: "", trim: true },
  },
  { _id: false }
);

// ===== Section (nhóm bài tập: Warm Up, Strength...) =====
const sectionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    icon: { type: String, default: "" },
    sortOrder: { type: Number, default: 0 },
    exercises: [exerciseItemSchema],
  },
  { _id: true }
);

// ===== Workout Plan chính =====
const workoutPlanSchema = new mongoose.Schema(
  {
    trainerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    clientName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    clientEmail: {
      type: String,
      default: "",
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    planDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["draft", "published", "completed"],
      default: "draft",
    },
    sections: [sectionSchema],
    trainerNote: {
      type: String,
      default: "",
      maxlength: 500,
    },
    overallAssessment: {
      type: String,
      default: "",
      maxlength: 200,
    },
  },
  { timestamps: true }
);

// ✅ Indexes
workoutPlanSchema.index({ trainerId: 1, planDate: -1 });
workoutPlanSchema.index({ clientId: 1, planDate: -1 });
workoutPlanSchema.index({ trainerId: 1, clientEmail: 1 });
workoutPlanSchema.index({ status: 1 });

export default mongoose.model("WorkoutPlan", workoutPlanSchema);
