import mongoose from "mongoose";

const PHASE_ENUM = ["phase_1", "phase_2", "phase_3", "phase_4", "phase_5", ""];

const frameworkSchema = new mongoose.Schema(
  {
    levels: { type: Array, default: [] },
    recommendedStartPhase: {
      type: String,
      enum: PHASE_ENUM,
      default: "",
    },
    phaseCeiling: {
      type: String,
      enum: PHASE_ENUM,
      default: "",
    },
    personalizedPath: {
      type: [String],
      default: [],
    },
  },
  { _id: false },
);

const phaseRoadmapItemSchema = new mongoose.Schema(
  {
    stageOrder: { type: Number, default: 0 },
    phaseKey: {
      type: String,
      enum: PHASE_ENUM,
      default: "",
    },
    levelTitle: { type: String, default: "" },
    phaseTitle: { type: String, default: "" },
    durationWeeks: { type: Number, default: 0 },
    objective: { type: String, default: "" },
    entryReason: { type: String, default: "" },
    keyFocus: { type: [String], default: [] },
    expectedChanges: { type: [String], default: [] },
    exitCriteria: { type: [String], default: [] },
  },
  { _id: false },
);

const outcomeCheckpointSchema = new mongoose.Schema(
  {
    phaseKey: {
      type: String,
      enum: PHASE_ENUM,
      default: "",
    },
    label: { type: String, default: "" },
    durationWeeks: { type: Number, default: 0 },
    projected: { type: Object, default: {} },
    deltaFromBaseline: { type: Object, default: {} },
    summary: { type: String, default: "" },
  },
  { _id: false },
);

const outcomeTableSchema = new mongoose.Schema(
  {
    metricColumns: { type: [String], default: [] },
    baseline: { type: Object, default: {} },
    phaseCheckpoints: {
      type: [outcomeCheckpointSchema],
      default: [],
    },
  },
  { _id: false },
);

const beforeImagesSchema = new mongoose.Schema(
  {
    frontMediaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "F1Media",
      default: null,
    },
    sideMediaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "F1Media",
      default: null,
    },
    frontUrl: {
      type: String,
      default: "",
      trim: true,
    },
    sideUrl: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { _id: false },
);

const visualStageImageSchema = new mongoose.Schema(
  {
    frontUrl: {
      type: String,
      default: "",
      trim: true,
    },
    sideUrl: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { _id: false },
);

const visualStageGenerationSchema = new mongoose.Schema(
  {
    generatedAt: {
      type: Date,
      default: null,
    },
    provider: {
      type: String,
      default: "",
      trim: true,
    },
    model: {
      type: String,
      default: "",
      trim: true,
    },
    lastError: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { _id: false },
);

const visualStageSchema = new mongoose.Schema(
  {
    phaseKey: {
      type: String,
      enum: PHASE_ENUM,
      default: "",
    },
    label: { type: String, default: "" },
    visualSummary: { type: String, default: "" },
    frontDescriptor: { type: String, default: "" },
    sideDescriptor: { type: String, default: "" },
    imageStatus: {
      type: String,
      enum: ["descriptor_only", "generating", "generated", "failed"],
      default: "descriptor_only",
    },
    images: {
      type: visualStageImageSchema,
      default: () => ({}),
    },
    generation: {
      type: visualStageGenerationSchema,
      default: () => ({}),
    },
  },
  { _id: false },
);

const f1ResultPredictionSchema = new mongoose.Schema(
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

    framework: {
      type: frameworkSchema,
      default: () => ({}),
    },

    phaseRoadmap: {
      type: [phaseRoadmapItemSchema],
      default: [],
    },

    outcomeTable: {
      type: outcomeTableSchema,
      default: () => ({}),
    },

    beforeImages: {
      type: beforeImagesSchema,
      default: () => ({}),
    },

    visualStages: {
      type: [visualStageSchema],
      default: [],
    },

    sourceSummary: {
      type: Object,
      default: {},
    },

    engineVersion: {
      type: String,
      default: "result-prediction-v1",
      trim: true,
    },

    generatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

f1ResultPredictionSchema.index({ customerId: 1, createdAt: -1 });

export default mongoose.model("F1ResultPrediction", f1ResultPredictionSchema);
