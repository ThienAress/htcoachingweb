import { incrementMetric } from "../observability/metrics.js";
import { getTrainerClientOverview } from "../services/trainerClientOverview.service.js";
import { safeLog } from "../utils/safeLogger.js";
import { getRequestActor } from "../utils/requestActor.js";

export const readTrainerClientOverview = async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  try {
    const data = await getTrainerClientOverview({
      actor: getRequestActor(req),
      clientId: req.params.clientId,
      dateKey: req.query.dateKey,
      days: req.query.days,
    });
    incrementMetric("trainer_overview.requests");
    return res.json({ success: true, data });
  } catch (error) {
    const status = error.statusCode || 500;
    incrementMetric("trainer_overview.errors");
    if (status >= 500) {
      safeLog.error("trainer_overview.read_failed", error);
    }
    return res.status(status).json({
      success: false,
      code: error.codeName || error.code || "TRAINER_OVERVIEW_FAILED",
      message:
        status >= 500
          ? "Không thể tải tổng quan khách hàng lúc này"
          : error.message,
    });
  }
};
