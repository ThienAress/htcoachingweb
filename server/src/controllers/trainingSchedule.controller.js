import Order from "../models/Order.js";
import TrainingSchedule from "../models/TrainingSchedule.js";
import {
  cancelAllTrainerOccurrences,
  cancelTrainingOccurrence,
  completeTrainingOccurrence,
  createTrainingOccurrence,
  rescheduleTrainingOccurrence,
} from "../services/trainingScheduleCommand.service.js";
import { safeLog } from "../utils/safeLogger.js";

const FIXED_EXERCISE_TYPES = [
  "Boxing",
  "Gym",
  "Cardio",
  "Yoga",
  "Stretching",
];

const actorFromRequest = (req) => ({
  id: req.user.id,
  role: req.user.role,
});

const requestContext = (req) => ({
  ipAddress: req.ip,
  userAgent: req.get("user-agent"),
});

const sendCommandError = (res, error, event) => {
  safeLog.error(event, error);
  return res.status(error.statusCode || 500).json({
    success: false,
    code: error.codeName,
    message:
      error.statusCode
        ? error.message
        : "Lỗi hệ thống khi xử lý lịch tập",
  });
};

export const getMySchedules = async (req, res) => {
  try {
    const now = new Date();
    const schedules = await TrainingSchedule.find({
      trainerId: req.user.id,
      status: "scheduled",
      isActive: true,
      $or: [
        { startAt: { $gt: now } },
        { startAt: { $exists: false }, expiresAt: { $gt: now } },
      ],
    })
      .sort({ startAt: 1, dayOfWeek: 1, startTime: 1 })
      .populate("clientId", "name")
      .lean();

    return res.status(200).json({ success: true, data: schedules });
  } catch (error) {
    return sendCommandError(res, error, "schedule.list_failed");
  }
};

export const getMyClients = async (req, res) => {
  try {
    let orderQuery = {
      trainerId: req.user.id,
      status: "approved",
      sessions: { $gt: 0 },
    };
    if (req.user.role === "admin") {
      orderQuery = {
        status: "approved",
        sessions: { $gt: 0 },
        $or: [
          { trainerId: req.user.id },
          { trainerId: null },
          { trainerId: { $exists: false } },
        ],
      };
    }
    const orders = await Order.find(orderQuery)
      .populate("userId", "name email phone")
      .lean();
    const clientsById = new Map();
    for (const order of orders) {
      if (order.userId) {
        clientsById.set(String(order.userId._id), order.userId);
      }
    }
    return res.status(200).json({
      success: true,
      data: [...clientsById.values()],
    });
  } catch (error) {
    return sendCommandError(res, error, "schedule.clients_failed");
  }
};

export const createSchedule = async (req, res) => {
  try {
    const result = await createTrainingOccurrence({
      actor: actorFromRequest(req),
      source: "trainer",
      input: req.body || {},
      requestContext: requestContext(req),
    });
    return res.status(result.idempotentReplay ? 200 : 201).json({
      success: true,
      data: result.schedule,
      idempotentReplay: result.idempotentReplay,
      message: result.idempotentReplay
        ? "Yêu cầu này đã được xử lý trước đó"
        : "Đã tạo lịch tập thành công",
    });
  } catch (error) {
    return sendCommandError(res, error, "schedule.create_failed");
  }
};

export const updateSchedule = async (req, res) => {
  try {
    const result = await rescheduleTrainingOccurrence({
      actor: actorFromRequest(req),
      source: "trainer",
      scheduleId: req.params.id,
      input: req.body || {},
      requestContext: requestContext(req),
    });
    return res.status(200).json({
      success: true,
      data: result.schedule,
      idempotentReplay: result.idempotentReplay,
      message: result.idempotentReplay
        ? "Yêu cầu này đã được xử lý trước đó"
        : "Đã cập nhật lịch tập",
    });
  } catch (error) {
    return sendCommandError(res, error, "schedule.update_failed");
  }
};

export const deleteSchedule = async (req, res) => {
  try {
    const result = await cancelTrainingOccurrence({
      actor: actorFromRequest(req),
      source: "trainer",
      scheduleId: req.params.id,
      input: req.body || {},
      requestContext: requestContext(req),
    });
    return res.status(200).json({
      success: true,
      data: result.schedule,
      idempotentReplay: result.idempotentReplay,
      message: result.idempotentReplay
        ? "Yêu cầu này đã được xử lý trước đó"
        : "Đã hủy lịch tập",
    });
  } catch (error) {
    return sendCommandError(res, error, "schedule.cancel_failed");
  }
};

export const completeSchedule = async (req, res) => {
  try {
    const result = await completeTrainingOccurrence({
      actor: actorFromRequest(req),
      source: "trainer",
      scheduleId: req.params.id,
      input: req.body || {},
      requestContext: requestContext(req),
    });
    return res.status(200).json({
      success: true,
      data: result.schedule,
      idempotentReplay: result.idempotentReplay,
      message: result.idempotentReplay
        ? "Yêu cầu này đã được xử lý trước đó"
        : "Đã hoàn thành lịch tập",
    });
  } catch (error) {
    return sendCommandError(res, error, "schedule.complete_failed");
  }
};

export const clearAllSchedules = async (req, res) => {
  try {
    const result = await cancelAllTrainerOccurrences({
      actor: actorFromRequest(req),
      input: req.body || {},
      requestContext: requestContext(req),
    });
    return res.status(200).json({
      success: true,
      idempotentReplay: result.idempotentReplay,
      data: { cancelledCount: result.count },
      message: "Đã hủy " + result.count + " lịch tập",
    });
  } catch (error) {
    return sendCommandError(res, error, "schedule.cancel_all_failed");
  }
};

export const getExerciseTypes = (req, res) =>
  res.status(200).json({
    success: true,
    data: FIXED_EXERCISE_TYPES,
  });
