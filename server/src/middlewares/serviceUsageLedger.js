import { safeLog } from "../utils/safeLogger.js";
import { resolveRequestServicePolicy } from "../services/serviceAccessPolicy.service.js";
import {
  consumeServiceUsage,
  refundServiceUsage,
  resolveServiceUsageActor,
} from "../services/serviceUsageLedger.service.js";

const limitedResponse = (serviceKey, { authenticated, tier }) => {
  if (serviceKey === "practice_email") {
    return {
      code: "PRACTICE_EMAIL_QUOTA_EXCEEDED",
      message: "Bạn đã dùng hết lượt mô phỏng trong 24 giờ. Vui lòng thử lại sau.",
    };
  }
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
  if (authenticated && tier === "user") {
    return {
      code: "MEAL_SCAN_RATE_LIMITED",
      message:
        "Bạn đã dùng hết lượt Meal Scan dùng thử của tài khoản. Hãy chọn gói phù hợp để tiếp tục.",
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

export const enforceSharedServiceUsage = (serviceKey, options = {}) => async (req, res, next) => {
  try {
    const { tier, policy } = await resolveRequestServicePolicy(req, serviceKey);
    const operationKey =
      typeof options.resolveOperationKey === "function"
        ? options.resolveOperationKey(req)
        : serviceKey === "ai_chat"
        ? req.aiChatRequest?.value?.requestId || req.body?.requestId
        : undefined;
    const cost =
      typeof options.resolveCost === "function" ? options.resolveCost(req) : 1;
    const usage = await consumeServiceUsage({
      serviceKey,
      tier,
      policy,
      actor: resolveServiceUsageActor(req),
      operationKey,
      cost,
    });
    req.serviceUsageQuota = usage.quota;
    if (usage.allowed) {
      if (options.rejectReplay && !usage.consumed) {
        return res.status(409).json({
          success: false,
          code: "SERVICE_USAGE_REQUEST_REPLAYED",
          message: "Yêu cầu này đã được xử lý. Vui lòng tạo yêu cầu mới.",
          meta: { quota: usage.quota },
        });
      }
      let reservation = usage.consumed ? usage.reservation : null;
      req.refundServiceUsage = async () => {
        if (!reservation) return req.serviceUsageQuota;
        const currentReservation = reservation;
        reservation = null;
        try {
          const quota = await refundServiceUsage({
            reservation: currentReservation,
          });
          req.serviceUsageQuota = quota;
          return quota;
        } catch (error) {
          reservation = currentReservation;
          throw error;
        }
      };
      return next();
    }

    const limited = limitedResponse(serviceKey, {
      authenticated: Boolean(req.user?.id),
      tier,
    });
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
