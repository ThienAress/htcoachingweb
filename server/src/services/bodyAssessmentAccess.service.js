import { assessmentError, assertBodyAssessmentTarget } from "./bodyAssessmentValidation.service.js";
import { assertEffectiveCoachAccess } from "./effectiveCoach.service.js";

export const assertBodyAssessmentWritesEnabled = () => {
  if (process.env.BODY_ASSESSMENT_WRITES_ENABLED !== "true") {
    throw assessmentError(
      503,
      "Tính năng lưu kết quả đo đang được chuẩn bị",
      "BODY_ASSESSMENT_WRITES_DISABLED",
    );
  }
};

export const assertBodyAssessmentTrainer = async ({ actor, clientId, session = null }) => {
  assertBodyAssessmentTarget(clientId);
  if (!["trainer", "admin"].includes(actor?.role)) throw assessmentError(403, "Cần quyền huấn luyện viên", "BODY_ASSESSMENT_FORBIDDEN");
  try {
    const { order } = await assertEffectiveCoachAccess({ actor, clientId, session });
    return { _id: order._id };
  } catch (error) {
    if (error.statusCode !== 403) throw error;
    throw assessmentError(403, "Khách hàng không thuộc phạm vi quản lý hiện tại", "BODY_ASSESSMENT_FORBIDDEN");
  }
};
