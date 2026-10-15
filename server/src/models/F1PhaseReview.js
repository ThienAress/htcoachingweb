import mongoose from "mongoose";

// Đánh giá cuối một giai đoạn trong lộ trình của khách F1: HLV nhập kết quả thực tế,
// hệ thống chấm mức hoàn thành và đề xuất giai đoạn kế tiếp. `stageOrder` là thứ tự
// giai đoạn trong lộ trình của khách (1, 2, 3…), không phải số phase NASM.
const PHASE_ENUM = ["phase_1", "phase_2", "phase_3", "phase_4", "phase_5"];
const LEVEL_ENUM = ["low", "below_average", "average", "good", ""];
const QUALITY_ENUM = ["good", "fair", "poor"];

export const MAX_RECOMMENDATION_CHECKS = 10;
export const MAX_RETESTS = 24;

const actualSchema = new mongoose.Schema(
  {
    weightKg: { type: Number, required: true, min: 10, max: 300 },
    waistCm: { type: Number, default: null, min: 30, max: 250 },
    hipCm: { type: Number, default: null, min: 30, max: 250 },
    bodyFatPercent: { type: Number, default: null, min: 2, max: 70 },
    restingHeartRate: { type: Number, default: null, min: 30, max: 220 },
  },
  { _id: false },
);

const adherenceSchema = new mongoose.Schema(
  {
    plannedSessions: { type: Number, required: true, min: 1, max: 400 },
    completedSessions: { type: Number, required: true, min: 0, max: 400 },
    nutrition: { type: String, enum: QUALITY_ENUM, default: "fair" },
    sleep: { type: String, enum: QUALITY_ENUM, default: "fair" },
  },
  { _id: false },
);

const recommendationCheckSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true, maxlength: 300 },
    status: {
      type: String,
      enum: ["met", "partial", "not_met"],
      required: true,
    },
  },
  { _id: false },
);

const retestSchema = new mongoose.Schema(
  {
    metricKey: { type: String, required: true, trim: true, maxlength: 40 },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    tier: {
      type: String,
      enum: ["easy", "standard", "advanced", ""],
      default: "",
    },
    sets: { type: Number, default: null, min: 0, max: 20 },
    reps: { type: Number, default: null, min: 0, max: 500 },
    durationSec: { type: Number, default: null, min: 0, max: 7200 },
    previousLevel: { type: String, enum: LEVEL_ENUM, default: "" },
    level: { type: String, enum: LEVEL_ENUM, default: "" },
  },
  { _id: false },
);

const ohsaItemSchema = new mongoose.Schema(
  {
    view: { type: String, enum: ["anterior", "lateral", "posterior"], required: true },
    key: { type: String, default: "", trim: true, maxlength: 100 },
    label: { type: String, required: true, trim: true, maxlength: 100 },
    status: { type: String, enum: ["persists", "resolved", "new"], required: true },
  },
  { _id: false },
);

const f1PhaseReviewSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "F1Customer",
      required: true,
    },
    predictionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "F1ResultPrediction",
      required: true,
    },
    trainerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    stageOrder: { type: Number, required: true, min: 1, max: 20 },
    phaseKey: { type: String, enum: PHASE_ENUM, required: true },
    measuredAt: { type: Date, required: true },

    actual: { type: actualSchema, required: true },
    adherence: { type: adherenceSchema, required: true },
    recommendationChecks: {
      type: [recommendationCheckSchema],
      default: [],
      validate: {
        validator: (items) => items.length <= MAX_RECOMMENDATION_CHECKS,
        message: "Tối đa 10 lời khuyên",
      },
    },
    retests: {
      type: [retestSchema],
      default: [],
      validate: {
        validator: (items) => items.length <= MAX_RETESTS,
        message: "Quá nhiều bài test lại",
      },
    },
    ohsa: {
      anteriorIssue: { type: Boolean, default: false },
      lateralIssue: { type: Boolean, default: false },
      posteriorIssue: { type: Boolean, default: false },
      // Chi tiết từng biểu hiện: còn, đã hết hoặc mới xuất hiện trong giai đoạn.
      items: {
        type: [ohsaItemSchema],
        default: [],
        validate: { validator: (items) => items.length <= 24, message: "Quá nhiều biểu hiện" },
      },
    },
    safety: {
      newPain: { type: Boolean, default: false },
      newInjury: { type: Boolean, default: false },
      warningSigns: { type: Boolean, default: false },
      note: { type: String, default: "", trim: true, maxlength: 200 },
    },

    // Kết quả do server tính; không nhận từ client.
    evaluation: { type: Object, default: {} },
    nextPhasePlan: { type: Object, default: {} },
    nextOutcome: { type: Object, default: {} },
    engineVersion: { type: String, default: "phase-review-v1", trim: true },
  },
  { timestamps: true },
);

f1PhaseReviewSchema.index(
  { customerId: 1, predictionId: 1, stageOrder: 1 },
  { name: "uniq_f1_phase_review_stage", unique: true },
);

export default mongoose.model("F1PhaseReview", f1PhaseReviewSchema);
