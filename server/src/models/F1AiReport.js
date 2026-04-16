import mongoose from "mongoose";

const PHASE_ENUM = [
  "pending_review",
  "phase_1",
  "phase_2",
  "phase_3",
  "phase_4",
  "phase_5",
  "",
];

const reviewGroupSchema = new mongoose.Schema(
  {
    health: { type: [String], default: [] },
    physical: { type: [String], default: [] },
    lifestyle: { type: [String], default: [] },
    nutrition: { type: [String], default: [] },
    riskFactors: { type: [String], default: [] },
  },
  { _id: false },
);

const quickOverviewSchema = new mongoose.Schema(
  {
    headline: { type: String, default: "", trim: true },
    coachConclusion: { type: String, default: "", trim: true },
  },
  { _id: false },
);

const physicalChartSchema = new mongoose.Schema(
  {
    posture: { type: Number, default: null },
    strength: { type: Number, default: null },
    endurance: { type: Number, default: null },
    cardio: { type: Number, default: null },
  },
  { _id: false },
);

const startupPlanSchema = new mongoose.Schema(
  {
    startPhase: {
      type: String,
      enum: [...PHASE_ENUM, ""],
      default: "",
    },
    combinedPlan: { type: [String], default: [] },
    cautions: { type: [String], default: [] },
  },
  { _id: false },
);

const reportSummarySchema = new mongoose.Schema(
  {
    quickOverview: { type: quickOverviewSchema, default: () => ({}) },
    generalReview: { type: reviewGroupSchema, default: () => ({}) },
    physicalChart: { type: physicalChartSchema, default: () => ({}) },
    startupPlan: { type: startupPlanSchema, default: () => ({}) },
  },
  { _id: false },
);

const f1AiReportSchema = new mongoose.Schema(
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

    inputSummary: {
      readinessStatus: {
        type: String,
        enum: ["pending", "ready", "caution", "hold"],
        default: "pending",
      },
      painFlag: {
        type: String,
        enum: ["none", "mild", "moderate", "severe"],
        default: "none",
      },
      primaryGoal: {
        type: String,
        default: "",
        trim: true,
      },
      overallPhysicalLevel: {
        type: String,
        enum: ["low", "below_average", "average", "good", ""],
        default: "",
      },
    },

    findings: {
      riskFlags: { type: [String], default: [] },
      compensationFlags: { type: [String], default: [] },
      lifestyleFlags: { type: [String], default: [] },
      strengthFlags: { type: [String], default: [] },
      enduranceFlags: { type: [String], default: [] },
      cardioFlags: { type: [String], default: [] },
    },

    recommendations: {
      correctiveFocus: { type: [String], default: [] },
      trainingFocus: { type: [String], default: [] },
      recommendedStartPhase: {
        type: String,
        enum: PHASE_ENUM,
        default: "phase_1",
      },
      trainingNotes: { type: [String], default: [] },
    },

    reportSummary: {
      type: reportSummarySchema,
      default: () => ({}),
    },

    engineVersion: {
      type: String,
      default: "nasm-rule-engine-v3",
      trim: true,
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
    approvedByCoach: {
      type: Boolean,
      default: false,
    },
    coachNote: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true },
);

f1AiReportSchema.index({ customerId: 1, createdAt: -1 });
f1AiReportSchema.index({ intakeId: 1 });
f1AiReportSchema.index({ assessmentId: 1 });
f1AiReportSchema.index({ approvedByCoach: 1 });

export default mongoose.model("F1AiReport", f1AiReportSchema);
