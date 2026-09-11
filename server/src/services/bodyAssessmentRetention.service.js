import BodyAssessment from "../models/BodyAssessment.js";
import { excludeActiveCoachingClients } from "./todayRetentionGuard.service.js";
import { assertBodyAssessmentTarget } from "./bodyAssessmentValidation.service.js";

// No TTL or scheduled sweep: reuse the caller's approved coaching-lifecycle date.
export const setBodyAssessmentRetentionDeadline = async ({ clientId, retentionExpiresAt, session }) => {
  assertBodyAssessmentTarget(clientId);
  if (!session?.inTransaction()) throw new Error("Body assessment retention requires a transaction");
  if (retentionExpiresAt !== null && (!(retentionExpiresAt instanceof Date) || !Number.isFinite(retentionExpiresAt.getTime()))) throw new Error("Invalid retention deadline");
  return BodyAssessment.updateMany({ clientId }, { $set: { retentionExpiresAt } }, { session });
};
export const findBodyAssessmentRetentionCandidates = async ({ now = new Date(), session = null } = {}) => {
  const candidates = await BodyAssessment.find({ retentionExpiresAt: { $ne: null, $lte: now } })
    .select("_id clientId").sort({ retentionExpiresAt: 1 }).limit(100).session(session).lean();
  return excludeActiveCoachingClients(candidates, { session });
};
