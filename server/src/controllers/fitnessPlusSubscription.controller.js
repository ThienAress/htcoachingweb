import User from "../models/User.js";
import {
  getFitnessPlusCatalogMeta,
  getFitnessPlusPlan,
  listFitnessPlusPlans,
} from "../services/fitnessPlusCatalog.service.js";
import {
  getActiveFitnessPlusSubscription,
  purchaseFitnessPlusSubscription,
} from "../services/fitnessPlusSubscription.service.js";
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

export const getFitnessPlusCatalog = (_req, res) =>
  res.status(200).json({
    success: true,
    data: listFitnessPlusPlans(),
    meta: getFitnessPlusCatalogMeta(),
  });

export const purchaseFitnessPlusPlan = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("_id role").lean();
    if (!user) {
      return res.status(401).json({
        success: false,
        code: "FITNESS_PLUS_USER_NOT_FOUND",
        message: "Tài khoản không còn tồn tại",
      });
    }
    const outcome = await purchaseFitnessPlusSubscription({
      user,
      body: req.body,
      request: req,
    });
    const { subscription, balanceAfter, skipped } = outcome;
    return res.status(skipped ? 200 : 201).json({
      success: true,
      skipped,
      message: skipped
        ? "Yêu cầu thanh toán HT Fitness+ này đã được xử lý trước đó"
        : "Đã kích hoạt gói HT Fitness+ thành công",
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
    safeLog.error("financial.fitness_plus_purchase_failed", error);
    return sendError(
      res,
      error,
      "FITNESS_PLUS_PURCHASE_FAILED",
      "Lỗi hệ thống khi kích hoạt gói HT Fitness+",
    );
  }
};

export const getMyFitnessPlusSubscription = async (req, res) => {
  try {
    const subscription = await getActiveFitnessPlusSubscription(req.user.id);
    const plan = getFitnessPlusPlan(subscription?.planCode);
    return res.status(200).json({
      success: true,
      data: subscription
        ? {
            ...subscription,
            entitlements: { ...(plan?.entitlements || {}) },
            features: plan?.features || [],
          }
        : null,
    });
  } catch (error) {
    safeLog.error("fitness_plus.subscription_read_failed", error);
    return sendError(
      res,
      error,
      "FITNESS_PLUS_SUBSCRIPTION_READ_FAILED",
      "Lỗi hệ thống khi đọc gói HT Fitness+",
    );
  }
};
