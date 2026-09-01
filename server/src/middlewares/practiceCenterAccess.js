import { SERVICE_ACCESS_TIERS } from "../constants/serviceAccessPolicies.js";
import { resolveRequestServicePolicy } from "../services/serviceAccessPolicy.service.js";
import { safeLog } from "../utils/safeLogger.js";

const ALLOWED_TIERS = new Set([
  SERVICE_ACCESS_TIERS.TRAINER,
  SERVICE_ACCESS_TIERS.ADMIN,
]);

export const requirePracticeCenterAccess = async (req, res, next) => {
  try {
    const { tier } = await resolveRequestServicePolicy(req, "practice_email");
    if (!ALLOWED_TIERS.has(tier)) {
      return res.status(403).json({
        success: false,
        code: "PRACTICE_CENTER_ACCESS_DENIED",
        message: "Bạn cần gói huấn luyện viên đang hoạt động để sử dụng tính năng này.",
      });
    }
    return next();
  } catch (error) {
    safeLog.error("practice_center.access_check_failed", error);
    return res.status(503).json({
      success: false,
      code: "PRACTICE_CENTER_ACCESS_UNAVAILABLE",
      message: "Tạm thời chưa thể xác minh quyền truy cập. Vui lòng thử lại sau.",
    });
  }
};
