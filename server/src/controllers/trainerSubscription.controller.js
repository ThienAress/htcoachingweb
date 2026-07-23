import mongoose from "mongoose";
import Wallet from "../models/Wallet.js";
import TrainerSubscription from "../models/TrainerSubscription.js";
import AuditLog from "../models/AuditLog.js";
import User from "../models/User.js";
import WalletTransaction from "../models/WalletTransaction.js";
import {
  applyWalletEntry,
  WalletLedgerError,
} from "../services/walletLedger.service.js";
import { escapeRegex } from "../utils/escapeRegex.js";
import { incrementMetric } from "../observability/metrics.js";
import { safeLog } from "../utils/safeLogger.js";

const TRAINER_PLANS = {
  "Tiêu chuẩn": { month: 5000, year: 50000, maxClients: 5 },
  "Chuyên nghiệp": { month: 7000, year: 70000, maxClients: 20 },
  "Cao cấp": { month: 10000, year: 100000, maxClients: 50 },
};
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const httpError = (status, code, message) =>
  Object.assign(new Error(message), { status, code });

export const getMaxClientsByPlan = (planTitle) =>
  TRAINER_PLANS[planTitle]?.maxClients || 0;

const purchaseResponse = (subscription, balanceAfter, skipped = false) => ({
  success: true,
  skipped,
  message: skipped
    ? "Yêu cầu thanh toán này đã được xử lý trước đó"
    : "Đã mua gói thành công",
  data: {
    subscriptionId: subscription._id,
    planTitle: subscription.planTitle,
    billingCycle: subscription.billingCycle,
    amount: subscription.amount,
    startDate: subscription.startDate,
    endDate: subscription.endDate,
    newBalance: balanceAfter,
  },
});

const findPriorPurchase = async (userId, requestId) => {
  const subscription = await TrainerSubscription.findOne({
    userId,
    purchaseRequestId: requestId,
  }).lean();
  if (!subscription) return null;
  const transaction = await WalletTransaction.findOne({
    idempotencyKey:
      "trainer-subscription:" + userId.toString() + ":" + requestId,
  }).lean();
  if (!transaction) {
    throw httpError(
      409,
      "SUBSCRIPTION_LEDGER_MISSING",
      "Subscription tồn tại nhưng thiếu ledger entry; cần đối soát",
    );
  }
  return { subscription, balanceAfter: transaction.balanceAfter };
};

