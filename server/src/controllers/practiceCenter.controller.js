import {
  deliverPracticeCenterScenarioRequest,
  getPracticeCenterState,
} from "../services/practiceCenter.service.js";
import { serializeRequestQuota } from "../services/serviceAccessPolicy.service.js";
import { safeLog } from "../utils/safeLogger.js";

const actorFrom = (req) => ({ id: req.user.id, role: req.user.role });

export const getPracticeCenter = async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  try {
    const data = await getPracticeCenterState({ actor: actorFrom(req) });
    return res.json({ success: true, data });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) safeLog.error("practice_center.read_failed", error);
    return res.status(status).json({
      success: false,
      code: error.code || "PRACTICE_CENTER_READ_FAILED",
      message:
        status >= 500
          ? "Không thể tải Trung tâm thực hành"
          : error.message,
    });
  }
};

export const sendPracticeCenterSimulation = async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  try {
    const result = await deliverPracticeCenterScenarioRequest({
      actor: actorFrom(req),
      scenario: req.practiceCenterRequest.scenario,
      requestId: req.practiceCenterRequest.requestId,
    });
    return res.json({
      success: true,
      data: {
        ...result,
        quota: result.quota,
      },
    });
  } catch (error) {
    const quota = error.quota || serializeRequestQuota(req, "practice_email");
    const status = error.statusCode || 502;
    const logContext = { scenario: req.practiceCenterRequest?.scenario };
    if (status >= 500) {
      safeLog.error("practice_center.delivery_failed", error, logContext);
    } else {
      safeLog.warn(
        "practice_center.delivery_rejected",
        "Practice Center delivery rejected",
        { ...logContext, code: error.code },
      );
    }
    const hasDeliveryState = Boolean(
      error.sent || error.pending || error.unknown,
    );
    return res.status(error.statusCode || 502).json({
      success: false,
      code: error.code || "PRACTICE_EMAIL_DELIVERY_FAILED",
      message: error.message || "Chưa thể gửi email mô phỏng.",
      ...(hasDeliveryState
        ? {
            data: {
              sent: error.sent || [],
              pending: error.pending || [],
              unknown: error.unknown || [],
            },
          }
        : {}),
      ...(hasDeliveryState
        ? {
            requestId: req.practiceCenterRequest?.requestId,
            scenario: req.practiceCenterRequest?.scenario,
          }
        : {}),
      ...(quota ? { meta: { quota } } : {}),
    });
  }
};
