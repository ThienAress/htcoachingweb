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
    // Lịch tập mỗi tuần khi HLV tự thiết kế giai đoạn.
    weeklySchedule: { type: Object, default: null },
    designedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
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
    // Khoảng ước tính {metric: {min, max}} quanh giá trị giữa.
    projectedRange: { type: Object, default: {} },
    deltaFromBaseline: { type: Object, default: {} },
    // Số hệ thống tính và các chỉ số HLV ghi đè (khi HLV tự thiết kế).
    systemProjected: { type: Object, default: null },
    overrides: { type: Object, default: null },
    summary: { type: String, default: "" },
  },
  { _id: false },
);

const outcomeTableSchema = new mongoose.Schema(
  {
    metricColumns: { type: [String], default: [] },
    baseline: { type: Object, default: {} },
    // So sánh kết quả dự kiến với cân nặng và thời gian khách mong muốn.
    goalProgress: { type: Object, default: null },
    recoveryFactor: { type: Number, default: 1 },
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

const visualStageGenerationSchema = new mongoose.Schema(
  {
    generatedAt: {
      type: Date,
      default: null,
    },
    lastRequestedAt: {
      type: Date,
      default: null,
    },
    attemptCount: {
      type: Number,
      default: 0,
      min: 0,
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
    reservationId: {
      type: String,
      default: "",
      trim: true,
    },
    reservedUntil: {
      type: Date,
      default: null,
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

    // Giai đoạn 1 do hệ thống đề xuất hay HLV tự thiết kế.
    planSource: {
      type: String,
      enum: ["system", "trainer"],
      default: "system",
    },

    engineVersion: {
      type: String,
      default: "result-prediction-v2",
      trim: true,
    },
    sourceFingerprint: {
      type: String,
      default: null,
      trim: true,
    },
    generationKey: {
      type: String,
      default: "canonical",
      trim: true,
    },
    requestId: {
      type: String,
      default: null,
      trim: true,
    },
    version: {
      type: Number,
      default: null,
      min: 1,
    },
    regeneratedFrom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "F1ResultPrediction",
      default: null,
    },

    generatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

f1ResultPredictionSchema.index({ customerId: 1, createdAt: -1 });
f1ResultPredictionSchema.index(
  { requestId: 1 },
  {
    name: "uniq_f1_prediction_request",
    unique: true,
    partialFilterExpression: { requestId: { $type: "string" } },
  },
);
f1ResultPredictionSchema.index(
  {
    customerId: 1,
    intakeId: 1,
    assessmentId: 1,
    aiReportId: 1,
    engineVersion: 1,
    sourceFingerprint: 1,
    generationKey: 1,
  },
  {
    name: "uniq_f1_prediction_source",
    unique: true,
    partialFilterExpression: { sourceFingerprint: { $type: "string" } },
  },
);
f1ResultPredictionSchema.index(
  { customerId: 1, version: 1 },
  {
    name: "uniq_f1_prediction_version",
    unique: true,
    partialFilterExpression: { version: { $type: "number" } },
  },
);

export default mongoose.model("F1ResultPrediction", f1ResultPredictionSchema);
