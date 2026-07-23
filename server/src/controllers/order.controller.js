import mongoose from "mongoose";
import Order from "../models/Order.js";
import { sendMail } from "../utils/sendMail.js";
import Checkin from "../models/Checkin.js";
import Contract from "../models/Contract.js";
import AuditLog from "../models/AuditLog.js";
import User from "../models/User.js";
import TrainerSubscription from "../models/TrainerSubscription.js";
import { getMaxClientsByPlan } from "./trainerSubscription.controller.js";
import jwt from "jsonwebtoken";
import { escapeRegex } from "../utils/escapeRegex.js";
import { trackDbQuery } from "../observability/queryTelemetry.js";
import { incrementMetric } from "../observability/metrics.js";
import { safeLog } from "../utils/safeLogger.js";

const orderError = (status, code, message) =>
  Object.assign(new Error(message), { status, code });

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
        isActive: true,
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
    safeLog.error("order.create_failed", err);
    res.status(500).json({ message: err.message });
  }
};

export const getOrders = async (req, res) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(Number.parseInt(req.query.limit, 10) || 5, 1),
      100,
    );
    const skip = (page - 1) * limit;

    let query = {};
    if (!req.isAdmin) {
      // Trainer chỉ thấy đơn có trainerId là chính họ
      query.trainerId = req.user.id;
    }

    const ordersQuery = Order.find(query)
      .populate("trainerId", "name email")
      .populate("userId", "phone address")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const [total, orders] = await trackDbQuery("order.actor.list", () =>
      Promise.all([Order.countDocuments(query), ordersQuery]),
    );
    const totalPages = Math.ceil(total / limit) || 1;

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
    safeLog.error("order.list_failed", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

export const getCheckinOrderOptions = async (req, res) => {
  try {
    const search = String(req.query.search || "").trim().slice(0, 50);
    const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 50);
    const query = {
      status: "approved",
      sessions: { $gt: 0 },
      ...(req.isAdmin
        ? { trainerId: null }
        : { trainerId: req.user.id }),
    };
    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      query.$or = [{ name: regex }, { email: regex }];
    }

    const orders = await trackDbQuery("order.checkin_options", () =>
      Order.find(query)
        .select("name email package sessions totalSessions trainerId")
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
    );
    return res.json({ success: true, data: orders });
  } catch {
    return res.status(500).json({
      success: false,
      message: "Không thể tải danh sách khách hàng check-in",
    });
  }
};

