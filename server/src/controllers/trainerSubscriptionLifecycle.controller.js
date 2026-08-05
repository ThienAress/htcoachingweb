import User from "../models/User.js";
import TrainerSubscription from "../models/TrainerSubscription.js";
import TrainerTrialClaim from "../models/TrainerTrialClaim.js";
import {
  getTrainerPlan,
  getTrainerPlanCatalogMeta,
  listTrainerPlans,
} from "../services/trainerPlanCatalog.service.js";
import { purchaseTrainerSubscription } from "../services/trainerSubscriptionPurchase.service.js";
import {
  grantTrainerPlanByEmail,
  listPendingTrainerGrants,
  revokePendingTrainerGrant,
} from "../services/trainerSubscriptionGrant.service.js";
import {
  hasExistingOrderForTrainerFree,
  normalizeTrainerEmail,
} from "../services/trainerSubscriptionLifecycle.service.js";
import { WalletLedgerError } from "../services/walletLedger.service.js";
import { safeLog } from "../utils/safeLogger.js";

const sendError = (res, error, fallbackCode, fallbackMessage) => {
  const status =
    error instanceof WalletLedgerError
      ? error.status
      : error.status || (error.code === 11000 ? 409 : 500);
  return res.status(status).json({
    success: false,
    code:
      error instanceof WalletLedgerError
        ? error.code
        : error.code || fallbackCode,
    message: status >= 500 ? fallbackMessage : error.message,
  });
};

export const getTrainerPlanCatalog = (_req, res) =>
  res.status(200).json({
    success: true,
    data: listTrainerPlans(),
    meta: getTrainerPlanCatalogMeta(),
  });

export const purchaseTrainerPlan = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const outcome = await purchaseTrainerSubscription({
      user,
      body: req.body,
      request: req,
    });
    const { subscription, balanceAfter, skipped } = outcome;
    return res.status(skipped ? 200 : 201).json({
      success: true,
      skipped,
      message: skipped
        ? "Yêu cầu thanh toán này đã được xử lý trước đó"
        : "Đã kích hoạt gói huấn luyện viên thành công",
      data: {
        subscriptionId: subscription._id,
        planCode: subscription.planCode,
        planTitle: subscription.planTitle,
        billingCycle: subscription.billingCycle,
        amount: subscription.amount,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        newBalance: balanceAfter,
      },
    });
  } catch (error) {
    safeLog.error("financial.trainer_purchase_failed", error);
    return sendError(
      res,
      error,
      "TRAINER_PURCHASE_FAILED",
      "Lỗi hệ thống khi kích hoạt gói",
    );
  }
};

export const getMySubscription = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("email").lean();
    const normalizedEmail = normalizeTrainerEmail(user?.email);
    const [subscription, trialClaim, hasOrder] = await Promise.all([
      TrainerSubscription.findOne({
        userId: req.user.id,
        isActive: true,
        endDate: { $gt: new Date() },
      })
        .sort({ createdAt: -1 })
        .lean(),
      normalizedEmail
        ? TrainerTrialClaim.findOne({ normalizedEmail }).select("claimedAt").lean()
        : null,
      hasExistingOrderForTrainerFree({
        userId: req.user.id,
        email: normalizedEmail,
      }),
    ]);

    const plan = getTrainerPlan(
      subscription?.planCode || subscription?.planTitle,
    );
    const subscriptionData = subscription
      ? {
          ...subscription,
          entitlements: { ...(plan?.entitlements || {}) },
        }
      : null;
    let freeTrialStatus = trialClaim ? "used" : "available";
    if (!trialClaim && hasOrder) freeTrialStatus = "ineligible";
    if (subscription?.planCode === "free") freeTrialStatus = "active";
    const freeTrialReason =
      freeTrialStatus === "ineligible" ? "existing_order" : null;
    return res.status(200).json({
      success: true,
      data: subscriptionData,
      freeTrial: {
        status: freeTrialStatus,
        reason: freeTrialReason,
        claimedAt: trialClaim?.claimedAt || null,
      },
    });
  } catch (error) {
    safeLog.error("financial.subscription_read_failed", error);
    return sendError(
      res,
      error,
      "TRAINER_SUBSCRIPTION_READ_FAILED",
      "Lỗi hệ thống khi đọc gói",
    );
  }
};

export const grantTrainerPlan = async (req, res) => {
  try {
    const admin = await User.findById(req.user.id);
    const result = await grantTrainerPlanByEmail({
      ...req.body,
      admin,
      request: req,
    });
    return res.status(201).json({
      success: true,
      message:
        result.status === "pending"
          ? "Đã lưu gói chờ nhận và gửi email hướng dẫn đăng nhập"
          : "Đã cấp gói và gửi email xác nhận thành công",
      data: result,
    });
  } catch (error) {
    safeLog.error("admin.trainer_grant_failed", error);
    return sendError(
      res,
      error,
      "TRAINER_GRANT_FAILED",
      "Lỗi hệ thống khi cấp gói",
    );
  }
};

export const getPendingTrainerGrants = async (req, res) => {
  try {
    const result = await listPendingTrainerGrants(req.query);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    safeLog.error("admin.pending_trainer_grants_read_failed", error);
    return sendError(
      res,
      error,
      "PENDING_TRAINER_GRANTS_READ_FAILED",
      "Lỗi hệ thống khi đọc danh sách chờ",
    );
  }
};

export const revokeTrainerGrant = async (req, res) => {
  try {
    const admin = await User.findById(req.user.id);
    const grant = await revokePendingTrainerGrant({
      grantId: req.params.id,
      admin,
    });
    return res.status(200).json({
      success: true,
      message: "Đã thu hồi gói đang chờ",
      data: grant,
    });
  } catch (error) {
    safeLog.error("admin.pending_trainer_grant_revoke_failed", error);
    return sendError(
      res,
      error,
      "PENDING_TRAINER_GRANT_REVOKE_FAILED",
      "Lỗi hệ thống khi thu hồi gói",
    );
  }
};
