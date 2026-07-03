import Order from "../models/Order.js";
import { sendMail } from "../utils/sendMail.js";
import Checkin from "../models/Checkin.js";
import User from "../models/User.js";
import TrainerSubscription from "../models/TrainerSubscription.js";
import { getMaxClientsByPlan } from "./trainerSubscription.controller.js";
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
    const trainerId = req.body.trainerId || null;

    // ===== Check giới hạn học viên theo gói HLV =====
    if (trainerId) {
      // Tìm subscription active của trainer
      const subscription = await TrainerSubscription.findOne({
        userId: trainerId,
        status: "active",
        endDate: { $gt: new Date() },
      });

      if (subscription) {
        const maxClients = getMaxClientsByPlan(subscription.planTitle);

        if (maxClients > 0) {
          // Đếm số email unique mà trainer đang quản lý
          const existingEmails = await Order.distinct("email", { trainerId });

          // Nếu email này chưa tồn tại → cần 1 slot mới
          const isNewClient = !existingEmails.includes(normalizedEmail);

          if (isNewClient && existingEmails.length >= maxClients) {
            return res.status(403).json({
              success: false,
              message: `Gói "${subscription.planTitle}" chỉ cho phép quản lý tối đa ${maxClients} học viên. Hiện tại đã có ${existingEmails.length} học viên. Vui lòng nâng cấp gói để thêm học viên mới.`,
              data: {
                currentClients: existingEmails.length,
                maxClients,
                planTitle: subscription.planTitle,
              },
            });
          }
        }
      }
    }

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
      trainerId,
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
    const limit = req.query.limit ? Number(req.query.limit) : 5;
    const skip = (page - 1) * limit;

    let query = {};
    if (!req.isAdmin) {
      // Trainer chỉ thấy đơn có trainerId là chính họ
      query.trainerId = req.user.id;
    }

    const total = await Order.countDocuments(query);
    const ordersQuery = Order.find(query)
      .populate("trainerId", "name email")
      .populate("userId", "phone address")
      .sort({ createdAt: -1 });

    if (limit > 0) {
      ordersQuery.skip(skip).limit(limit);
    }

    const orders = await ordersQuery;

    const totalPages = limit > 0 ? Math.ceil(total / limit) : 1;

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
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Không tìm thấy đơn" });
    }

    // Whitelist fields cho phép update — ngăn inject field bất ngờ
    const allowed = ["name", "email", "phone", "package", "sessions", "totalSessions", "trainerId", "status", "notes"];
    const updateData = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updateData[key] = req.body[key];
    }

    const updated = await Order.findByIdAndUpdate(req.params.id, updateData, {
      returnDocument: "after",
    });

    res.json({
      success: true,
      data: updated,
      message: "Cập nhật thành công",
    });
  } catch (err) {
    console.error("UPDATE ORDER ERROR:", err);
    res.status(500).json({ success: false, message: "Lỗi cập nhật đơn" });
  }
};

export const deleteOrder = async (req, res) => {
  try {
    const orderId = req.params.id;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Không tìm thấy đơn" });
    }

    // 👉 xoá order
    await Order.findByIdAndDelete(orderId);

    // 👉 xoá luôn checkin liên quan
    await Checkin.deleteMany({ orderId });

    res.json({
      success: true,
      message: "Đã xóa đơn",
    });
  } catch (err) {
    console.error("DELETE ORDER ERROR:", err);
    res.status(500).json({ success: false, message: "Lỗi xóa đơn" });
  }
};
