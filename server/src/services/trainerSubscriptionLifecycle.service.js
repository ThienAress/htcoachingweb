import TrainerSubscription from "../models/TrainerSubscription.js";
import TrainerTrialClaim from "../models/TrainerTrialClaim.js";
import Order from "../models/Order.js";
import {
  SERVICE_ACCESS_POLICY_VERSION,
  SERVICE_ACCESS_TIERS,
  createServiceEntitlementSnapshot,
} from "../constants/serviceAccessPolicies.js";
import {
  calculateTrainerPlanEndDate,
  getTrainerPlan,
  getTrainerPlanAmount,
} from "./trainerPlanCatalog.service.js";

export const normalizeTrainerEmail = (email) =>
  String(email || "").trim().toLowerCase();

export const hasExistingOrderForTrainerFree = async ({
  userId,
  email,
  session = null,
}) => {
  const normalizedEmail = normalizeTrainerEmail(email);
  const identityFilters = [];
  if (userId) identityFilters.push({ userId });
  if (normalizedEmail) identityFilters.push({ email: normalizedEmail });
  if (identityFilters.length === 0) return false;

  const query = Order.exists({ $or: identityFilters });
  if (session) query.session(session);
  return Boolean(await query);
};

export const trainerSubscriptionError = (status, code, message) =>
  Object.assign(new Error(message), { status, code });

export const calculateRetentionDeadlines = (accessEndedAt = new Date()) => {
  const mediaRetentionExpiresAt = new Date(accessEndedAt);
  mediaRetentionExpiresAt.setDate(mediaRetentionExpiresAt.getDate() + 90);

  const structuredRetentionExpiresAt = new Date(accessEndedAt);
  structuredRetentionExpiresAt.setMonth(
    structuredRetentionExpiresAt.getMonth() + 12,
  );

  return { mediaRetentionExpiresAt, structuredRetentionExpiresAt };
};

export const activateTrainerSubscription = async ({
  session,
  userId,
  email,
  planCode,
  billingCycle,
  source,
  purchaseRequestId = null,
  supersedeActive = false,
  supersedeFreeOnly = false,
  now = new Date(),
}) => {
  const plan = getTrainerPlan(planCode);
  if (!plan) {
    throw trainerSubscriptionError(
      400,
      "INVALID_TRAINER_PLAN",
      "Gói huấn luyện viên không tồn tại",
    );
  }
  if (!plan.billingCycles.includes(billingCycle)) {
    throw trainerSubscriptionError(
      400,
      "INVALID_BILLING_CYCLE",
      "Chu kỳ thanh toán không hợp lệ với gói đã chọn",
    );
  }

  const normalizedEmail = normalizeTrainerEmail(email);
  if (!normalizedEmail) {
    throw trainerSubscriptionError(
      400,
      "TRAINER_EMAIL_REQUIRED",
      "Tài khoản chưa có email hợp lệ",
    );
  }

  if (plan.code === "free") {
    const trialUsed = await TrainerTrialClaim.exists({ normalizedEmail }).session(
      session,
    );
    if (trialUsed) {
      throw trainerSubscriptionError(
        409,
        "FREE_TRIAL_ALREADY_USED",
        "Tài khoản này đã sử dụng gói dùng thử miễn phí",
      );
    }
  }

  const active = await TrainerSubscription.findOne({
    userId,
    isActive: true,
  }).session(session);
  const activePlan = active
    ? getTrainerPlan(active.planCode || active.planTitle)
    : null;
  const canSupersedeFree = supersedeFreeOnly && activePlan?.code === "free";
  if (active && !supersedeActive && !canSupersedeFree) {
    throw trainerSubscriptionError(
      409,
      "ACTIVE_SUBSCRIPTION_EXISTS",
      "Bạn đang có gói huấn luyện viên còn hiệu lực",
    );
  }

  if (active) {
    active.status = "superseded";
    active.supersededAt = now;
    await active.save({ session });
  }

  const [subscription] = await TrainerSubscription.create(
    [
      {
        userId,
        normalizedEmail,
        planCode: plan.code,
        planTitle: plan.title,
        billingCycle,
        amount: getTrainerPlanAmount(plan.code, billingCycle),
        startDate: now,
        endDate: calculateTrainerPlanEndDate(plan.code, billingCycle, now),
        status: "active",
        source,
        purchaseRequestId,
        previousSubscriptionId: active?._id || null,
        entitlementPolicyVersion: SERVICE_ACCESS_POLICY_VERSION,
        entitlementPolicySnapshot: createServiceEntitlementSnapshot(
          SERVICE_ACCESS_TIERS.TRAINER,
        ),
      },
    ],
    { session },
  );

  if (active) {
    active.supersededBy = subscription._id;
    await active.save({ session });
  }

  if (plan.code === "free") {
    await TrainerTrialClaim.create(
      [
        {
          normalizedEmail,
          userId,
          subscriptionId: subscription._id,
          source,
          claimedAt: now,
        },
      ],
      { session },
    );
  }

  return subscription;
};
