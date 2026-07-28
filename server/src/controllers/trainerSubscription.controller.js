import mongoose from "mongoose";
import TrainerSubscription from "../models/TrainerSubscription.js";
import AuditLog from "../models/AuditLog.js";
import User from "../models/User.js";
import { escapeRegex } from "../utils/escapeRegex.js";
import { incrementMetric } from "../observability/metrics.js";
import { safeLog } from "../utils/safeLogger.js";
import { calculateRetentionDeadlines } from "../services/trainerSubscriptionLifecycle.service.js";

const httpError = (status, code, message) =>
  Object.assign(new Error(message), { status, code });

// GET /api/trainer-subscriptions/all
export const getAllSubscribers = async (req, res) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(Number.parseInt(req.query.limit, 10) || 10, 1),
      50,
    );
    const search = String(req.query.search || "").trim().slice(0, 80);
    const query = {
      isActive: true,
      endDate: { $gt: new Date() },
    };
    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      const users = await User.find({
        $or: [{ name: regex }, { email: regex }],
      })
        .select("_id")
        .limit(200)
        .lean();
      query.userId = { $in: users.map((user) => user._id) };
    }

    const [total, subscriptions] = await Promise.all([
      TrainerSubscription.countDocuments(query),
      TrainerSubscription.find(query)
        .populate("userId", "name email avatar")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);
    return res.status(200).json({
      success: true,
      data: subscriptions,
      pagination: {
        total,
        totalPages: Math.ceil(total / limit) || 1,
        currentPage: page,
      },
    });
  } catch (error) {
    safeLog.error("financial.subscription_list_failed", error);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống" });
  }
};

// POST /api/trainer-subscriptions/:id/cancel
export const cancelSubscription = async (req, res) => {
  const session = await mongoose.startSession();
  let skipped = false;

  try {
    const reason = String(req.body?.reason || "").trim();
    if (reason.length < 8 || reason.length > 500) {
      throw httpError(
        400,
        "SUBSCRIPTION_CANCEL_REASON_REQUIRED",
        "Lý do hủy phải từ 8 đến 500 ký tự",
      );
    }

    await session.withTransaction(async () => {
      const subscription = await TrainerSubscription.findById(
        req.params.id,
      ).session(session);
      if (!subscription) {
        throw httpError(404, "SUBSCRIPTION_NOT_FOUND", "Không tìm thấy gói");
      }
      if (subscription.status === "cancelled") {
        skipped = true;
        return;
      }
      if (subscription.status !== "active") {
        throw httpError(
          409,
          "INVALID_SUBSCRIPTION_TRANSITION",
          "Chỉ gói active mới có thể hủy",
        );
      }

      const cancelledAt = new Date();
      const retention = calculateRetentionDeadlines(cancelledAt);
      const transitioned = await TrainerSubscription.updateOne(
        { _id: subscription._id, status: "active", isActive: true },
        {
          $set: {
            status: "cancelled",
            isActive: false,
            cancelledAt,
            structuredRetentionExpiresAt: retention.structuredRetentionExpiresAt,
            mediaRetentionExpiresAt: retention.mediaRetentionExpiresAt,
            cancelledBy: req.user.id,
            cancelReason: reason,
          },
        },
        { session, runValidators: true },
      );
      if (transitioned.modifiedCount !== 1) {
        incrementMetric("financial.conflicts");
        throw httpError(
          409,
          "SUBSCRIPTION_STATE_CONFLICT",
          "Gói đã thay đổi bởi yêu cầu khác",
        );
      }

      await AuditLog.create(
        [
          {
            actorId: req.user.id,
            actorRole: req.user.role,
            action: "cancel_trainer_subscription",
            targetType: "trainer_subscription",
            targetId: subscription._id,
            metadata: {
              reason,
              amount: subscription.amount,
              purchaseRequestId: subscription.purchaseRequestId,
              refundApplied: false,
            },
            ipAddress: req.ip,
            userAgent: req.get("User-Agent"),
          },
        ],
        { session },
      );
    });

    return res.status(200).json({
      success: true,
      skipped,
      message: skipped
        ? "Gói này đã được hủy trước đó"
        : "Đã hủy gói; giao dịch ví được giữ nguyên để đối soát",
    });
  } catch (error) {
    safeLog.error("financial.subscription_cancel_failed", error);
    return res.status(error.status || 500).json({
      success: false,
      code: error.code || "SUBSCRIPTION_CANCEL_FAILED",
      message:
        (error.status || 500) >= 500
          ? "Lỗi hệ thống khi hủy gói"
          : error.message,
    });
  } finally {
    await session.endSession();
  }
};
