import { AI_CREDIT_COSTS } from "../constants/serviceAccessPolicies.js";
import { resolveRequestServicePolicy } from "../services/serviceAccessPolicy.service.js";
import { enforceSharedServiceUsage } from "./serviceUsageLedger.js";
import {
  consumeServiceUsage,
  refundServiceUsage,
  resolveServiceUsageActor,
} from "../services/serviceUsageLedger.service.js";
import { safeLog } from "../utils/safeLogger.js";

export const AI_CREDIT_SERVICE_KEY = "ai_credits";

/**
 * Số credit cần cho thao tác, tính từ request đã được server parse. Phụ phí Tìm kiếm thông minh
 * chỉ áp cho user đăng nhập vì guest không bao giờ được gọi web search.
 */
export const resolveAiCreditCharge = (operation, req) => {
  if (operation === "meal_scan") {
    return { base: AI_CREDIT_COSTS.meal_scan, surcharge: 0 };
  }
  const parsed = req.aiChatRequest?.value;
  return {
    base: parsed?.image ? AI_CREDIT_COSTS.chat_image : AI_CREDIT_COSTS.chat,
    surcharge:
      parsed?.webSearch === true && req.user?.id
        ? AI_CREDIT_COSTS.smart_search_surcharge
        : 0,
  };
};

const limitedResponse = (operation, { authenticated, smartSearch, required }) => {
  if (operation === "meal_scan") {
    return {
      code: "MEAL_SCAN_RATE_LIMITED",
      message: `Bạn không đủ credit AI cho Meal Scan (cần ${required} credit). Credit sẽ được làm mới theo chu kỳ.`,
    };
  }
  if (!authenticated) {
    return {
      code: "AI_GUEST_RATE_LIMITED",
      message: "Bạn đã dùng hết credit miễn phí hiện tại. Đăng nhập để có thêm credit.",
    };
  }
  if (smartSearch) {
    return {
      code: "AI_CREDITS_INSUFFICIENT_SMART_SEARCH",
      message: `Bạn không đủ credit cho Tìm kiếm thông minh (cần ${required} credit). Tắt Tìm kiếm thông minh để hỏi với ${AI_CREDIT_COSTS.chat} credit.`,
    };
  }
  return {
    code: "AI_RATE_LIMITED",
    message: "Bạn đã dùng hết credit AI hiện tại. Credit sẽ được làm mới theo chu kỳ.",
  };
};

/**
 * Cổng dùng thử Meal Scan: chỉ guest và user thường có hạn mức riêng (tính bằng credit, một lần).
 * Các nhóm còn lại không có cổng lượt, chỉ bị trừ credit trong pool chung.
 */
export const enforceMealScanTrial = async (req, res, next) => {
  try {
    const { policy } = await resolveRequestServicePolicy(req, "meal_scan");
    if (policy.mode !== "quota") return next();
  } catch (error) {
    safeLog.error("meal_scan.trial_policy_failed", error);
    return res.status(503).json({
      success: false,
      code: "SERVICE_USAGE_UNAVAILABLE",
      message: "Tạm thời chưa thể xác minh hạn mức sử dụng. Vui lòng thử lại sau.",
    });
  }
  return enforceSharedServiceUsage("meal_scan", {
    // Policy cũ theo lượt (snapshot) trừ 1; policy credit mới trừ đúng giá một lượt quét.
    resolveCost: (request) =>
      request.serviceAccessPolicy?.policy?.unitLabel === "credit"
        ? AI_CREDIT_COSTS.meal_scan
        : 1,
  })(req, res, next);
};

/**
 * Trừ credit trong pool chung. Chat: phần cơ bản theo requestId, phụ phí tìm kiếm theo
 * `${requestId}:web` để có thể hoàn riêng. Meal Scan của guest vẫn chỉ dùng hạn mức lượt cũ.
 */
