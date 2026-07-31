import {
  getClientWellnessTargetForDate,
  getCoachClientWellnessTarget,
  setClientWellnessTarget,
} from "../services/wellnessTarget.service.js";
import {
  deleteWellnessTargetData,
  exportWellnessTargetData,
} from "../services/wellnessTargetPrivacy.service.js";
import { safeLog } from "../utils/safeLogger.js";

const actor = (req) => ({
  id: req.user.id,
  role: req.user.role,
  isAdmin: Boolean(req.isAdmin || req.user.role === "admin"),
});
const privateResponse = (res) =>
  res.setHeader("Cache-Control", "private, no-store");

const sendError = (res, error, event) => {
  const status = error.statusCode || 500;
  if (status >= 500) safeLog.error(event, error);
  return res.status(status).json({
    success: false,
    code: error.codeName || error.code || "WELLNESS_TARGET_FAILED",
    message:
      status >= 500
        ? "Không thể xử lý mục tiêu sức khỏe lúc này"
        : error.message,
  });
};

export const readMyWellnessTarget = async (req, res) => {
  privateResponse(res);
  try {
    const data = await getClientWellnessTargetForDate({
      clientId: req.user.id,
      dateKey: req.query.dateKey,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error, "wellness_target.read_own_failed");
  }
};

export const readCoachClientWellnessTarget = async (req, res) => {
  privateResponse(res);
  try {
    const data = await getCoachClientWellnessTarget({
      actor: actor(req),
      clientId: req.params.clientId,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error, "wellness_target.read_client_failed");
  }
};

export const updateCoachClientWellnessTarget = async (req, res) => {
  privateResponse(res);
  try {
    const result = await setClientWellnessTarget({
      actor: actor(req),
      clientId: req.params.clientId,
      input: req.body,
    });
    const created = !result.idempotentReplay && result.data.version === 1;
    return res
      .status(created ? 201 : 200)
      .json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "wellness_target.write_failed");
  }
};

export const exportMyWellnessTargets = async (req, res) => {
  privateResponse(res);
  try {
    const data = await exportWellnessTargetData({
      clientId: req.user.id,
      page: Number(req.query.page || 1),
      limit: Number(req.query.limit || 50),
    });
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error, "wellness_target.export_failed");
  }
};

export const deleteMyWellnessTargets = async (req, res) => {
  privateResponse(res);
  try {
    const data = await deleteWellnessTargetData({ actor: actor(req) });
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error, "wellness_target.delete_failed");
  }
};
