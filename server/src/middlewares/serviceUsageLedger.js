import { safeLog } from "../utils/safeLogger.js";
import { resolveRequestServicePolicy } from "../services/serviceAccessPolicy.service.js";
import {
  consumeServiceUsage,
  resolveServiceUsageActor,
} from "../services/serviceUsageLedger.service.js";

const limitedResponse = (serviceKey, authenticated) => {
  if (serviceKey === "ai_chat") {
    return authenticated
      ? {
          code: "AI_RATE_LIMITED",
          message: "Bạn đã dùng hết hạn mức HT Assistant hiện tại. Vui lòng thử lại sau.",
        }
      : {
          code: "AI_GUEST_RATE_LIMITED",
          message: "Bạn đã dùng hết lượt hỏi miễn phí hiện tại. Đăng nhập để tiếp tục.",
        };
  }
  return authenticated
    ? {
        code: "MEAL_SCAN_RATE_LIMITED",
        message: "Bạn đã dùng hết hạn mức Meal Scan hiện tại. Vui lòng thử lại sau.",
      }
    : {
        code: "MEAL_SCAN_ANONYMOUS_LIMITED",
        message: "Bạn đã dùng hết lượt quét miễn phí hiện tại. Đăng nhập để tiếp tục.",
      };
};

export const enforceSharedServiceUsage = (serviceKey) => async (req, res, next) => {
  try {
    const { tier, policy } = await resolveRequestServicePolicy(req, serviceKey);
    const usage = await consumeServiceUsage({
      serviceKey,
      tier,
      policy,
      actor: resolveServiceUsageActor(req),
      operationKey:
        serviceKey === "ai_chat"
          ? req.aiChatRequest?.value?.requestId || req.body?.requestId
          : undefined,
    });
    req.serviceUsageQuota = usage.quota;
    if (usage.allowed) return next();

    const limited = limitedResponse(serviceKey, Boolean(req.user?.id));
    return res.status(429).json({
      success: false,
      code: limited.code,
      message: limited.message,
      meta: { quota: usage.quota },
    });
  } catch (error) {
    safeLog.error("service_usage.consume_failed", error, { serviceKey });
    return res.status(503).json({
      success: false,
      code: "SERVICE_USAGE_UNAVAILABLE",
      message: "Tạm thời chưa thể xác minh hạn mức sử dụng. Vui lòng thử lại sau.",
    });
  }
};
