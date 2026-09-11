import mongoose from "mongoose";

const numberField = () => ({ type: Number, min: 0, default: null, validate: { validator: (value) => value === null || Number.isFinite(value) } });
const segmentSchema = new mongoose.Schema({
  leanKg: numberField(), leanReferencePercent: numberField(),
  fatKg: numberField(), fatReferencePercent: numberField(),
}, { _id: false, strict: "throw" });
const segmentsSchema = new mongoose.Schema(Object.fromEntries(
  ["leftArm", "rightArm", "trunk", "leftLeg", "rightLeg"].map((key) => [key, { type: segmentSchema, default: () => ({}) }]),
), { _id: false, strict: "throw" });
export const bodyAssessmentSnapshotSchema = new mongoose.Schema({
  measuredDateKey: { type: String, default: "" },
  deviceLabel: { type: String, maxlength: 120, default: "" },
  referenceBasis: { type: String, maxlength: 120, default: "unspecified" },
  note: { type: String, maxlength: 2000, default: "" },
  segments: { type: segmentsSchema, default: () => ({}) },
  publishedAt: { type: Date, default: null },
}, { _id: false, strict: "throw" });
const schema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  weekStartDateKey: { type: String, required: true },
  revision: { type: Number, min: 1, required: true },
  draft: { type: bodyAssessmentSnapshotSchema, default: null },
  published: { type: bodyAssessmentSnapshotSchema, default: null },
  draftReason: { type: String, maxlength: 1000, default: "", select: false },
  retentionExpiresAt: { type: Date, default: null },
}, { timestamps: true, strict: "throw" });
schema.index({ clientId: 1, weekStartDateKey: 1 }, { unique: true, name: "uniq_body_assessment_period" });
schema.index(
  { clientId: 1, "published.measuredDateKey": -1, _id: -1 },
  { name: "body_assessment_published_history" },
);
schema.index(
  { retentionExpiresAt: 1 },
  { name: "body_assessment_retention_candidates" },
);
export default mongoose.model("BodyAssessment", schema);
