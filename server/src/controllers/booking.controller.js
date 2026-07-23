import crypto from "node:crypto";
import mongoose from "mongoose";

import AuditLog from "../models/AuditLog.js";
import Booking from "../models/Booking.js";
import { incrementMetric } from "../observability/metrics.js";
import { sendBookingNotificationToAdmin } from "../utils/sendMail.js";
import { safeLog } from "../utils/safeLogger.js";

const STATUS_TRANSITIONS = {
  pending: new Set(["contacted", "cancelled"]),
  contacted: new Set(["completed", "cancelled"]),
  completed: new Set(),
  cancelled: new Set(),
};

const fingerprintBooking = (body, userId) =>
  crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        userId: userId || null,
        name: body.name,
        phone: body.phone,
        email: body.email,
        gym: body.gym,
        schedule: body.schedule,
        note: body.note || "",
        package: body.package,
        sessions: body.sessions,
        discountCode: body.discountCode || null,
        gifts: body.gifts || [],
      }),
    )
    .digest("hex");

const sendError = (res, error, event) => {
  safeLog.error(event, error);
  return res.status(error.statusCode || 500).json({
    success: false,
    code: error.codeName,
    message: error.statusCode ? error.message : "Lỗi hệ thống",
  });
};

const bookingReplay = async (clientRequestId, requestFingerprint) => {
  const booking = await Booking.findOne({ clientRequestId });
  if (!booking) return null;
  if (booking.requestFingerprint !== requestFingerprint) {
    const error = new Error(
      "clientRequestId đã được dùng với nội dung khác",
    );
    error.statusCode = 409;
    error.codeName = "REQUEST_ID_REUSED";
    throw error;
  }
  incrementMetric("booking.idempotency_hits");
  return booking;
};

export const createBooking = async (req, res) => {
  const userId = req.user?.id || null;
  const requestFingerprint = fingerprintBooking(req.body, userId);
  try {
    const prior = await bookingReplay(
      req.body.clientRequestId,
      requestFingerprint,
    );
    if (prior) {
      return res.status(200).json({
        success: true,
        data: prior,
        idempotentReplay: true,
        message: "Yêu cầu này đã được xử lý trước đó",
      });
    }
    const booking = await Booking.create({
      userId,
      name: req.body.name,
      phone: req.body.phone,
      email: req.body.email,
      gym: req.body.gym,
      schedule: req.body.schedule,
      note: req.body.note || "",
      package: req.body.package,
      sessions: req.body.sessions,
      discountCode: req.body.discountCode || null,
      gifts: req.body.gifts || [],
      clientRequestId: req.body.clientRequestId,
      requestFingerprint,
    });
    sendBookingNotificationToAdmin(booking).catch((error) =>
      safeLog.error("booking.notification_failed", error),
    );
    return res.status(201).json({
      success: true,
      data: booking,
      idempotentReplay: false,
      message: "Đăng ký thành công",
    });
  } catch (error) {
    if (error.code === 11000) {
      try {
        const prior = await bookingReplay(
          req.body.clientRequestId,
          requestFingerprint,
        );
        if (prior) {
          return res.status(200).json({
            success: true,
            data: prior,
            idempotentReplay: true,
            message: "Yêu cầu này đã được xử lý trước đó",
          });
        }
      } catch (replayError) {
        return sendError(res, replayError, "booking.replay_failed");
      }
    }
    return sendError(res, error, "booking.create_failed");
  }
};

export const getBookings = async (req, res) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(Number.parseInt(req.query.limit, 10) || 20, 1),
      100,
    );
    const filter = {
      isArchived:
        req.query.includeArchived === "true" ? { $in: [true, false] } : false,
    };
    if (Object.hasOwn(STATUS_TRANSITIONS, req.query.status)) {
      filter.status = req.query.status;
    }
    const search = String(req.query.search || "").trim().slice(0, 100);
    if (search) {
      const escaped = search.replace(/[|\\{}()[\]^$+*?.-]/g, "\\$&");
      const normalized = escaped.toLowerCase();
      filter.$or = [
        { nameNormalized: { $regex: normalized } },
        { emailNormalized: { $regex: normalized } },
        { phoneNormalized: { $regex: escaped.replace(/\D/g, "") } },
      ];
    }
    const skip = (page - 1) * limit;
    const [total, bookings] = await Promise.all([
      Booking.countDocuments(filter),
      Booking.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("userId", "name email")
        .lean(),
    ]);
    return res.json({
      success: true,
      data: bookings,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    });
  } catch (error) {
    return sendError(res, error, "booking.list_failed");
  }
};

