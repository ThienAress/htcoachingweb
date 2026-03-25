import Order from "../models/Order.js";
import { sendMail } from "../utils/sendMail.js";
import Checkin from "../models/Checkin.js";
import User from "../models/User.js";
import jwt from "jsonwebtoken";

export const createOrder = async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!email || !name) {
      return res.status(400).json({
        success: false,
        message: "Thiếu email",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 👉 tìm user theo email (khách)
    let user = await User.findOne({ email: normalizedEmail });

    // 👉 nếu chưa có thì tạo
    if (!user) {
      user = await User.create({
        name,
        email: normalizedEmail,
        role: "user",
      });
    }

    const order = await Order.create({
      ...req.body,
      email: normalizedEmail,
      userId: user._id,
      trainerId: req.body.trainerId || null,
      sessions: Number(req.body.sessions),
      totalSessions: Number(req.body.sessions),
    });

    res.json({
      success: true,
      data: order,
      message: "Tạo đơn thành công",
    });
  } catch (err) {
    console.error("CREATE ORDER ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

export const getOrders = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    let query = {};
    if (req.user.role === "trainer") {
      // Trainer chỉ thấy đơn có trainerId là chính họ
      query.trainerId = req.user.id;
    }

    const total = await Order.countDocuments(query);
    const orders = await Order.find(query)
      .populate("trainerId", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        orders,
        total,
        page,
        totalPages,
      },
    });
  } catch (err) {
    console.error("GET ORDERS ERROR:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

export const approveOrder = async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status: "approved", approvedAt: new Date() },
      { returnDocument: "after" },
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy đơn",
      });
    }

    // 👉 gửi mail (không được để crash)
    try {
      await sendMail(order.email, "Xác nhận lịch tập", order);
    } catch (mailErr) {
      console.error("MAIL ERROR:", mailErr);
    }

    res.json({
      success: true,
      data: order,
      message: "Đã xác nhận đơn",
    });
  } catch (err) {
    console.error("APPROVE ERROR:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

export const updateOrder = async (req, res) => {
  const order = await Order.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });

  res.json({
    success: true,
    data: order,
    message: "Cập nhật thành công",
  });
};

export const deleteOrder = async (req, res) => {
  try {
    const orderId = req.params.id;

    // 👉 xoá order
    await Order.findByIdAndDelete(orderId);

    // 👉 xoá luôn checkin liên quan
    await Checkin.deleteMany({ orderId });

    res.json({
      success: true,
      message: "Đã xóa đơn",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi xóa đơn" });
  }
};
