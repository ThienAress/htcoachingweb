import { AI_CREDIT_COSTS } from "../constants/serviceAccessPolicies.js";
import { AI_CREDIT_SERVICE_KEY } from "../middlewares/aiCredits.js";
import { resolveRequestServicePolicy } from "../services/serviceAccessPolicy.service.js";
import {
  getServiceUsageQuota,
  resolveServiceUsageActor,
} from "../services/serviceUsageLedger.service.js";
import { safeLog } from "../utils/safeLogger.js";

// Số credit còn lại của actor hiện tại (user hoặc guest theo IP), chỉ đọc.
export const getMyAiCredits = async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  try {
    const { tier, policy } = await resolveRequestServicePolicy(req, AI_CREDIT_SERVICE_KEY);
    const quota = await getServiceUsageQuota({
      serviceKey: AI_CREDIT_SERVICE_KEY,
      tier,
      policy,
      actor: resolveServiceUsageActor(req),
    });
    return res.status(200).json({
      success: true,
      data: { quota, costs: AI_CREDIT_COSTS },
    });
  } catch (error) {
    safeLog.error("ai_credits.read_failed", error);
    return res.status(503).json({
      success: false,
      code: "SERVICE_USAGE_UNAVAILABLE",
      message: "Tạm thời chưa thể tải số credit AI.",
    });
  }
};