export const enforceAiCredits = (operation) => async (req, res, next) => {
  const authenticated = Boolean(req.user?.id);
  if (operation === "meal_scan" && !authenticated) return next();

  const reservations = { base: null, surcharge: null };
  try {
    const { tier, policy } = await resolveRequestServicePolicy(req, AI_CREDIT_SERVICE_KEY);
    const actor = resolveServiceUsageActor(req);
    const charge = resolveAiCreditCharge(operation, req);
    const operationKey =
      operation === "meal_scan" ? undefined : req.aiChatRequest?.value?.requestId;
    const consume = (cost, suffix = "") =>
      consumeServiceUsage({
        serviceKey: AI_CREDIT_SERVICE_KEY,
        tier,
        policy,
        actor,
        operationKey: operationKey ? `${operationKey}${suffix}` : undefined,
        cost,
      });
    const refundReservation = async (key) => {
      const reservation = reservations[key];
      if (!reservation) return null;
      reservations[key] = null;
      try {
        return await refundServiceUsage({ reservation });
      } catch (error) {
        reservations[key] = reservation;
        throw error;
      }
    };
    const reject = async (quota, { smartSearch, required }) => {
      // Meal Scan đã giữ một lượt ở cổng hạn mức trước đó; trả lại vì lượt này không chạy.
      if (operation === "meal_scan" && req.refundServiceUsage) {
        await req.refundServiceUsage().catch((error) =>
          safeLog.error("ai_credits.meal_scan_refund_failed", error));
      }
      const limited = limitedResponse(operation, { authenticated, smartSearch, required });
      return res.status(429).json({
        success: false,
        code: limited.code,
        message: limited.message,
        meta: { quota, credits: quota },
      });
    };

    const base = await consume(charge.base);
    if (!base.allowed) {
      return reject(base.quota, { smartSearch: false, required: charge.base + charge.surcharge });
    }
    if (base.consumed) reservations.base = base.reservation;
    let quota = base.quota;

    if (charge.surcharge > 0) {
      const surcharge = await consume(charge.surcharge, ":web");
      if (!surcharge.allowed) {
        const refunded = await refundReservation("base");
        return reject(refunded || surcharge.quota, {
          smartSearch: true,
          required: charge.base + charge.surcharge,
        });
      }
      if (surcharge.consumed) reservations.surcharge = surcharge.reservation;
      quota = surcharge.quota;
    }

    const setQuota = (next) => {
      if (!next) return;
      req.aiCreditQuota = next;
      if (operation !== "meal_scan") req.serviceUsageQuota = next;
    };
    setQuota(quota);

    req.refundAiCreditSurcharge = async () => {
      setQuota(await refundReservation("surcharge"));
      return req.aiCreditQuota;
    };
    // Lưới an toàn: lượt kết thúc sớm (an toàn, trả lời cố định, lỗi) mà chưa từng được phép
    // tra web thì không giữ phụ phí tìm kiếm.
    res.once("close", () => {
      if (!reservations.surcharge || req.aiWebSearchAllowed) return;
      refundReservation("surcharge").catch((error) =>
        safeLog.error("ai_credits.surcharge_refund_failed", error));
    });
    const refundPrevious = req.refundServiceUsage;
    req.refundServiceUsage = async () => {
      setQuota(await refundReservation("surcharge"));
      setQuota(await refundReservation("base"));
      if (operation === "meal_scan" && refundPrevious) return refundPrevious();
      return req.serviceUsageQuota;
    };
  } catch (error) {
    safeLog.error("ai_credits.consume_failed", error, { operation });
    for (const key of ["surcharge", "base"]) {
      const reservation = reservations[key];
      if (reservation) await refundServiceUsage({ reservation }).catch(() => {});
    }
    if (operation === "meal_scan" && req.refundServiceUsage) {
      await req.refundServiceUsage().catch(() => {});
    }
    return res.status(503).json({
      success: false,
      code: "SERVICE_USAGE_UNAVAILABLE",
      message: "Tạm thời chưa thể xác minh hạn mức sử dụng. Vui lòng thử lại sau.",
    });
  }
  return next();
};
