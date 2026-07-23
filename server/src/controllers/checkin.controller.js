import mongoose from "mongoose";
import Checkin from "../models/Checkin.js";
import Order from "../models/Order.js";
import User from "../models/User.js";
import { sendCheckinMail } from "../utils/sendMail.js";
import { incrementMetric } from "../observability/metrics.js";
import { safeLog } from "../utils/safeLogger.js";

// Helper để parse time an toàn
const parseSafeTime = (timeInput) => {
  if (!timeInput) return new Date(); // nếu không có, dùng hiện tại
  const date = new Date(timeInput);
  if (isNaN(date.getTime())) {
    throw new Error("Thời gian không hợp lệ");
  }
  return date;
};

// CREATE CHECKIN
export const createCheckin = async (req, res) => {
  const { orderId, clientRequestId, time, muscle, note } = req.body;
  let formattedTime;
  try {
    formattedTime = parseSafeTime(time);
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  const session = await mongoose.startSession();
  let checkin;
  let order;
  let idempotentReplay = false;

  try {
    await session.withTransaction(async () => {
      const existingCheckin = await Checkin.findOne({
        orderId,
        clientRequestId,
      }).session(session);
      if (existingCheckin) {
        checkin = existingCheckin;
        idempotentReplay = true;
        return;
      }

      const query = {
        _id: orderId,
        sessions: { $gt: 0 },
        status: "approved",
      };
      if (!req.isAdmin) {
        query.trainerId = req.user.id;
      }

      order = await Order.findOneAndUpdate(
        query,
        { $inc: { sessions: -1 } },
        { returnDocument: "after", session },
      );
      if (!order) {
        const error = new Error(
          "Đơn hàng chưa được xác nhận hoặc đã hết buổi tập vui lòng liên hệ Admin",
        );
        error.statusCode = 400;
        throw error;
      }

      [checkin] = await Checkin.create(
        [
          {
            orderId,
            clientRequestId,
            name: order.name,
            package: order.package,
            time: formattedTime,
            muscle,
            note,
            remainingSessions: order.sessions,
          },
        ],
        { session },
      );
    });

    if (idempotentReplay) {
      incrementMetric("checkin.idempotency_hits");
      return res.json({
        success: true,
        data: checkin,
        idempotentReplay: true,
        message: "Check-in đã được xử lý trước đó",
      });
    }

    try {
      await sendCheckinMail(order.email, {
        name: order.name,
        package: order.package,
        time: formattedTime,
        muscle,
        note,
        remainingSessions: order.sessions,
      });
    } catch (mailErr) {
      safeLog.error("checkin.mail_failed", mailErr);
    }

    res.json({
      success: true,
      data: checkin,
      message: "Check-in thành công",
    });
  } catch (err) {
    if (err.code === 11000) {
      const existingCheckin = await Checkin.findOne({
        orderId,
        clientRequestId,
      });
      if (existingCheckin) {
        incrementMetric("checkin.idempotency_hits");
        return res.json({
          success: true,
          data: existingCheckin,
          idempotentReplay: true,
          message: "Check-in đã được xử lý trước đó",
        });
      }
    }
    incrementMetric("checkin.transaction_aborts");
    safeLog.error("checkin.create_failed", err);
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.statusCode ? err.message : "Lỗi checkin",
    });
  } finally {
    session.endSession();
  }
};

// UPDATE
export const updateCheckin = async (req, res) => {
  try {
    const checkin = await Checkin.findById(req.params.id);
    if (!checkin) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy checkin" });
    }

    // Kiểm tra quyền
    if (!req.isAdmin) {
      const order = await Order.findById(checkin.orderId);

      if (!order || order.trainerId?.toString() !== req.user.id.toString()) {
        return res
          .status(403)
          .json({ success: false, message: "Không có quyền sửa checkin này" });
      }
    }

    // Chuẩn bị dữ liệu update
    const updateData = {};
    if (req.body.muscle !== undefined) updateData.muscle = req.body.muscle;
    if (req.body.note !== undefined) updateData.note = req.body.note;
    if (req.body.time !== undefined) {
      // Nếu có time, phải parse an toàn
      try {
        updateData.time = parseSafeTime(req.body.time);
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: err.message,
        });
      }
    }

    const updatedCheckin = await Checkin.findByIdAndUpdate(
      req.params.id,
      updateData,
      { returnDocument: "after", runValidators: true },
    );

    res.json({
      success: true,
      data: updatedCheckin,
      message: "Cập nhật check-in thành công",
    });
  } catch (err) {
    safeLog.error("checkin.update_failed", err);
    res.status(500).json({ success: false, message: "Lỗi update" });
  }
};

// DELETE
export const deleteCheckin = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const checkin = await Checkin.findOneAndDelete({
        _id: req.params.id,
      }).session(session);
      if (!checkin) {
        const error = new Error("Không tìm thấy checkin");
        error.statusCode = 404;
        throw error;
      }

      await Order.findOneAndUpdate(
        {
          _id: checkin.orderId,
          $expr: { $lt: ["$sessions", "$totalSessions"] },
        },
        { $inc: { sessions: 1 } },
        { session },
      );
    });

    res.json({
      success: true,
      message: "Đã xóa và hoàn lại buổi tập",
    });
  } catch (err) {
    safeLog.error("checkin.delete_failed", err);
    res
      .status(err.statusCode || 500)
      .json({ message: err.statusCode ? err.message : "Lỗi xóa checkin" });
  } finally {
    session.endSession();
  }
};

// GET ALL
export const getCheckins = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 10, 1),
      100,
    );
    const skip = (page - 1) * limit;
    const search = req.query.search || "";
    const month = req.query.month;
    const year = req.query.year;

    let query = {};
    if (!req.isAdmin) {
      const orders = await Order.find({ trainerId: req.user.id }).select("_id");
      const orderIds = orders.map((o) => o._id);
      query.orderId = { $in: orderIds };
    }

    if (search && search.trim()) {
      // Giới hạn độ dài tối đa 50 ký tự
      const safeSearch = search.trim().slice(0, 50);
      // Escape regex metacharacters
      const escapedSearch = safeSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.name = { $regex: escapedSearch, $options: "i" };
    }
    if (month && year) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59);
      query.time = { $gte: start, $lte: end };
    }

    const total = await Checkin.countDocuments(query);
    const checkins = await Checkin.find(query)
      .sort({ time: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      success: true,
      data: checkins,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    safeLog.error("checkin.list_failed", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET MY
export const getMyCheckins = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select("_id name email avatar")
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const orders = await Order.find({ userId: req.user.id });
    const orderIds = orders.map((o) => o._id);

    const checkins = await Checkin.find({
      orderId: { $in: orderIds },
    }).sort({ createdAt: -1 });
    res.json({
      success: true,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
        },
        checkins,
        orders,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Lỗi lấy dữ liệu" });
  }
};
