import { incrementMetric } from "../observability/metrics.js";
import {
  getClientProgress,
  getTrainerClientProgress,
} from "../services/progress.service.js";
import AuditLog from "../models/AuditLog.js";
import { safeLog } from "../utils/safeLogger.js";
import { getRequestActor } from "../utils/requestActor.js";

const privateResponse = (res) =>
  res.setHeader("Cache-Control", "private, no-store");
const actor = getRequestActor;

const sendError = (res, error) => {
  incrementMetric("progress.errors");
  const status = error.statusCode || 500;
  if (status >= 500) safeLog.error("progress.read_failed", error);
  return res.status(status).json({
    success: false,
    code: error.codeName || error.code || "PROGRESS_READ_FAILED",
    message:
      status >= 500
        ? "Không thể tải tiến trình lúc này"
        : error.message,
  });
};

const read = (trainerView) => async (req, res) => {
  privateResponse(res);
  incrementMetric("progress.requests");
  try {
    const requestActor = actor(req);
    const data = trainerView
      ? await getTrainerClientProgress({
          actor: requestActor,
          clientId: req.params.clientId,
          days: req.query.days,
        })
      : await getClientProgress({
          clientId: req.user.id,
          days: req.query.days,
        });
    if (trainerView && requestActor.role === "admin") {
      await AuditLog.create({
        actorId: requestActor.id,
        actorRole: "admin",
        action: "read_client_progress",
        targetType: "user",
        targetId: req.params.clientId,
        metadata: {
          days: data.range.days,
          formulaVersion: data.formulaVersion,
          requestId: req.id || "",
        },
        ipAddress: req.ip || "",
        userAgent: req.get("user-agent") || "",
      });
    }
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  }
};

export const getMyProgress = read(false);
export const getTrainerProgress = read(true);
