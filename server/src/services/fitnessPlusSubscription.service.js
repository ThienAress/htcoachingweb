import mongoose from "mongoose";

import AuditLog from "../models/AuditLog.js";
import FitnessSubscription from "../models/FitnessSubscription.js";
import WalletTransaction from "../models/WalletTransaction.js";
import {
  SERVICE_ACCESS_POLICY_VERSION,
  createServiceEntitlementSnapshot,
} from "../constants/serviceAccessPolicies.js";
import { publicErrorMessage } from "../utils/errorMessages.js";
import { applyWalletEntry } from "./walletLedger.service.js";
import {
  calculateFitnessPlusPlanEndDate,
  getFitnessPlusPlan,
  getFitnessPlusPlanAmount,
  getFitnessPlusCatalogMeta,
  resolveFitnessPlusPlanCode,
} from "./fitnessPlusCatalog.service.js";
import { resolveFitnessPlusPurchasePricing } from "./fitnessPlusPurchasePricing.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const fitnessPlusSubscriptionError = (status, code, message) =>
  Object.assign(new Error(message), { status, code });

export const assertFitnessPlusCatalogConfirmation = ({
  body,
  planCode,
  billingCycle,
  amount,
}) => {
  const meta = getFitnessPlusCatalogMeta();
  // amount: số tiền server đã tính (có thể đã trừ phần gói tháng chưa dùng); mặc định là giá niêm yết.
  const canonicalAmount = amount ?? getFitnessPlusPlanAmount(planCode, billingCycle);
  const confirmed =
    body?.protocolVersion === meta.protocolVersion &&
    body?.catalogFingerprint === meta.catalogFingerprint &&
    body?.expectedAmount === canonicalAmount;
  if (!confirmed) {
    throw fitnessPlusSubscriptionError(
      409,
      "FITNESS_PLUS_CATALOG_CHANGED",
      "Bảng giá HT Fitness+ đã thay đổi. Vui lòng tải lại và xác nhận giá mới.",
    );
  }
  return canonicalAmount;
};

const findPriorPurchase = async (userId, requestId) => {
  const subscription = await FitnessSubscription.findOne({
    userId,
    purchaseRequestId: requestId,
  }).lean();
  if (!subscription) return null;

  const transaction = await WalletTransaction.findOne({
    idempotencyKey: `fitness-plus:${userId}:${requestId}`,
  }).lean();
  if (!transaction) {
    throw fitnessPlusSubscriptionError(
      409,
      "FITNESS_PLUS_LEDGER_MISSING",
      "Gói đã tồn tại nhưng thiếu giao dịch ví; cần đối soát",
    );
  }
  return { subscription, balanceAfter: transaction.balanceAfter };
};

export const activateFitnessPlusSubscription = async ({
  session,
  userId,
  planCode,
  billingCycle,
  purchaseRequestId,
  expectedAmount,
  now = new Date(),
}) => {
  const plan = getFitnessPlusPlan(planCode);
  if (!plan) {
    throw fitnessPlusSubscriptionError(
      400,
      "INVALID_FITNESS_PLUS_PLAN",
      "Gói HT Fitness+ không tồn tại",
    );
  }
  if (!plan.billingCycles.includes(billingCycle)) {
    throw fitnessPlusSubscriptionError(
      400,
      "INVALID_FITNESS_PLUS_BILLING_CYCLE",
      "Chu kỳ thanh toán không hợp lệ với gói HT Fitness+",
    );
  }

  let active = await FitnessSubscription.findOne({
    userId,
    isActive: true,
  })
    .session(session)
    .lean();
  const previousSubscription = active;
  if (active && active.endDate <= now) {
    await FitnessSubscription.updateOne(
      { _id: active._id, isActive: true },
      { $set: { status: "expired", isActive: false } },
      { session },
    );
    active = null;
  }
  const pricing = resolveFitnessPlusPurchasePricing({ active, plan, billingCycle, now });
  if (expectedAmount !== undefined && expectedAmount !== pricing.amount) {
    // Gói hiện tại đổi giữa lúc báo giá và lúc thanh toán: không trừ ví, yêu cầu xác nhận lại giá.
    throw fitnessPlusSubscriptionError(
      409,
      "FITNESS_PLUS_CATALOG_CHANGED",
      "Giá nâng cấp đã thay đổi. Vui lòng tải lại và xác nhận giá mới.",
    );
  }

  if (active) {
    await FitnessSubscription.updateOne(
      { _id: active._id, isActive: true },
      {
        $set: {
          status: "superseded",
          isActive: false,
          supersededAt: now,
        },
      },
      { session },
    );
  }

  const [subscription] = await FitnessSubscription.create(
    [
      {
        userId,
        planCode: plan.code,
        planTitle: plan.title,
        billingCycle,
        amount: pricing.amount,
        listAmount: pricing.listAmount,
        upgradeCreditAmount: pricing.creditAmount,
        startDate: now,
        endDate: calculateFitnessPlusPlanEndDate(plan.code, billingCycle, now),
        status: "active",
        source: "self_purchase",
        purchaseRequestId,
        previousSubscriptionId: previousSubscription?._id || null,
        entitlementPolicyVersion: SERVICE_ACCESS_POLICY_VERSION,
        entitlementPolicySnapshot: createServiceEntitlementSnapshot(plan.code),
      },
    ],
    { session },
  );

  if (active) {
    await FitnessSubscription.updateOne(
      { _id: active._id },
      { $set: { supersededBy: subscription._id } },
      { session },
    );
  }

  return subscription;
};