// POST /api/trainer-subscriptions/purchase
export const purchaseTrainerPlan = async (req, res) => {
  const session = await mongoose.startSession();
  const userId = req.user.id;
  const { planTitle, billingCycle, requestId } = req.body || {};

  try {
    if (!UUID_PATTERN.test(String(requestId || ""))) {
      throw httpError(
        400,
        "INVALID_PURCHASE_REQUEST_ID",
        "requestId thanh toán không hợp lệ",
      );
    }
    const planPricing = TRAINER_PLANS[planTitle];
    if (!planPricing) {
      throw httpError(400, "INVALID_TRAINER_PLAN", "Gói không tồn tại");
    }
    if (!["month", "year"].includes(billingCycle)) {
      throw httpError(
        400,
        "INVALID_BILLING_CYCLE",
        "Chu kỳ thanh toán không hợp lệ",
      );
    }

    const prior = await findPriorPurchase(userId, requestId);
    if (prior) {
      incrementMetric("financial.idempotency_hits");
      return res
        .status(200)
        .json(purchaseResponse(prior.subscription, prior.balanceAfter, true));
    }

    let outcome;
    await session.withTransaction(async () => {
      const repeated = await TrainerSubscription.findOne({
        userId,
        purchaseRequestId: requestId,
      })
        .session(session)
        .lean();
      if (repeated) {
        throw httpError(
          409,
          "PURCHASE_RETRY_PENDING",
          "Yêu cầu thanh toán đang được xử lý",
        );
      }

      const active = await TrainerSubscription.findOne({
        userId,
        isActive: true,
      })
        .session(session)
        .lean();
      if (active) {
        throw httpError(
          409,
          "ACTIVE_SUBSCRIPTION_EXISTS",
          "Bạn đang có gói huấn luyện viên còn hiệu lực",
        );
      }

      const amount = planPricing[billingCycle];
      const wallet = await Wallet.findOne({ userId }).session(session);
      if (!wallet) {
        throw httpError(
          404,
          "WALLET_NOT_FOUND",
          "Không tìm thấy ví. Vui lòng nạp tiền trước.",
        );
      }
      if (wallet.balance < amount) {
        throw httpError(409, "INSUFFICIENT_WALLET_BALANCE", "Số dư ví không đủ");
      }

      const startDate = new Date();
      const endDate = new Date(startDate);
      if (billingCycle === "month") {
        endDate.setMonth(endDate.getMonth() + 1);
      } else {
        endDate.setFullYear(endDate.getFullYear() + 1);
      }

      const [subscription] = await TrainerSubscription.create(
        [
          {
            userId,
            planTitle,
            billingCycle,
            amount,
            startDate,
            endDate,
            status: "active",
            isActive: true,
            purchaseRequestId: requestId,
          },
        ],
        { session },
      );

      const idempotencyKey =
        "trainer-subscription:" + userId.toString() + ":" + requestId;
      const ledger = await applyWalletEntry({
        session,
        userId,
        amount: -amount,
        type: "purchase",
        referenceType: "trainer_subscription",
        referenceId: subscription._id,
        idempotencyKey,
        metadata: {
          planTitle,
          billingCycle,
          subscriptionId: subscription._id,
        },
      });
      if (ledger.skipped) {
        throw httpError(
          409,
          "SUBSCRIPTION_STATE_LEDGER_MISMATCH",
          "Ledger đã tồn tại nhưng subscription không khớp",
        );
      }

      await AuditLog.create(
        [
          {
            actorId: userId,
            actorRole: req.user.role || "user",
            action: "purchase_trainer_plan",
            targetType: "trainer_subscription",
            targetId: subscription._id,
            metadata: {
              planTitle,
              billingCycle,
              amount,
              requestId,
              balanceBefore: ledger.balanceBefore,
              balanceAfter: ledger.balanceAfter,
            },
            ipAddress: req.ip,
            userAgent: req.get("User-Agent"),
          },
        ],
        { session },
      );
      outcome = { subscription, balanceAfter: ledger.balanceAfter };
    });

    return res
      .status(201)
      .json(purchaseResponse(outcome.subscription, outcome.balanceAfter));
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    if (error.code === 11000 || error.code === "PURCHASE_RETRY_PENDING") {
      const prior = await findPriorPurchase(userId, requestId).catch(() => null);
      if (prior) {
        incrementMetric("financial.idempotency_hits");
        return res
          .status(200)
          .json(purchaseResponse(prior.subscription, prior.balanceAfter, true));
      }
      const active = await TrainerSubscription.findOne({
        userId,
        isActive: true,
      }).lean();
      if (active) {
        return res.status(409).json({
          success: false,
          code: "ACTIVE_SUBSCRIPTION_EXISTS",
          message: "Bạn đang có gói huấn luyện viên còn hiệu lực",
        });
      }
    }

    safeLog.error("financial.trainer_purchase_failed", error);
    const status =
      error instanceof WalletLedgerError
        ? error.status
        : error.status || (error.code === 11000 ? 409 : 500);
    return res.status(status).json({
      success: false,
      code:
        error instanceof WalletLedgerError
          ? error.code
          : error.code || "TRAINER_PURCHASE_FAILED",
      message: status >= 500 ? "Lỗi hệ thống khi mua gói" : error.message,
    });
  } finally {
    await session.endSession();
  }
};

// GET /api/trainer-subscriptions/my
export const getMySubscription = async (req, res) => {
  try {
    const subscription = await TrainerSubscription.findOne({
      userId: req.user.id,
      isActive: true,
      endDate: { $gt: new Date() },
    })
      .sort({ createdAt: -1 })
      .lean();
    return res.status(200).json({ success: true, data: subscription || null });
  } catch (error) {
    safeLog.error("financial.subscription_read_failed", error);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống" });
  }
};

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

      const transitioned = await TrainerSubscription.updateOne(
        { _id: subscription._id, status: "active", isActive: true },
        {
          $set: {
            status: "cancelled",
            isActive: false,
            cancelledAt: new Date(),
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
