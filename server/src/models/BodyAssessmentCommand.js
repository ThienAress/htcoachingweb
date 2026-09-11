import mongoose from "mongoose";

const schema = new mongoose.Schema({
  assessmentId: { type: mongoose.Schema.Types.ObjectId, required: true },
  clientId: { type: mongoose.Schema.Types.ObjectId, required: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, required: true },
  action: { type: String, enum: ["save", "publish"], required: true },
  requestId: { type: String, maxlength: 100, required: true, select: false },
  fingerprint: { type: String, required: true, select: false },
  revision: { type: Number, required: true },
  notificationStatus: { type: String, enum: ["not_applicable", "created", "suppressed"], default: "not_applicable" },
}, { timestamps: true, strict: "throw" });
schema.index({ actorId: 1, action: 1, requestId: 1 }, { unique: true, name: "uniq_body_assessment_command" });
schema.index(
  { clientId: 1, assessmentId: 1 },
  { name: "body_assessment_client_receipts" },
);
export default mongoose.model("BodyAssessmentCommand", schema);
