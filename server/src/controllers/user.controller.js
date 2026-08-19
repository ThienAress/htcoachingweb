import mongoose from "mongoose";
import User from "../models/User.js";
import Order from "../models/Order.js";
import Checkin from "../models/Checkin.js";
import FitnessSubscription from "../models/FitnessSubscription.js";
import FitnessPlusQuotaUsage from "../models/FitnessPlusQuotaUsage.js";
import {
  deleteTodayDashboardData,
} from "../services/todayDashboardPrivacy.service.js";
import { safeLog } from "../utils/safeLogger.js";
import { deleteAiMemoryForUser } from "../services/aiMemory.service.js";

export const getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const query = { role: "user" };
    if (req.query.search) {
      query.$or = [
        { name: { $regex: req.query.search, $options: "i" } },
        { email: { $regex: req.query.search, $options: "i" } },
      ];
    }

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .select("-password")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    safeLog.error("user.list_failed", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const deleteUser = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const userId = req.params.id;
    let user = null;
    await session.withTransaction(async () => {
      user = await User.findById(userId).session(session);
      if (!user) return;

      const orders = await Order.find({ userId })
        .select("_id")
        .session(session);
      const orderIds = orders.map((order) => order._id);

      if (orderIds.length > 0) {
        await Checkin.deleteMany({
          orderId: { $in: orderIds },
        }).session(session);
      }

      await deleteTodayDashboardData({
        clientId: userId,
        actorId: req.user.id,
        actorRole: req.user.role,
        session,
      });
      await deleteAiMemoryForUser(userId, { session });
      await FitnessPlusQuotaUsage.deleteMany({ userId }).session(session);
      await FitnessSubscription.deleteMany({ userId }).session(session);
      await Order.deleteMany({ userId }).session(session);
      await User.deleteOne({ _id: userId }).session(session);
    });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy người dùng" });
    }

    res.json({
      success: true,
      message: "Xóa người dùng và dữ liệu liên quan thành công",
    });
  } catch (err) {
    safeLog.error("user.delete_failed", err);
    res.status(500).json({
      success: false,
      message: "Không thể xóa người dùng lúc này",
    });
  } finally {
    await session.endSession();
  }
};
