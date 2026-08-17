import mongoose from "mongoose";

import AuditLog from "../models/AuditLog.js";
import FitnessSubscription from "../models/FitnessSubscription.js";
import WalletTransaction from "../models/WalletTransaction.js";
import { applyWalletEntry } from "./walletLedger.service.js";
import {
  calculateFitnessPlusPlanEndDate,
  getFitnessPlusPlan,
  getFitnessPlusPlanAmount,
  getFitnessPlusCatalogMeta,
  resolveFitnessPlusPlanCode,
} from "./fitnessPlusCatalog.service.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const fitnessPlusSubscriptionError = (status, code, message) =>
  Object.assign(new Error(message), { status, code });

export const assertFitnessPlusCatalogConfirmation = ({
  body,
  planCode,
  billingCycle,
}) => {
  const meta = getFitnessPlusCatalogMeta();
  const canonicalAmount = getFitnessPlusPlanAmount(planCode, billingCycle);
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
  if (active?.planCode === plan.code) {
    throw fitnessPlusSubscriptionError(
      409,
      "FITNESS_PLUS_PLAN_ALREADY_ACTIVE",
      "Bạn đang sử dụng gói HT Fitness+ này",
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
        amount: getFitnessPlusPlanAmount(plan.code, billingCycle),
        startDate: now,
        endDate: calculateFitnessPlusPlanEndDate(plan.code, billingCycle, now),
        status: "active",
        source: "self_purchase",
        purchaseRequestId,
        previousSubscriptionId: previousSubscription?._id || null,
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
  const amount = assertFitnessPlusCatalogConfirmation({
    body,
    planCode,
    billingCycle,
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
      });

      const ledger = await applyWalletEntry({
        session,
        userId: user._id,
        amount: -amount,
        type: "purchase",
        referenceType: "fitness_subscription",
        referenceId: subscription._id,
        idempotencyKey: `fitness-plus:${user._id}:${requestId}`,
        metadata: {
          planCode,
          planTitle: subscription.planTitle,
          billingCycle,
          subscriptionId: subscription._id,
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
              amount,
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
