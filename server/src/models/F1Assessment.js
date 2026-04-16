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
f1AssessmentSchema.index({ intakeId: 1 });
f1AssessmentSchema.index({ overallPhysicalLevel: 1 });

export default mongoose.model("F1Assessment", f1AssessmentSchema);
