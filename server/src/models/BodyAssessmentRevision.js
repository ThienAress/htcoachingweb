import mongoose from "mongoose";
import { bodyAssessmentSnapshotSchema } from "./BodyAssessment.js";

const schema = new mongoose.Schema({
  assessmentId: { type: mongoose.Schema.Types.ObjectId, required: true },
  clientId: { type: mongoose.Schema.Types.ObjectId, required: true },
  revision: { type: Number, required: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, required: true },
  actorRole: { type: String, enum: ["trainer", "admin"], required: true },
  action: { type: String, enum: ["save", "publish"], required: true },
  reason: { type: String, maxlength: 1000, default: "" },
  snapshot: { type: bodyAssessmentSnapshotSchema, required: true },
  changedAt: { type: Date, default: Date.now },
}, { strict: "throw" });
schema.index(
  { assessmentId: 1, revision: 1 },
  { unique: true, name: "uniq_body_assessment_revision" },
);
schema.index(
  { clientId: 1, assessmentId: 1 },
  { name: "body_assessment_client_history" },
);
export default mongoose.model("BodyAssessmentRevision", schema);
