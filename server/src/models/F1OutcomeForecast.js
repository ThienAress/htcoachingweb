import mongoose from "mongoose";

const caseSchema = new mongoose.Schema(
  {
    months: { type: Number, default: null },
    summary: { type: String, default: "", trim: true },
  },
  { _id: false },
);

const milestoneSchema = new mongoose.Schema(
  {
    week: { type: Number, required: true },
    title: { type: String, default: "", trim: true },
    expectedChange: { type: String, default: "", trim: true },
  },
  { _id: false },
);

const f1OutcomeForecastSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "F1Customer",
      required: true,
    },
    intakeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "F1Intake",
      required: true,
    },
    assessmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "F1Assessment",
      required: true,
    },
    aiReportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "F1AiReport",
      required: true,
    },

    forecastType: {
      type: String,
      enum: ["goal_timeline_v1"],
      default: "goal_timeline_v1",
    },

    inputSummary: {
      primaryGoal: { type: String, default: "", trim: true },
      currentWeightKg: { type: Number, default: null },
      targetWeightKg: { type: Number, default: null },
      bodyFatPercent: { type: Number, default: null },
      readinessStatus: { type: String, default: "", trim: true },
      overallPhysicalLevel: { type: String, default: "", trim: true },
      trainingDaysPerWeek: { type: Number, default: null },
      sleepHours: { type: Number, default: null },
      stressLevel: { type: String, default: "", trim: true },
    },

    forecast: {
      fastCase: { type: caseSchema, default: () => ({}) },
      realisticCase: { type: caseSchema, default: () => ({}) },
      slowCase: { type: caseSchema, default: () => ({}) },
      confidence: {
        type: String,
        enum: ["low", "medium", "high"],
        default: "medium",
      },
      blockers: { type: [String], default: [] },
      assumptions: { type: [String], default: [] },
      milestones: { type: [milestoneSchema], default: [] },
    },

    engineVersion: {
      type: String,
      default: "forecast-engine-v1",
      trim: true,
    },

    coachNote: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true },
);

f1OutcomeForecastSchema.index({ customerId: 1, createdAt: -1 });
f1OutcomeForecastSchema.index({ aiReportId: 1 });

export default mongoose.model("F1OutcomeForecast", f1OutcomeForecastSchema);
