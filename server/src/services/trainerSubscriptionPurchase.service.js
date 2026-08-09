import mongoose from "mongoose";
import WalletTransaction from "../models/WalletTransaction.js";
import TrainerSubscription from "../models/TrainerSubscription.js";
import AuditLog from "../models/AuditLog.js";
import { applyWalletEntry } from "./walletLedger.service.js";
import {
  getTrainerPlan,
  resolveTrainerPlanCode,
} from "./trainerPlanCatalog.service.js";
import { assertTrainerCatalogConfirmation } from "./trainerCatalogConfirmation.service.js";
import {
  activateTrainerSubscription,
  hasExistingOrderForTrainerFree,
  trainerSubscriptionError,
} from "./trainerSubscriptionLifecycle.service.js";
import { sendTrainerSubscriptionActivatedMail } from "../utils/sendMail.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const findPriorPurchase = async (userId, requestId) => {
  const subscription = await TrainerSubscription.findOne({
    userId,
    purchaseRequestId: requestId,
  }).lean();
  if (!subscription) return null;
  if (subscription.planCode === "free" || subscription.billingCycle === "trial") {
    return { subscription, balanceAfter: null };
  }

  const transaction = await WalletTransaction.findOne({
    idempotencyKey: `trainer-subscription:${userId}:${requestId}`,
  }).lean();
  if (!transaction) {
    throw trainerSubscriptionError(
      409,
      "SUBSCRIPTION_LEDGER_MISSING",
      "Gói đã tồn tại nhưng thiếu giao dịch ví; cần đối soát",
    );
  }
  return { subscription, balanceAfter: transaction.balanceAfter };
};

export const purchaseTrainerSubscription = async ({ user, body, request }) => {
  const requestId = String(body?.requestId || "");
  if (!UUID_PATTERN.test(requestId)) {
    throw trainerSubscriptionError(
      400,
      "INVALID_PURCHASE_REQUEST_ID",
      "requestId thanh toán không hợp lệ",
    );
  }

  const prior = await findPriorPurchase(user._id, requestId);
  if (prior) return { ...prior, skipped: true };

  const planCode = resolveTrainerPlanCode(body?.planCode || body?.planTitle);
  const plan = getTrainerPlan(planCode);
  if (!plan) {
    throw trainerSubscriptionError(
      400,
      "INVALID_TRAINER_PLAN",
      "Gói huấn luyện viên không tồn tại",
    );
  }

  const billingCycle = body?.billingCycle;
  if (!plan.billingCycles.includes(billingCycle)) {
    throw trainerSubscriptionError(
      400,
      "INVALID_BILLING_CYCLE",
      "Chu kỳ thanh toán không hợp lệ với gói đã chọn",
    );
  }

  assertTrainerCatalogConfirmation({
    body,
    planCode,
    billingCycle,
  });

  const session = await mongoose.startSession();
  let outcome;
  try {
    await session.withTransaction(async () => {
      const repeated = await TrainerSubscription.findOne({
        userId: user._id,
        purchaseRequestId: requestId,
      })
        .session(session)
        .lean();
      if (repeated) {
        throw trainerSubscriptionError(
          409,
          "PURCHASE_RETRY_PENDING",
          "Yêu cầu thanh toán đang được xử lý",
        );
      }

      if (
        planCode === "free" &&
        (await hasExistingOrderForTrainerFree({
          userId: user._id,
          email: user.email,
          session,
        }))
      ) {
        throw trainerSubscriptionError(
          409,
          "TRAINER_FREE_ORDER_EXISTS",
          "Tài khoản đã có đơn huấn luyện và không đủ điều kiện dùng gói miễn phí",
        );
      }

      const subscription = await activateTrainerSubscription({
        session,
        userId: user._id,
        email: user.email,
        planCode,
        billingCycle,
        source: planCode === "free" ? "free_trial" : "self_purchase",
        purchaseRequestId: requestId,
        supersedeActive: false,
        supersedeFreeOnly: planCode !== "free",
      });

      let balanceAfter = null;
      if (subscription.amount > 0) {
        const ledger = await applyWalletEntry({
          session,
          userId: user._id,
          amount: -subscription.amount,
          type: "purchase",
          referenceType: "trainer_subscription",
          referenceId: subscription._id,
          idempotencyKey: `trainer-subscription:${user._id}:${requestId}`,
          metadata: {
            planCode,
            planTitle: subscription.planTitle,
            billingCycle,
            subscriptionId: subscription._id,
          },
        });
        if (ledger.skipped) {
          throw trainerSubscriptionError(
            409,
            "SUBSCRIPTION_STATE_LEDGER_MISMATCH",
            "Giao dịch ví đã tồn tại nhưng gói không khớp",
          );
        }
        balanceAfter = ledger.balanceAfter;
      }

      await AuditLog.create(
        [
          {
            actorId: user._id,
            actorRole: user.role || "user",
            action: "purchase_trainer_plan",
            targetType: "trainer_subscription",
            targetId: subscription._id,
            metadata: {
              planCode,
              billingCycle,
              amount: subscription.amount,
              requestId,
              balanceAfter,
            },
            ipAddress: request?.ip,
            userAgent: request?.get?.("User-Agent"),
          },
        ],
        { session },
      );
      outcome = { subscription, balanceAfter, skipped: false };
    });
  } catch (error) {
    if (error?.code === 11000 && planCode === "free") {
      throw trainerSubscriptionError(
        409,
        "FREE_TRIAL_ALREADY_USED",
        "Tài khoản này đã sử dụng gói dùng thử miễn phí",
      );
    }
    if (error?.code === 11000 || error?.code === "PURCHASE_RETRY_PENDING") {
      const repeated = await findPriorPurchase(user._id, requestId).catch(
        () => null,
      );
      if (repeated) return { ...repeated, skipped: true };
    }
    throw error;
  } finally {
    await session.endSession();
  }

  await sendTrainerSubscriptionActivatedMail(user.email, {
    name: user.name,
    subscription: outcome.subscription,
  });
  return outcome;
};
