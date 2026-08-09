import { getAdminServiceAccessPolicyMatrix } from "../services/serviceAccessPolicy.service.js";
import { safeLog } from "../utils/safeLogger.js";

export const getServiceAccessPolicies = (_req, res) => {
  try {
    return res.status(200).json({
      success: true,
      data: getAdminServiceAccessPolicyMatrix(),
    });
  } catch (error) {
    safeLog.error("service_access_policy.read_failed", error);
    return res.status(500).json({
      success: false,
      code: "SERVICE_ACCESS_POLICY_READ_FAILED",
      message: "Không thể tải quyền và hạn mức dịch vụ",
    });
  }
};
