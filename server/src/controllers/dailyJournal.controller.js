import AuditLog from "../models/AuditLog.js";
import {
  correctDailyJournal,
  saveDailyJournal,
  submitDailyJournal,
  submitDailyJournalNutrition,
} from "../services/dailyJournal.service.js";
import {
  getMyDailyJournal,
  getTrainerDailyJournal,
  listDailyJournalRevisions,
} from "../services/dailyJournalRead.service.js";
import {
  deleteDailyJournalData,
  exportDailyJournalData,
} from "../services/dailyJournalPrivacy.service.js";
import {
  getDailyJournalTimeline,
} from "../services/dailyJournalTimeline.service.js";
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
    code: error.codeName || error.code || "DAILY_JOURNAL_FAILED",
    message:
      status >= 500
        ? "Không thể xử lý nhật ký lúc này"
        : error.message,
  });
};

export const getMyJournal = async (req, res) => {
  privateResponse(res);
  try {
    const data = await getMyDailyJournal({
      clientId: req.user.id,
      dateKey: req.params.dateKey,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error, "daily_journal.read_failed");
  }
};

const mutate = (service, event) => async (req, res) => {
  privateResponse(res);
  try {
    const result = await service({
      actor: actor(req),
      dateKey: req.params.dateKey,
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

export const saveMyJournal = mutate(
  saveDailyJournal,
  "daily_journal.save_failed",
);
export const submitMyJournal = mutate(
  submitDailyJournal,
  "daily_journal.submit_failed",
);
export const correctMyJournal = mutate(
  correctDailyJournal,
  "daily_journal.correction_failed",
);
export const submitMyJournalNutrition = mutate(
  submitDailyJournalNutrition,
  "daily_journal.nutrition_submit_failed",
);

export const getMyJournalRevisions = async (req, res) => {
  privateResponse(res);
  try {
    const data = await listDailyJournalRevisions({
      clientId: req.user.id,
      dateKey: req.params.dateKey,
      ...pagination(req),
    });
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error, "daily_journal.revisions_failed");
  }
};

export const getMyJournalTimeline = async (req, res) => {
  privateResponse(res);
  try {
    const data = await getDailyJournalTimeline({
      clientId: req.user.id,
      dateKey: req.params.dateKey,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error, "daily_journal.timeline_failed");
  }
};

export const getTrainerClientJournal = async (req, res) => {
  privateResponse(res);
  try {
    const data = await getTrainerDailyJournal({
      actor: actor(req),
      clientId: req.params.clientId,
      dateKey: req.params.dateKey,
    });
    if (req.user.role === "admin" && data) {
      await AuditLog.create({
        actorId: req.user.id,
        actorRole: "admin",
        action: "read_daily_journal",
        targetType: "daily_journal",
        targetId: data._id,
        metadata: {},
      });
    }
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error, "daily_journal.trainer_read_failed");
  }
};

export const exportMyJournalData = async (req, res) => {
  privateResponse(res);
  try {
    const data = await exportDailyJournalData({
      clientId: req.user.id,
      ...pagination(req, 50),
    });
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error, "daily_journal.export_failed");
  }
};

export const deleteMyJournalData = async (req, res) => {
  privateResponse(res);
  try {
    const data = await deleteDailyJournalData({ actor: actor(req) });
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error, "daily_journal.delete_failed");
  }
};
