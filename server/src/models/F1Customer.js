import mongoose from "mongoose";

const f1CustomerSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    age: {
      type: Number,
      required: true,
      min: 1,
      max: 100,
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
      required: true,
    },
    occupation: {
      type: String,
      default: "",
      trim: true,
    },
    phone: {
      type: String,
      default: "",
      trim: true,
    },
    email: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },
    assignedTrainerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    source: {
      type: String,
      enum: ["manual", "booking", "referral", "walkin"],
      default: "manual",
    },
    status: {
      type: String,
      enum: [
        "new",
        "intake_in_progress",
        "intake_completed",
        "assessment_completed",
        "ai_report_generated",
        "program_started",
        "archived",
      ],
      default: "new",
    },
    readinessStatus: {
      type: String,
      enum: ["pending", "ready", "caution", "hold"],
      default: "pending",
    },
    lastIntakeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "F1Intake",
      default: null,
    },
    lastAssessmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "F1Assessment",
      default: null,
    },
    lastAiReportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "F1AiReport",
      default: null,
    },
    notesInternal: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true },
);

f1CustomerSchema.index({ code: 1 }, { unique: true });
f1CustomerSchema.index({ phone: 1 });
f1CustomerSchema.index({ email: 1 });
f1CustomerSchema.index({ assignedTrainerId: 1, status: 1 });
f1CustomerSchema.index({ status: 1, createdAt: -1 });
f1CustomerSchema.index({ fullName: "text", phone: "text", email: "text" });

export default mongoose.model("F1Customer", f1CustomerSchema);