export const purchaseFitnessPlusSubscription = async ({
  user,
  body,
  request,
}) => {
  const requestId = String(body?.requestId || "");
  if (!UUID_PATTERN.test(requestId)) {
    throw fitnessPlusSubscriptionError(
      400,
      "INVALID_FITNESS_PLUS_REQUEST_ID",
      "requestId thanh toán không hợp lệ",
    );
  }

  const prior = await findPriorPurchase(user._id, requestId);
  if (prior) return { ...prior, skipped: true };

  const planCode = resolveFitnessPlusPlanCode(body?.planCode || body?.planTitle);
  const plan = getFitnessPlusPlan(planCode);
  if (!plan) {
    throw fitnessPlusSubscriptionError(
      400,
      "INVALID_FITNESS_PLUS_PLAN",
      "Gói HT Fitness+ không tồn tại",
    );
  }
  const billingCycle = body?.billingCycle;
  const now = new Date();
  // Báo giá trước giao dịch: chặn sớm các trường hợp không hợp lệ và xác nhận số tiền đã trừ phần gói tháng chưa dùng.
  const currentSubscription = await getActiveFitnessPlusSubscription(user._id, now);
  const quote = plan.billingCycles.includes(billingCycle)
    ? resolveFitnessPlusPurchasePricing({ active: currentSubscription, plan, billingCycle, now })
    : null;
  const amount = assertFitnessPlusCatalogConfirmation({
    body,
    planCode,
    billingCycle,
    amount: quote?.amount,
  });

  const session = await mongoose.startSession();
  let outcome;
  try {
    await session.withTransaction(async () => {
      const repeated = await FitnessSubscription.findOne({
        userId: user._id,
        purchaseRequestId: requestId,
      })
        .session(session)
        .lean();
      if (repeated) {
        throw fitnessPlusSubscriptionError(
          409,
          "FITNESS_PLUS_PURCHASE_RETRY_PENDING",
          "Yêu cầu thanh toán HT Fitness+ đang được xử lý",
        );
      }

      const subscription = await activateFitnessPlusSubscription({
        session,
        userId: user._id,
        planCode,
        billingCycle,
        purchaseRequestId: requestId,
        expectedAmount: amount,
        now,
      });

      const ledger = await applyWalletEntry({
        session,
        userId: user._id,
        amount: -subscription.amount,
        type: "purchase",
        referenceType: "fitness_subscription",
        referenceId: subscription._id,
        idempotencyKey: `fitness-plus:${user._id}:${requestId}`,
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
        throw fitnessPlusSubscriptionError(
          409,
          "FITNESS_PLUS_LEDGER_STATE_MISMATCH",
          "Giao dịch ví đã tồn tại nhưng gói HT Fitness+ không khớp",
        );
      }

      await AuditLog.create(
        [
          {
            actorId: user._id,
            actorRole: user.role || "user",
            action: "purchase_fitness_plus_plan",
            targetType: "fitness_subscription",
            targetId: subscription._id,
            metadata: {
              planCode,
              billingCycle,
              amount: subscription.amount,
              listAmount: subscription.listAmount,
              upgradeCreditAmount: subscription.upgradeCreditAmount,
              requestId,
              balanceAfter: ledger.balanceAfter,
            },
            ipAddress: request?.ip,
            userAgent: request?.get?.("User-Agent"),
          },
        ],
        { session },
      );
      outcome = {
        subscription,
        balanceAfter: ledger.balanceAfter,
        skipped: false,
      };
    });
  } catch (error) {
    const isDuplicateKey = error?.code === 11000;
    if (isDuplicateKey || error?.code === "FITNESS_PLUS_PURCHASE_RETRY_PENDING") {
      const repeated = await findPriorPurchase(user._id, requestId).catch(
        () => null,
      );
      if (repeated) return { ...repeated, skipped: true };
    }
    if (isDuplicateKey) {
      throw fitnessPlusSubscriptionError(
        409,
        "FITNESS_PLUS_PURCHASE_CONFLICT",
        "Gói HT Fitness+ vừa thay đổi. Vui lòng tải lại trước khi thử lại.",
      );
    }
    throw error;
  } finally {
    await session.endSession();
  }

  return outcome;
};

export const getActiveFitnessPlusSubscription = async (userId, now = new Date()) =>
  FitnessSubscription.findOne({
    userId,
    isActive: true,
    endDate: { $gt: now },
  })
    .select(
      "_id planCode planTitle billingCycle amount startDate endDate status createdAt updatedAt",
    )
    .sort({ createdAt: -1 })
    .lean();

// Báo giá cho giao diện: không ghi dữ liệu. Trường hợp không được mua trả eligible=false kèm mã và thông báo.
export const getFitnessPlusPurchaseQuote = async ({ userId, planCode, billingCycle, now = new Date() }) => {
  const resolvedCode = resolveFitnessPlusPlanCode(planCode);
  const plan = getFitnessPlusPlan(resolvedCode);
  if (!plan) {
    throw fitnessPlusSubscriptionError(400, "INVALID_FITNESS_PLUS_PLAN", "Gói HT Fitness+ không tồn tại");
  }
  if (!plan.billingCycles.includes(billingCycle)) {
    throw fitnessPlusSubscriptionError(
      400,
      "INVALID_FITNESS_PLUS_BILLING_CYCLE",
      "Chu kỳ thanh toán không hợp lệ với gói HT Fitness+",
    );
  }
  const active = await getActiveFitnessPlusSubscription(userId, now);
  const current = active
    ? { planCode: active.planCode, billingCycle: active.billingCycle, endDate: active.endDate }
    : null;
  try {
    const pricing = resolveFitnessPlusPurchasePricing({ active, plan, billingCycle, now });
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
      listAmount: getFitnessPlusPlanAmount(plan.code, billingCycle),
    };
  }
};
