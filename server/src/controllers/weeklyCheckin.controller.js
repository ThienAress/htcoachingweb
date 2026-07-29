import {
  correctWeeklyCheckin,
  saveWeeklyCheckin,
  submitWeeklyCheckin,
} from "../services/weeklyCheckin.service.js";
import { reviewWeeklyCheckin } from "../services/weeklyCheckinReview.service.js";
import {
  getMyWeeklyCheckin,
  getTrainerWeeklyCheckin,
  listWeeklyCheckinRevisions,
} from "../services/weeklyCheckinRead.service.js";
import {
  deleteWeeklyCheckinData,
  exportWeeklyCheckinData,
} from "../services/weeklyCheckinPrivacy.service.js";
import { safeLog } from "../utils/safeLogger.js";
import { getRequestActor } from "../utils/requestActor.js";

const actor = getRequestActor;
const privateResponse = (res) =>
  res.setHeader("Cache-Control", "private, no-store");
const pagination = (req, fallback = 20) => ({
  page: Number(req.query.page || 1),
  limit: Number(req.query.limit || fallback),
});
const sendError = (res, error, event) => {
  const status = error.statusCode || 500;
  if (status >= 500) safeLog.error(event, error);
  return res.status(status).json({
    success: false,
    code: error.codeName || error.code || "WEEKLY_CHECKIN_FAILED",
    message:
      status >= 500
        ? "Không thể xử lý Weekly Check-in lúc này"
        : error.message,
  });
};

const mutate = (service, event) => async (req, res) => {
  privateResponse(res);
  try {
    const result = await service({
      actor: actor(req),
      weekStartDateKey: req.params.weekStartDateKey,
      expectedRevision: req.body.expectedRevision,
      requestId: req.body.requestId,
      patch: req.body.patch,
      reason: req.body.reason,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, event);
  }
};

export const saveMyWeeklyCheckin = mutate(
  saveWeeklyCheckin,
  "weekly_checkin.save_failed",
);
export const submitMyWeeklyCheckin = mutate(
  submitWeeklyCheckin,
  "weekly_checkin.submit_failed",
);
export const correctMyWeeklyCheckin = mutate(
  correctWeeklyCheckin,
  "weekly_checkin.correction_failed",
);

export const getMyCheckin = async (req, res) => {
  privateResponse(res);
  try {
    const data = await getMyWeeklyCheckin({
      clientId: req.user.id,
      weekStartDateKey: req.params.weekStartDateKey,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error, "weekly_checkin.read_failed");
  }
};

export const getMyCheckinRevisions = async (req, res) => {
  privateResponse(res);
  try {
    const data = await listWeeklyCheckinRevisions({
      clientId: req.user.id,
      weekStartDateKey: req.params.weekStartDateKey,
      ...pagination(req),
    });
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error, "weekly_checkin.revisions_failed");
  }
};

export const getTrainerClientCheckin = async (req, res) => {
  privateResponse(res);
  try {
    const data = await getTrainerWeeklyCheckin({
      actor: actor(req),
      clientId: req.params.clientId,
      weekStartDateKey: req.params.weekStartDateKey,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error, "weekly_checkin.trainer_read_failed");
  }
};

export const reviewTrainerClientCheckin = async (req, res) => {
  privateResponse(res);
  try {
    const result = await reviewWeeklyCheckin({
      actor: actor(req),
      clientId: req.params.clientId,
      weekStartDateKey: req.params.weekStartDateKey,
      expectedRevision: req.body.expectedRevision,
      requestId: req.body.requestId,
      review: req.body.review,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "weekly_checkin.review_failed");
  }
};

export const exportMyWeeklyCheckins = async (req, res) => {
  privateResponse(res);
  try {
    const data = await exportWeeklyCheckinData({
      clientId: req.user.id,
      ...pagination(req, 50),
    });
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error, "weekly_checkin.export_failed");
  }
};

export const deleteMyWeeklyCheckins = async (req, res) => {
  privateResponse(res);
  try {
    const data = await deleteWeeklyCheckinData({ actor: actor(req) });
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error, "weekly_checkin.delete_failed");
  }
};
