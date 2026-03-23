import Order from "../models/Order.js";
import { sendMail } from "../utils/sendMail.js";
import Checkin from "../models/Checkin.js";
import User from "../models/User.js";
import jwt from "jsonwebtoken";

export const createOrder = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "Thiếu token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!req.body.email) {
      return res.status(400).json({ message: "Thiếu email" });
    }

    const email = req.body.email.toLowerCase().trim();

    // 👉 tìm user
    let user = await User.findOne({ email });

    // 👉 nếu chưa có thì tạo
    if (!user) {
      user = await User.create({
        name: req.body.name,
        email,
      });
    }

    const order = await Order.create({
      ...req.body,
      email,
      userId: user._id,
      sessions: Number(req.body.sessions),
      totalSessions: Number(req.body.sessions),
    });

    res.json(order);
  } catch (err) {
    console.error("CREATE ORDER ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};
export const getOrders = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 5;

  const total = await Order.countDocuments();
  const orders = await Order.find()
    .skip((page - 1) * limit)
    .limit(limit)
    .sort({ createdAt: -1 });

  res.json({
    orders,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
};

export const approveOrder = async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status: "approved" },
      { returnDocument: "after" },
    );

    if (!order) {
      return res.status(404).json({ message: "Không tìm thấy đơn" });
    }

    // 👉 gửi mail (không được để crash)
    try {
      await sendMail(order.email, "Xác nhận lịch tập", order);
    } catch (mailErr) {
      console.error("MAIL ERROR:", mailErr);
    }

    res.json(order);
  } catch (err) {
    console.error("APPROVE ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

export const updateOrder = async (req, res) => {
  const order = await Order.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });

  res.json(order);
};

export const deleteOrder = async (req, res) => {
  try {
    const orderId = req.params.id;

    // 👉 xoá order
    await Order.findByIdAndDelete(orderId);

    // 👉 xoá luôn checkin liên quan
    await Checkin.deleteMany({ orderId });

    res.json({ message: "Đã xóa đơn" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi xóa đơn" });
  }
};
