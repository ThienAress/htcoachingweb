import TrainingSchedule from "../models/TrainingSchedule.js";
import User from "../models/User.js";
import {
  cancelTrainingOccurrence,
  createTrainingOccurrence,
  resolveClientTrainer,
  rescheduleTrainingOccurrence,
} from "../services/trainingScheduleCommand.service.js";
import {
  getAppDayOfWeek,
  getNextOccurrenceDateKey,
  getVietnamDateKey,
} from "../services/trainingOccurrence.service.js";
import { safeLog } from "../utils/safeLogger.js";

const actorFromRequest = (req) => ({
  id: req.user.id,
  role: req.user.role,
});

const requestContext = (req) => ({
  ipAddress: req.ip,
  userAgent: req.get("user-agent"),
});

const sendError = (res, error, event) => {
  safeLog.error(event, error);
  return res.status(error.statusCode || 500).json({
    success: false,
    code: error.codeName,
    message:
      error.statusCode
        ? error.message
        : "Lỗi hệ thống khi xử lý lịch đăng ký",
  });
};

export const getMyBookings = async (req, res) => {
  try {
    const now = new Date();
    const schedules = await TrainingSchedule.find({
      clientId: req.user.id,
      status: "scheduled",
      isActive: true,
      $or: [
        { startAt: { $gt: now } },
        { startAt: { $exists: false }, expiresAt: { $gt: now } },
      ],
    })
      .populate("trainerId", "name role")
      .sort({ startAt: 1, dayOfWeek: 1, startTime: 1 })
      .lean();
    return res.status(200).json({ success: true, data: schedules });
  } catch (error) {
    return sendError(res, error, "training_booking.list_failed");
  }
};

export const getMyTrainer = async (req, res) => {
  try {
    const { trainerId } = await resolveClientTrainer({
      clientId: req.user.id,
    });
    const trainer = await User.findById(trainerId)
      .select("_id name role")
      .lean();
    if (!trainer) {
      return res.status(200).json({ success: true, data: null });
    }
    return res.status(200).json({
      success: true,
      data: {
        _id: trainer._id,
        name: trainer.role === "admin" ? "Hoàng Thiện" : trainer.name,
      },
    });
  } catch (error) {
    if (error.codeName === "NO_ACTIVE_ORDER") {
      return res.status(200).json({ success: true, data: null });
    }
    return sendError(res, error, "training_booking.trainer_failed");
  }
};

export const getBusyTimes = async (req, res) => {
  try {
    const { trainerId } = await resolveClientTrainer({
      clientId: req.user.id,
    });
    if (
      req.query.trainerId &&
      String(req.query.trainerId) !== String(trainerId)
    ) {
      const error = new Error(
        "Bạn không có quyền xem lịch của huấn luyện viên này",
      );
      error.statusCode = 403;
      error.codeName = "TRAINER_SCHEDULE_FORBIDDEN";
      throw error;
    }
    const occurrenceDateKey = req.query.occurrenceDateKey
      ? String(req.query.occurrenceDateKey)
      : getNextOccurrenceDateKey(Number(req.query.dayOfWeek));
    getAppDayOfWeek(occurrenceDateKey);
    if (occurrenceDateKey < getVietnamDateKey()) {
      const error = new Error("Không thể xem khung giờ của ngày đã qua");
      error.statusCode = 400;
      throw error;
    }
    const busySchedules = await TrainingSchedule.find({
      trainerId,
      occurrenceDateKey,
      status: "scheduled",
      isActive: true,
    })
      .select("startTime endTime startAt endAt occurrenceDateKey")
      .sort({ startAt: 1 })
      .lean();
    return res.status(200).json({ success: true, data: busySchedules });
  } catch (error) {
    return sendError(res, error, "training_booking.busy_times_failed");
  }
};

export const createBooking = async (req, res) => {
  try {
    const result = await createTrainingOccurrence({
      actor: actorFromRequest(req),
      source: "client",
      input: req.body || {},
      requestContext: requestContext(req),
    });
    return res.status(result.idempotentReplay ? 200 : 201).json({
      success: true,
      data: result.schedule,
      idempotentReplay: result.idempotentReplay,
      message: result.idempotentReplay
        ? "Yêu cầu này đã được xử lý trước đó"
        : "Đã đăng ký lịch tập thành công",
    });
  } catch (error) {
    return sendError(res, error, "training_booking.create_failed");
  }
};

export const updateBooking = async (req, res) => {
  try {
    const result = await rescheduleTrainingOccurrence({
      actor: actorFromRequest(req),
      source: "client",
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
        : "Đã cập nhật lịch tập thành công",
    });
  } catch (error) {
    return sendError(res, error, "training_booking.update_failed");
  }
};

export const cancelBooking = async (req, res) => {
  try {
    const result = await cancelTrainingOccurrence({
      actor: actorFromRequest(req),
      source: "client",
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
    return sendError(res, error, "training_booking.cancel_failed");
  }
};
