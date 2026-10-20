import mongoose from "mongoose";

const protocolSchema = new mongoose.Schema(
  {
    label: { type: String, default: "", trim: true },
    mode: { type: String, enum: ["reps", "time", ""], default: "" },
    setsMin: { type: Number, default: null },
    setsMax: { type: Number, default: null },
    valueMin: { type: Number, default: null },
    valueMax: { type: Number, default: null },
    unit: { type: String, default: "", trim: true },
  },
  { _id: false },
);

// Mỗi thẻ đánh giá cho phép tối đa 3 bài test (bài hệ thống hoặc bài riêng của HLV).
// Các field cấp thẻ bên dưới giữ vai trò giá trị tổng hợp để consumer cũ không đổi.
export const MAX_EXERCISES_PER_METRIC = 3;

const testedExerciseSchema = new mongoose.Schema(
  {
    name: { type: String, default: "", trim: true, maxlength: 80 },
    source: { type: String, enum: ["system", "custom"], default: "system" },
    tier: {
      type: String,
      enum: ["easy", "standard", "advanced", ""],
      default: "",
    },
    inputMode: { type: String, enum: ["reps", "time", ""], default: "" },
    sets: { type: Number, default: null },
    reps: { type: Number, default: null },
    durationSec: { type: Number, default: null },
    result: { type: Number, default: null },
    score: { type: Number, default: null },
    level: {
      type: String,
      enum: ["low", "below_average", "average", "good", ""],
      default: "",
    },
    notes: { type: String, default: "", trim: true, maxlength: 500 },
    selectedProtocol: { type: protocolSchema, default: null },
  },
  { _id: false },
);

const metricItemSchema = new mongoose.Schema(
  {
    score: { type: Number, default: null },
    level: { type: String, default: "", trim: true },
    notes: { type: String, default: "", trim: true },
    sets: { type: Number, default: null },
    reps: { type: Number, default: null },
    durationSec: { type: Number, default: null },
    result: { type: Number, default: null },
    inputMode: { type: String, enum: ["reps", "time", ""], default: "" },
    selectedProtocol: { type: protocolSchema, default: null },
    exercises: {
      type: [testedExerciseSchema],
      default: [],
      validate: {
        validator: (items) => items.length <= MAX_EXERCISES_PER_METRIC,
        message: "Mỗi mục chỉ được chọn tối đa 3 bài test",
      },
    },
  },
  { _id: false },
);

const f1AssessmentSchema = new mongoose.Schema(
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
    postureAssessment: {
      feetAnkles: { type: String, default: "", trim: true },
      knees: { type: String, default: "", trim: true },
      lphc: { type: String, default: "", trim: true },
      shouldersThoracic: { type: String, default: "", trim: true },
      headNeck: { type: String, default: "", trim: true },
    },
    movementAssessment: {
      overheadSquat: {
        anterior: { type: [String], default: [] },
        lateral: { type: [String], default: [] },
        posterior: { type: [String], default: [] },
        // HLV đã quan sát góc nhìn và xác nhận không có biểu hiện sai
        // (khác với "chưa đánh giá" khi mảng lỗi rỗng).
        anteriorNormal: { type: Boolean, default: false },
        lateralNormal: { type: Boolean, default: false },
        posteriorNormal: { type: Boolean, default: false },
      },
    },
    strengthAssessment: {
      upperBodyPush: { type: metricItemSchema, default: () => ({}) },
      upperBodyPull: { type: metricItemSchema, default: () => ({}) },
      lowerBody: { type: metricItemSchema, default: () => ({}) },
      coreStrength: { type: metricItemSchema, default: () => ({}) },
    },
    enduranceAssessment: {
      muscularEndurance: { type: metricItemSchema, default: () => ({}) },
      coreEndurance: { type: metricItemSchema, default: () => ({}) },
    },
    cardioAssessment: {
      restingHeartRate: { type: Number, default: null },
      cardioCapacity: { type: metricItemSchema, default: () => ({}) },
      recoveryHeartRate: { type: metricItemSchema, default: () => ({}) },
    },
    overallPhysicalLevel: {
      type: String,
      enum: ["low", "below_average", "average", "good"],
      default: "average",
    },
    assessorNotes: { type: String, default: "", trim: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

f1AssessmentSchema.index({ customerId: 1, createdAt: -1 });
f1AssessmentSchema.index(
  { intakeId: 1 },
  { name: "uniq_f1_assessment_per_intake", unique: true },
);
f1AssessmentSchema.index({ overallPhysicalLevel: 1 });

export default mongoose.model("F1Assessment", f1AssessmentSchema);
