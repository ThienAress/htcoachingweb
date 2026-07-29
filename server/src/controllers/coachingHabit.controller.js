import {
  changeCoachingHabitStatus,
  createCoachingHabit,
} from "../services/coachingHabit.service.js";
import {
  deleteCoachingHabitData,
  exportCoachingHabitData,
} from "../services/coachingHabitPrivacy.service.js";
import {
  listMyCoachingHabits,
  listTrainerClientHabits,
} from "../services/coachingHabitRead.service.js";
import { safeLog } from "../utils/safeLogger.js";
import { getRequestActor } from "../utils/requestActor.js";

const actor = getRequestActor;
const privateResponse = (res) => res.setHeader("Cache-Control", "private, no-store");
const sendError = (res, error, event) => {
  const status = error.statusCode || 500;
  if (status >= 500) safeLog.error(event, error);
  return res.status(status).json({
    success: false,
    code: error.codeName || error.code || "COACHING_HABIT_FAILED",
    message: status >= 500 ? "Không thể xử lý Coaching Habit lúc này" : error.message,
  });
};

const create = (source) => async (req, res) => {
  privateResponse(res);
  try {
    const result = await createCoachingHabit({
      actor: actor(req),
      clientId: source === "trainer" ? req.params.clientId : req.user.id,
      input: req.body,
    });
    return res
      .status(result.idempotentReplay ? 200 : 201)
      .json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "coaching_habit.create_failed");
  }
};

export const createMyHabit = create("user");
export const createTrainerClientHabit = create("trainer");

export const changeMyHabitStatus = async (req, res) => {
  privateResponse(res);
  try {
    const result = await changeCoachingHabitStatus({
      actor: actor(req),
      habitId: req.params.id,
      input: req.body,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "coaching_habit.status_failed");
  }
};

export const listMyHabits = async (req, res) => {
  privateResponse(res);
  try {
    const data = await listMyCoachingHabits({
      clientId: req.user.id,
      dateKey: req.query.dateKey,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error, "coaching_habit.list_failed");
  }
};

export const listTrainerHabits = async (req, res) => {
  privateResponse(res);
  try {
    const data = await listTrainerClientHabits({
      trainerId: req.user.id,
      clientId: req.params.clientId,
      dateKey: req.query.dateKey,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error, "coaching_habit.trainer_list_failed");
  }
};

export const exportMyHabits = async (req, res) => {
  privateResponse(res);
  try {
    const data = await exportCoachingHabitData({
      clientId: req.user.id,
      page: Number(req.query.page || 1),
      limit: Number(req.query.limit || 50),
    });
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error, "coaching_habit.export_failed");
  }
};

export const deleteMyHabits = async (req, res) => {
  privateResponse(res);
  try {
    const data = await deleteCoachingHabitData({ actor: actor(req) });
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error, "coaching_habit.delete_failed");
  }
};
