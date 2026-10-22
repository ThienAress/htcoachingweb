import {
  getLatestSelfAssessment,
  listSelfAssessmentHistory,
  saveSelfAssessmentDraft,
  submitSelfAssessment,
} from "../services/fitnessSelfAssessment.service.js";
import { sendApiError } from "../utils/sendApiError.js";

const actor = (req) => ({ id: req.user.id, role: req.user.role });

// Dữ liệu sức khỏe: không cho trình duyệt hoặc proxy lưu bản sao.
const privateResponse = (res) => res.setHeader("Cache-Control", "private, no-store");

export const readMySelfAssessment = async (req, res) => {
  privateResponse(res);
  try {
    const data = await getLatestSelfAssessment(actor(req));
    return res.json({ success: true, data });
  } catch (error) {
    return sendApiError(res, error, "fitness_self_assessment.read_failed");
  }
};

export const listMySelfAssessments = async (req, res) => {
  privateResponse(res);
  try {
    const data = await listSelfAssessmentHistory(actor(req), {
      page: req.query.page,
      limit: req.query.limit,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return sendApiError(res, error, "fitness_self_assessment.list_failed");
  }
};

export const saveMySelfAssessmentDraft = async (req, res) => {
  privateResponse(res);
  try {
    const data = await saveSelfAssessmentDraft(actor(req), req.body);
    return res.json({ success: true, data });
  } catch (error) {
    return sendApiError(res, error, "fitness_self_assessment.save_failed");
  }
};

export const submitMySelfAssessment = async (req, res) => {
  privateResponse(res);
  try {
    const data = await submitSelfAssessment(actor(req), req.params.id);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendApiError(res, error, "fitness_self_assessment.submit_failed");
  }
};
