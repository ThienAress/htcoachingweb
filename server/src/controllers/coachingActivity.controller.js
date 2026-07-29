import AuditLog from "../models/AuditLog.js";
import { incrementMetric } from "../observability/metrics.js";
import { getCoachingActivity } from "../services/coachingActivity.service.js";
import { coachingActivityToCsv } from "../services/coachingActivityExport.service.js";
import { safeLog } from "../utils/safeLogger.js";

const sendError = (res, error) => {
  const status = error.statusCode || 500;
  if (status >= 500) safeLog.error("coaching_activity.read_failed", error);
  return res.status(status).json({
    success: false,
    code: error.codeName || error.code || "COACHING_ACTIVITY_FAILED",
    message:
      status >= 500
        ? "Không thể tải activity lúc này"
        : error.message,
  });
};

const load = (req) =>
  getCoachingActivity({
    clientId: req.user.id,
    days: req.query.days,
  });

const auditExport = (req, format, count) =>
  AuditLog.create({
    actorId: req.user.id,
    actorRole: req.user.role === "admin" ? "admin" : "user",
    action: "export_coaching_activity",
    targetType: "user",
    targetId: req.user.id,
    metadata: { format, count },
  });

export const listMyCoachingActivity = async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  try {
    const data = await load(req);
    incrementMetric("coaching_activity.requests");
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  }
};

export const exportMyCoachingActivity = async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  try {
    const format = req.query.format;
    const data = await load(req);
    await auditExport(req, format, data.items.length);
    incrementMetric("coaching_activity.exports");
    if (format === "csv") {
      res.type("text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=coaching-activity.csv",
      );
      return res.send(coachingActivityToCsv(data));
    }
    return res.json({
      success: true,
      data: { ...data, generatedAt: new Date().toISOString() },
    });
  } catch (error) {
    return sendError(res, error);
  }
};
