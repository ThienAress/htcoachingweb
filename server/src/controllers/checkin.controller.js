import Checkin from "../models/Checkin.js";
import Order from "../models/Order.js";
import User from "../models/User.js";
import { sendCheckinMail } from "../utils/sendMail.js";

// CREATE CHECKIN
export const createCheckin = async (req, res) => {
  try {
    const { orderId, time, muscle, note } = req.body;

    const formattedTime = new Date(time);

    if (!time || isNaN(formattedTime.getTime())) {
      return res.status(400).json({ message: "Thời gian không hợp lệ" });
    }
    // 🔥 FIX: atomic update (tránh double click bug)
    const order = await Order.findOneAndUpdate(
      { _id: orderId, sessions: { $gt: 0 } },
      { $inc: { sessions: -1 } },
      { new: true },
    );

    if (!order) {
      return res.status(400).json({ message: "Hết buổi hoặc không tồn tại" });
    }

    const checkin = await Checkin.create({
      orderId,
      name: order.name,
      package: order.package,
      time: formattedTime,
      muscle,
      note,
      remainingSessions: order.sessions,
    });

    // gửi mail (không crash hệ thống)
    console.log("🔥 ĐANG GỌI SEND MAIL");
    try {
      await sendCheckinMail(order.email, {
        name: order.name,
        package: order.package,
        time: formattedTime,
        muscle,
        note,
        remainingSessions: order.sessions,
      });
      console.log("🔥 ĐANG GỌI SEND MAIL");
    } catch (err) {
      console.error("MAIL CHECKIN ERROR:", err);
    }

    res.json(checkin);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi checkin" });
  }
};

// UPDATE
export const updateCheckin = async (req, res) => {
  try {
    const checkin = await Checkin.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    res.json(checkin);
  } catch (err) {
    res.status(500).json({ message: "Lỗi update" });
  }
};

// DELETE
export const deleteCheckin = async (req, res) => {
  try {
    const checkin = await Checkin.findById(req.params.id);

    if (!checkin) {
      return res.status(404).json({ message: "Không tìm thấy checkin" });
    }

    const order = await Order.findById(checkin.orderId);

    // 🔥 FIX: không vượt quá totalSessions
    if (order && order.sessions < order.totalSessions) {
      order.sessions += 1;
      await order.save();
    }

    await Checkin.findByIdAndDelete(req.params.id);

    res.json({ message: "Đã xóa và hoàn lại buổi tập" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi xóa checkin" });
  }
};

// GET ALL
export const getCheckins = async (req, res) => {
  try {
    const data = await Checkin.find().sort({ createdAt: -1 });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Lỗi lấy dữ liệu" });
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
      user,
      orders,
      checkins,
    });
  } catch (err) {
    res.status(500).json({ message: "Lỗi lấy dữ liệu" });
  }
};
