import mongoose from "mongoose";
import AuditLog from "../models/AuditLog.js";
import BodyAssessment from "../models/BodyAssessment.js";
import BodyAssessmentRevision from "../models/BodyAssessmentRevision.js";
import BodyAssessmentCommand from "../models/BodyAssessmentCommand.js";
import InAppNotification from "../models/InAppNotification.js";
import { bodyAssessmentDto, bodyAssessmentSnapshotDto } from "./bodyAssessmentDto.service.js";
import { assertBodyAssessmentTarget, assertBodyAssessmentDelete, bodyAssessmentPagination } from "./bodyAssessmentValidation.service.js";

export const exportBodyAssessmentData = async ({ actor, query = {} }) => {
  const clientId = actor.id;
  assertBodyAssessmentTarget(clientId);
  const { page, limit } = bodyAssessmentPagination(query);
  const records = await BodyAssessment.find({ clientId }).sort({ weekStartDateKey: -1 }).skip((page - 1) * limit).limit(limit).lean();
  const ids = records.map((item) => item._id);
  const [revisions, receipts, total] = await Promise.all([
    BodyAssessmentRevision.find({ clientId, assessmentId: { $in: ids } }).sort({ revision: 1 }).lean(),
    BodyAssessmentCommand.find({ clientId, assessmentId: { $in: ids } }).select("assessmentId action revision notificationStatus createdAt").sort({ revision: 1 }).lean(),
    BodyAssessment.countDocuments({ clientId }),
  ]);
  return {
    assessments: records.map((record) => bodyAssessmentDto(record, { trainer: true })),
    revisions: revisions.map((item) => ({ assessmentId: String(item.assessmentId), revision: item.revision, action: item.action, reason: item.reason, snapshot: bodyAssessmentSnapshotDto(item.snapshot), changedAt: item.changedAt })),
    receipts: receipts.map((item) => ({ assessmentId: String(item.assessmentId), action: item.action, revision: item.revision, notificationStatus: item.notificationStatus, createdAt: item.createdAt })),
    pagination: { page, limit, total },
  };
};

// Internal lifecycle seam: caller supplies an already authorized client and transaction.
export const deleteBodyAssessmentCollections = async ({ clientId, session }) => {
  assertBodyAssessmentTarget(clientId);
  if (!session?.inTransaction()) throw new Error("Body assessment deletion requires a transaction");
  const counts = {};
  for (const [key, model, filter] of [
    ["bodyAssessmentRevisions", BodyAssessmentRevision, { clientId }],
    ["bodyAssessmentCommands", BodyAssessmentCommand, { clientId }],
    ["bodyAssessments", BodyAssessment, { clientId }],
    ["bodyAssessmentNotifications", InAppNotification, { clientId, targetType: "body_assessment" }],
  ]) counts[key] = (await model.deleteMany(filter).session(session)).deletedCount;
  return counts;
};
export const deleteBodyAssessmentData = async ({ actor, body }) => {
  assertBodyAssessmentDelete(body);
  const session = await mongoose.startSession();
  let counts;
  try {
    await session.withTransaction(async () => {
      counts = await deleteBodyAssessmentCollections({ clientId: actor.id, session });
      await AuditLog.create([{ actorId: actor.id, actorRole: actor.role, action: "delete_body_assessment_data", targetType: "user", targetId: actor.id, metadata: counts }], { session });
    });
  } finally { await session.endSession(); }
  return counts;
};
