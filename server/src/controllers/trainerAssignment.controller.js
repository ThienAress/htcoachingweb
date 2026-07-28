import { listTrainerAssignmentCandidates } from "../services/trainerAssignment.service.js";
import { safeLog } from "../utils/safeLogger.js";

export const getTrainerAssignmentCandidates = async (req, res) => {
  try {
    const result = await listTrainerAssignmentCandidates(req.query);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    safeLog.error("admin.trainer_assignment_candidates_failed", error);
    return res.status(500).json({
      success: false,
      code: "TRAINER_ASSIGNMENT_CANDIDATES_FAILED",
      message: "Không thể tải danh sách huấn luyện viên",
    });
  }
};
