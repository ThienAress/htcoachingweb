import mongoose from "mongoose";
import WalletTransaction from "../models/WalletTransaction.js";
import TrainerSubscription from "../models/TrainerSubscription.js";
import AuditLog from "../models/AuditLog.js";
import { publicErrorMessage } from "../utils/errorMessages.js";
import { applyWalletEntry } from "./walletLedger.service.js";
import {
  getTrainerPlan,
  getTrainerPlanAmount,
  resolveTrainerPlanCode,
} from "./trainerPlanCatalog.service.js";
import { assertTrainerCatalogConfirmation } from "./trainerCatalogConfirmation.service.js";
import {
  activateTrainerSubscription,
  hasExistingOrderForTrainerFree,
  trainerSubscriptionError,
} from "./trainerSubscriptionLifecycle.service.js";
import { sendTrainerSubscriptionActivatedMail } from "../utils/sendMail.js";
import { resolveTrainerPurchasePricing } from "./trainerPurchasePricing.js";

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

  // Báo giá trước giao dịch: chặn sớm các trường hợp không được mua và xác nhận số tiền đã trừ phần gói tháng chưa dùng.
  const now = new Date();
  let quotedAmount;
  if (planCode !== "free") {
    const currentSubscription = await TrainerSubscription.findOne({
      userId: user._id,
      isActive: true,
    }).lean();
    quotedAmount = resolveTrainerPurchasePricing({
      active: currentSubscription,
      activePlan: currentSubscription
        ? getTrainerPlan(currentSubscription.planCode || currentSubscription.planTitle)
        : null,
      plan,
      billingCycle,
      now,
    }).amount;
  }
  assertTrainerCatalogConfirmation({
    body,
    planCode,
    billingCycle,
    amount: quotedAmount,
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
        resolvePricing: resolveTrainerPurchasePricing,
        expectedAmount: body.expectedAmount,
        now,
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
            listAmount: subscription.listAmount,
            upgradeCreditAmount: subscription.upgradeCreditAmount,
            previousSubscriptionId: subscription.previousSubscriptionId,
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
              listAmount: subscription.listAmount,
              upgradeCreditAmount: subscription.upgradeCreditAmount,
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

// Báo giá cho giao diện: không ghi dữ liệu. Trường hợp không được mua trả eligible=false kèm mã và thông báo.
export const getTrainerPurchaseQuote = async ({ userId, planCode, billingCycle, now = new Date() }) => {
  const plan = getTrainerPlan(resolveTrainerPlanCode(planCode));
  if (!plan || plan.code === "free") {
    throw trainerSubscriptionError(400, "INVALID_TRAINER_PLAN", "Gói huấn luyện viên không tồn tại");
  }
  if (!plan.billingCycles.includes(billingCycle)) {
    throw trainerSubscriptionError(400, "INVALID_BILLING_CYCLE", "Chu kỳ thanh toán không hợp lệ với gói đã chọn");
  }
  const active = await TrainerSubscription.findOne({ userId, isActive: true }).lean();
  const activePlan = active ? getTrainerPlan(active.planCode || active.planTitle) : null;
  const current = active
    ? { planCode: activePlan?.code || null, billingCycle: active.billingCycle, endDate: active.endDate }
    : null;
  try {
    const pricing = resolveTrainerPurchasePricing({ active, activePlan, plan, billingCycle, now });
    return { eligible: true, planCode: plan.code, billingCycle, current, ...pricing };
  } catch (error) {
    if (error.status !== 409) throw error;
    return {
      eligible: false,
      code: error.code,
      message: publicErrorMessage(error, "Bạn chưa thể mua gói này lúc này."),
      planCode: plan.code,
      billingCycle,
      current,
      listAmount: getTrainerPlanAmount(plan.code, billingCycle),
    };
  }
};
