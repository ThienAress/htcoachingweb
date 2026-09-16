import BodyAssessment from "../models/BodyAssessment.js";
import AuditLog from "../models/AuditLog.js";
import { assertBodyAssessmentTrainer } from "./bodyAssessmentAccess.service.js";
import { bodyAssessmentDto } from "./bodyAssessmentDto.service.js";
import { assertBodyAssessmentTarget, bodyAssessmentPagination } from "./bodyAssessmentValidation.service.js";

const auditRead = (actor, clientId) => AuditLog.create({ actorId: actor.id, actorRole: actor.role, action: "read_body_assessment", targetType: "user", targetId: clientId });
export const listBodyAssessments = async ({ actor, clientId = actor.id, trainer = false, query = {} }) => {
  assertBodyAssessmentTarget(clientId);
  if (trainer) {
    await assertBodyAssessmentTrainer({ actor, clientId });
    await auditRead(actor, clientId);
  } else if (String(clientId) !== String(actor.id)) {
    // Internal consumers cannot override the current student's scope.
    await assertBodyAssessmentTrainer({ actor, clientId });
    await auditRead(actor, clientId);
  }
  const { page, limit } = bodyAssessmentPagination(query);
  const filter = { clientId, published: { $ne: null } };
  const [items, total] = await Promise.all([
    BodyAssessment.find(filter).select("weekStartDateKey published").sort({ "published.measuredDateKey": -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    BodyAssessment.countDocuments(filter),
  ]);
  return { items: items.map((item) => bodyAssessmentDto(item)), pagination: { page, limit, total } };
};
export const getTrainerBodyAssessment = async ({ actor, clientId, weekStartDateKey }) => {
  assertBodyAssessmentTarget(clientId, weekStartDateKey);
  await assertBodyAssessmentTrainer({ actor, clientId });
  await auditRead(actor, clientId);
  const assessment = await BodyAssessment.findOne({ clientId, weekStartDateKey }).select("weekStartDateKey revision draft published").lean();
  return { assessment: bodyAssessmentDto(assessment, { trainer: true }) };
};