export const updateBookingStatus = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { status, noteAdmin, revision } = req.body || {};
    if (!Object.hasOwn(STATUS_TRANSITIONS, status)) {
      const error = new Error("Trạng thái booking không hợp lệ");
      error.statusCode = 400;
      throw error;
    }
    if (!Number.isInteger(revision) || revision < 0) {
      const error = new Error("revision không hợp lệ");
      error.statusCode = 400;
      throw error;
    }
    if (noteAdmin !== undefined && String(noteAdmin).trim().length > 500) {
      const error = new Error("Ghi chú admin tối đa 500 ký tự");
      error.statusCode = 400;
      throw error;
    }

    let updatedBooking;
    await session.withTransaction(async () => {
      const booking = await Booking.findOne({
        _id: req.params.id,
        isArchived: false,
      }).session(session);
      if (!booking) {
        const error = new Error("Không tìm thấy booking");
        error.statusCode = 404;
        throw error;
      }
      if (
        booking.revision !== revision ||
        !STATUS_TRANSITIONS[booking.status].has(status)
      ) {
        incrementMetric("booking.transition_conflicts");
        const error = new Error(
          "Booking đã thay đổi hoặc transition không hợp lệ",
        );
        error.statusCode = 409;
        error.codeName = "BOOKING_TRANSITION_CONFLICT";
        throw error;
      }
      const now = new Date();
      const update = { status };
      if (noteAdmin !== undefined) {
        update.noteAdmin = String(noteAdmin).trim();
      }
      if (status === "contacted") update.contactedAt = now;
      if (status === "completed") update.completedAt = now;
      if (status === "cancelled") update.cancelledAt = now;
      updatedBooking = await Booking.findOneAndUpdate(
        {
          _id: booking._id,
          revision,
          status: booking.status,
          isArchived: false,
        },
        { $set: update, $inc: { revision: 1 } },
        { returnDocument: "after", runValidators: true, session },
      );
      if (!updatedBooking) {
        incrementMetric("booking.transition_conflicts");
        const error = new Error("Booking đã thay đổi. Vui lòng tải lại.");
        error.statusCode = 409;
        throw error;
      }
      await AuditLog.create(
        [
          {
            actorId: req.user.id,
            actorRole: "admin",
            action: "update_booking_status",
            targetType: "booking",
            targetId: booking._id,
            metadata: {
              fromStatus: booking.status,
              toStatus: status,
              fromRevision: revision,
              toRevision: updatedBooking.revision,
            },
            ipAddress: req.ip,
            userAgent: req.get("user-agent"),
          },
        ],
        { session },
      );
    });
    return res.json({
      success: true,
      data: updatedBooking,
      message: "Cập nhật thành công",
    });
  } catch (error) {
    return sendError(res, error, "booking.transition_failed");
  } finally {
    await session.endSession();
  }
};

export const checkUserHasBookings = async (req, res) => {
  try {
    const hasBookings = await Booking.exists({
      userId: req.user.id,
      isArchived: false,
    });
    return res.json({ success: true, hasBookings: Boolean(hasBookings) });
  } catch (error) {
    return sendError(res, error, "booking.check_user_failed");
  }
};

export const archiveBooking = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const revision = req.body?.revision;
    if (!Number.isInteger(revision) || revision < 0) {
      const error = new Error("revision không hợp lệ");
      error.statusCode = 400;
      throw error;
    }
    let archivedBooking;
    await session.withTransaction(async () => {
      archivedBooking = await Booking.findOneAndUpdate(
        {
          _id: req.params.id,
          revision,
          isArchived: false,
        },
        {
          $set: {
            isArchived: true,
            archivedAt: new Date(),
            archivedBy: req.user.id,
          },
          $inc: { revision: 1 },
        },
        { returnDocument: "after", session },
      );
      if (!archivedBooking) {
        incrementMetric("booking.transition_conflicts");
        const error = new Error(
          "Booking không tồn tại hoặc đã thay đổi. Vui lòng tải lại.",
        );
        error.statusCode = 409;
        throw error;
      }
      await AuditLog.create(
        [
          {
            actorId: req.user.id,
            actorRole: "admin",
            action: "archive_booking",
            targetType: "booking",
            targetId: archivedBooking._id,
            metadata: {
              fromRevision: revision,
              toRevision: archivedBooking.revision,
            },
            ipAddress: req.ip,
            userAgent: req.get("user-agent"),
          },
        ],
        { session },
      );
    });
    return res.json({
      success: true,
      data: archivedBooking,
      message: "Đã lưu trữ booking",
    });
  } catch (error) {
    return sendError(res, error, "booking.archive_failed");
  } finally {
    await session.endSession();
  }
};

// Keep the old export name so the existing DELETE route remains compatible.
export const deleteBooking = archiveBooking;