export const approveOrder = async (req, res) => {
  try {
    // Atomic: chỉ approve nếu đang pending
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, status: "pending" },
      { $set: { status: "approved", approvedAt: new Date() } },
      { returnDocument: "after" },
    );

    if (!order) {
      // Kiểm tra đơn có tồn tại không
      const exists = await Order.findById(req.params.id);
      if (!exists) {
        return res.status(404).json({ success: false, message: "Không tìm thấy đơn" });
      }
      return res.status(400).json({ success: false, message: `Không thể xác nhận đơn ở trạng thái "${exists.status}"` });
    }

    // 👉 gửi mail (không được để crash)
    try {
      await sendMail(order.email, "Xác nhận lịch tập", order);
    } catch (mailErr) {
      safeLog.error("order.mail_failed", mailErr);
    }

    res.json({
      success: true,
      data: order,
      message: "Đã xác nhận đơn",
    });
  } catch (err) {
    safeLog.error("order.approve_failed", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

export const updateOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).lean();
    if (!order) {
      return res.status(404).json({ success: false, message: "Không tìm thấy đơn" });
    }

    // State transition guard
    const VALID_TRANSITIONS = {
      pending: ["approved", "cancelled"],
      approved: ["completed", "cancelled"],
      completed: [],
      cancelled: [],
    };

    if (req.body.status && req.body.status !== order.status) {
      const allowedStatuses = VALID_TRANSITIONS[order.status] || [];
      if (!allowedStatuses.includes(req.body.status)) {
        return res.status(400).json({
          success: false,
          message: `Không thể chuyển trạng thái từ "${order.status}" sang "${req.body.status}"`,
        });
      }
    }

    // Whitelist fields cho phép update — ngăn inject field bất ngờ
    const allowed = [
      "name",
      "email",
      "phone",
      "package",
      "sessions",
      "totalSessions",
      "trainerId",
      "status",
      "gym",
      "schedule",
      "note",
    ];
    const updateData = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updateData[key] = req.body[key];
    }
    if (updateData.email) {
      updateData.email = updateData.email.toLowerCase().trim();
    }

    const nextSessions = updateData.sessions ?? order.sessions;
    const nextTotalSessions = updateData.totalSessions ?? order.totalSessions;
    if (
      !Number.isSafeInteger(nextSessions) ||
      !Number.isSafeInteger(nextTotalSessions) ||
      nextSessions < 0 ||
      nextTotalSessions < 1 ||
      nextSessions > nextTotalSessions
    ) {
      return res.status(400).json({
        success: false,
        code: "INVALID_ORDER_SESSION_BALANCE",
        message: "Số buổi còn lại phải nằm trong tổng số buổi",
      });
    }
    if (order.status === "pending" && updateData.status === "approved") {
      updateData.approvedAt = new Date();
    }

    const updated = await Order.findOneAndUpdate(
      {
        _id: req.params.id,
        status: order.status,
        updatedAt: order.updatedAt,
      },
      { $set: updateData },
      {
      returnDocument: "after",
        runValidators: true,
      },
    );
    if (!updated) {
      incrementMetric("financial.conflicts");
      return res.status(409).json({
        success: false,
        code: "ORDER_STATE_CONFLICT",
        message: "Đơn đã thay đổi bởi yêu cầu khác. Vui lòng tải lại.",
      });
    }

    res.json({
      success: true,
      data: updated,
      message: "Cập nhật thành công",
    });
  } catch (err) {
    safeLog.error("order.update_failed", err);
    res.status(500).json({ success: false, message: "Lỗi cập nhật đơn" });
  }
};

export const deleteOrder = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const orderId = req.params.id;
    await session.withTransaction(async () => {
      const order = await Order.findById(orderId).session(session).lean();
      if (!order) {
        throw orderError(404, "ORDER_NOT_FOUND", "Không tìm thấy đơn");
      }
      if (!["pending", "cancelled"].includes(order.status)) {
        throw orderError(
          409,
          "ORDER_DELETE_NOT_ALLOWED",
          "Chỉ có thể xóa đơn pending hoặc cancelled",
        );
      }

      const [hasCheckins, hasContract] = await Promise.all([
        Checkin.exists({ orderId }).session(session),
        Contract.exists({ orderId }).session(session),
      ]);
      if (hasCheckins || hasContract) {
        throw orderError(
          409,
          "ORDER_HAS_DEPENDENCIES",
          "Không thể xóa đơn đã có check-in hoặc hợp đồng",
        );
      }

      const deleted = await Order.deleteOne(
        { _id: orderId, status: order.status },
        { session },
      );
      if (deleted.deletedCount !== 1) {
        incrementMetric("financial.conflicts");
        throw orderError(
          409,
          "ORDER_STATE_CONFLICT",
          "Đơn đã thay đổi bởi yêu cầu khác",
        );
      }

      await AuditLog.create(
        [
          {
            actorId: req.user.id,
            actorRole: req.user.role,
            action: "delete_order",
            targetType: "order",
            targetId: order._id,
            metadata: {
              status: order.status,
              email: order.email,
              sessions: order.sessions,
              totalSessions: order.totalSessions,
            },
            ipAddress: req.ip,
            userAgent: req.get("User-Agent"),
          },
        ],
        { session },
      );
    });

    res.json({
      success: true,
      message: "Đã xóa đơn",
    });
  } catch (err) {
    safeLog.error("order.delete_failed", err);
    const status = err.status || 500;
    res.status(status).json({
      success: false,
      code: err.code || "ORDER_DELETE_FAILED",
      message: status >= 500 ? "Lỗi xóa đơn" : err.message,
    });
  } finally {
    await session.endSession();
  }
};
