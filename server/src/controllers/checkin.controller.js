import mongoose from "mongoose";
import Checkin from "../models/Checkin.js";
import Order from "../models/Order.js";
import User from "../models/User.js";
import { sendCheckinMail } from "../utils/sendMail.js";

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
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { orderId, time, muscle, note } = req.body;

    // Parse time an toàn
    let formattedTime;
    try {
      formattedTime = parseSafeTime(time);
    } catch (err) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }

    // Xây dựng query điều kiện
    let query = {
      _id: orderId,
      sessions: { $gt: 0 },
      status: "approved",
    };

    if (req.user.role === "trainer") {
      query.trainerId = req.user.id;
    }

    const order = await Order.findOneAndUpdate(
      query,
      { $inc: { sessions: -1 } },
      { new: true, session },
    );

    if (!order) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message:
          "Đơn hàng chưa được xác nhận hoặc đã hết buổi tập vui lòng liên hệ Admin",
      });
    }

    const checkin = await Checkin.create(
      [
        {
          orderId,
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

    await session.commitTransaction();

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
      console.error("Mail error after checkin:", mailErr);
    }

    res.json({
      success: true,
      data: checkin[0],
      message: "Check-in thành công",
    });
  } catch (err) {
    await session.abortTransaction();
    console.error("❌ CHECKIN ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Lỗi checkin",
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
    if (req.user.role === "trainer") {
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
      { new: true },
    );

    res.json({
      success: true,
      data: updatedCheckin,
      message: "Cập nhật check-in thành công",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Lỗi update" });
  }
};

// DELETE
export const deleteCheckin = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Lấy checkin cần xóa
    const checkin = await Checkin.findById(req.params.id).session(session);
    if (!checkin) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy checkin",
      });
    }

    // Tìm order liên quan để hoàn lại buổi tập
    const order = await Order.findById(checkin.orderId).session(session);
    if (order && order.sessions < order.totalSessions) {
      order.sessions += 1;
      await order.save({ session });
    }

    // Xóa checkin
    await Checkin.findByIdAndDelete(req.params.id).session(session);

    // Commit nếu mọi thứ thành công
    await session.commitTransaction();
    res.json({
      success: true,
      message: "Đã xóa và hoàn lại buổi tập",
    });
  } catch (err) {
    // Rollback nếu có lỗi
    await session.abortTransaction();
    console.error(err);
    res.status(500).json({ message: "Lỗi xóa checkin" });
  } finally {
    session.endSession();
  }
};

// GET ALL
export const getCheckins = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";
    const month = req.query.month;
    const year = req.query.year;

    let query = {};
    if (req.user.role === "trainer") {
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
      .sort({ createdAt: -1 })
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
    console.error("GET CHECKINS ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET MY
export const getMyCheckins = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    const orders = await Order.find({ userId: user.id });
    const orderIds = orders.map((o) => o._id);

    const checkins = await Checkin.find({
      orderId: { $in: orderIds },
    }).sort({ createdAt: -1 });
    res.json({
      success: true,
      data: {
        user,
        checkins,
        orders,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Lỗi lấy dữ liệu" });
  }
};
