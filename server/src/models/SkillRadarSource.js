import mongoose from "mongoose";

export const SKILL_RADAR_SOURCE_TYPES = ["skill", "repository"];
export const SKILL_RADAR_LIFECYCLES = [
  "candidate",
  "active",
  "watch",
  "dormant",
  "archived",
  "rejected",
];
export const SKILL_RADAR_DRIFTS = [
  "unknown",
  "clean",
  "changed",
  "review_due",
  "rate_limited",
  "unreachable",
  "audit_warning",
];

const skillRadarAuditSchema = new mongoose.Schema(
  {
    provider: { type: String, trim: true, maxlength: 80 },
    status: { type: String, trim: true, maxlength: 24 },
    riskLevel: { type: String, trim: true, maxlength: 24 },
    auditedAt: { type: Date, default: null },
  },
  { _id: false, strict: "throw" },
);

const skillRadarSourceSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true, lowercase: true, trim: true, maxlength: 200, match: /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, immutable: true },
    sourceType: { type: String, enum: SKILL_RADAR_SOURCE_TYPES, required: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    sourceRepo: { type: String, required: true, trim: true, maxlength: 200 },
    repoUrl: { type: String, required: true, trim: true, maxlength: 500 },
    skillsShUrl: { type: String, default: null, trim: true, maxlength: 500 },
    domain: { type: String, required: true, trim: true, maxlength: 120 },
    summary: { type: String, required: true, trim: true, maxlength: 500 },
    localTargets: { type: [{ type: String, trim: true, maxlength: 120 }], required: true, validate: [(values) => values.length > 0 && values.length <= 12, "Cần 1–12 local targets"] },
    trustTier: { type: String, enum: ["official", "expert", "community"], default: "community" },
    lifecycle: { type: String, enum: SKILL_RADAR_LIFECYCLES, default: "candidate" },
    reviewIntervalDays: { type: Number, min: 1, max: 365, default: 30 },
    license: { type: String, default: "UNKNOWN", trim: true, maxlength: 80 },
    drift: { type: String, enum: SKILL_RADAR_DRIFTS, default: "review_due" },
    lastUpstreamCommitAt: { type: Date, default: null },
    lastCheckedAt: { type: Date, default: null },
    lastReviewedAt: { type: Date, default: null },
    nextCheckAt: { type: Date, required: true },
    rateLimitRetryAt: { type: Date, default: null },
    repositoryArchived: { type: Boolean, default: false },
    upstreamCommit: { type: String, default: null, trim: true, maxlength: 40 },
    auditSummary: { type: [skillRadarAuditSchema], default: [] },
    decision: { type: String, enum: ["pending", "adopt", "adapt", "reject", "defer"], default: "pending" },
    decisionReason: { type: String, default: null, maxlength: 500 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    auditLogId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AuditLog",
      required: true,
      immutable: true,
    },
  },
  { timestamps: true, strict: "throw" },
);

skillRadarSourceSchema.index(
  { lifecycle: 1, nextCheckAt: 1 },
  { name: "skill_radar_refresh_due" },
);

export default mongoose.model("SkillRadarSource", skillRadarSourceSchema);
