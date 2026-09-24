import { getRequestActor } from "../utils/requestActor.js";
import { safeLog } from "../utils/safeLogger.js";
import { saveBodyAssessment, publishBodyAssessment } from "../services/bodyAssessment.service.js";
import { getTrainerBodyAssessment, listBodyAssessments } from "../services/bodyAssessmentRead.service.js";
import { exportBodyAssessmentData, deleteBodyAssessmentData } from "../services/bodyAssessmentPrivacy.service.js";

const handle = (service, options = {}) => async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  try {
    const data = await service({ actor: getRequestActor(req), clientId: req.params.clientId ?? req.user.id,
      weekStartDateKey: req.params.weekStartDateKey, body: req.body, query: req.query, ...options });
    return res.json({ success: true, data });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) safeLog.warn("body_assessment.request_failed", { status });
    return res.status(status).json({ success: false, code: error.codeName || (status === 400 ? "BODY_ASSESSMENT_INVALID" : "BODY_ASSESSMENT_FAILED"), message: status >= 500 ? "Không thể xử lý kết quả đo lúc này" : error.message });
  }
};
export const saveTrainerBodyAssessment = handle(saveBodyAssessment);
export const publishTrainerBodyAssessment = handle(publishBodyAssessment);
export const readTrainerBodyAssessment = handle(getTrainerBodyAssessment);
export const listTrainerBodyAssessments = handle(listBodyAssessments, { trainer: true });
export const listMyBodyAssessments = handle(listBodyAssessments);
export const exportMyBodyAssessments = handle(exportBodyAssessmentData);
export const deleteMyBodyAssessments = handle(deleteBodyAssessmentData);
