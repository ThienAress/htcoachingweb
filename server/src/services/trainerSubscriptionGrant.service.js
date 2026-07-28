import mongoose from "mongoose";
import User from "../models/User.js";
import AuditLog from "../models/AuditLog.js";
import PendingTrainerGrant from "../models/PendingTrainerGrant.js";
import TrainerTrialClaim from "../models/TrainerTrialClaim.js";
import { escapeRegex } from "../utils/escapeRegex.js";
import {
  sendTrainerGrantInvitationMail,
  sendTrainerSubscriptionActivatedMail,
} from "../utils/sendMail.js";
import { getTrainerPlan } from "./trainerPlanCatalog.service.js";
import {
  activateTrainerSubscription,
  normalizeTrainerEmail,
  trainerSubscriptionError,
} from "./trainerSubscriptionLifecycle.service.js";

const findUserByNormalizedEmail = async (normalizedEmail) => {
  const exact = await User.findOne({ email: normalizedEmail });
  if (exact) return exact;
  return User.findOne({
    email: new RegExp(`^${escapeRegex(normalizedEmail)}$`, "i"),
  });
};

const assertGrantInput = ({ email, planCode, billingCycle }) => {
  const normalizedEmail = normalizeTrainerEmail(email);
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(normalizedEmail) || normalizedEmail.length > 320) {
    throw trainerSubscriptionError(
      400,
      "INVALID_GRANT_EMAIL",
      "Email cấp gói không hợp lệ",
    );
  }

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
  return { normalizedEmail, plan };
};

export const grantTrainerPlanByEmail = async ({
  email,
  planCode,
  billingCycle,
  admin,
  request,
}) => {
  const { normalizedEmail, plan } = assertGrantInput({
    email,
    planCode,
    billingCycle,
  });
  if (
    plan.code === "free" &&
    (await TrainerTrialClaim.exists({ normalizedEmail }))
  ) {
    throw trainerSubscriptionError(
      409,
      "FREE_TRIAL_ALREADY_USED",
      "Tài khoản này đã sử dụng gói dùng thử miễn phí",
    );
  }
  const user = await findUserByNormalizedEmail(normalizedEmail);

  if (!user) {
    try {
      const pending = await PendingTrainerGrant.create({
        email: normalizedEmail,
        normalizedEmail,
        planCode: plan.code,
        billingCycle,
        grantedBy: admin._id,
      });
      await AuditLog.create({
        actorId: admin._id,
        actorRole: admin.role,
        action: "create_pending_trainer_grant",
        targetType: "pending_trainer_grant",
        targetId: pending._id,
        metadata: { normalizedEmail, planCode: plan.code, billingCycle },
        ipAddress: request?.ip,
        userAgent: request?.get?.("User-Agent"),
      });
      await sendTrainerGrantInvitationMail(normalizedEmail, {
        plan,
        billingCycle,
      });
      return { status: "pending", grant: pending };
    } catch (error) {
      if (error?.code === 11000) {
        throw trainerSubscriptionError(
          409,
          "PENDING_TRAINER_GRANT_EXISTS",
          "Email này đã có một gói đang chờ nhận",
        );
      }
      throw error;
    }
  }

  const existingPending = await PendingTrainerGrant.exists({
    normalizedEmail,
    status: "pending",
  });
  if (existingPending) {
    throw trainerSubscriptionError(
      409,
      "PENDING_TRAINER_GRANT_EXISTS",
      "Email này đã có một gói đang chờ nhận. Hãy thu hồi gói chờ trước khi cấp gói mới.",
    );
  }

  const session = await mongoose.startSession();
  let subscription;
  try {
    await session.withTransaction(async () => {
      subscription = await activateTrainerSubscription({
        session,
        userId: user._id,
        email: normalizedEmail,
        planCode: plan.code,
        billingCycle,
        source: "admin_grant",
        supersedeActive: true,
      });
      await AuditLog.create(
        [
          {
            actorId: admin._id,
            actorRole: admin.role,
            action: "grant_trainer_plan",
            targetType: "trainer_subscription",
            targetId: subscription._id,
            metadata: { normalizedEmail, planCode: plan.code, billingCycle },
            ipAddress: request?.ip,
            userAgent: request?.get?.("User-Agent"),
          },
        ],
        { session },
      );
    });
  } catch (error) {
    if (error?.code === 11000 && plan.code === "free") {
      throw trainerSubscriptionError(
        409,
        "FREE_TRIAL_ALREADY_USED",
        "Tài khoản này đã sử dụng gói dùng thử miễn phí",
      );
    }
    throw error;
  } finally {
    await session.endSession();
  }

  await sendTrainerSubscriptionActivatedMail(normalizedEmail, {
    name: user.name,
    subscription,
  });
  return { status: "activated", subscription };
};

export const claimPendingTrainerGrantForUser = async (user) => {
  const normalizedEmail = normalizeTrainerEmail(user?.email);
  if (!normalizedEmail) return null;

  const pending = await PendingTrainerGrant.findOne({
    normalizedEmail,
    status: "pending",
  });
  if (!pending) return null;

  const session = await mongoose.startSession();
  let subscription;
  try {
    await session.withTransaction(async () => {
      const current = await PendingTrainerGrant.findOne({
        _id: pending._id,
        status: "pending",
      }).session(session);
      if (!current) return;

      subscription = await activateTrainerSubscription({
        session,
        userId: user._id,
        email: normalizedEmail,
        planCode: current.planCode,
        billingCycle: current.billingCycle,
        source: "pending_grant",
        supersedeActive: true,
      });
      current.status = "claimed";
      current.claimedBy = user._id;
      current.subscriptionId = subscription._id;
      current.claimedAt = new Date();
      await current.save({ session });

      await AuditLog.create(
        [
          {
            actorId: user._id,
            actorRole: user.role || "user",
            action: "claim_pending_trainer_grant",
            targetType: "pending_trainer_grant",
            targetId: current._id,
            metadata: {
              planCode: current.planCode,
              billingCycle: current.billingCycle,
              subscriptionId: subscription._id,
            },
          },
        ],
        { session },
      );
    });
  } finally {
    await session.endSession();
  }

  if (!subscription) return null;
  await sendTrainerSubscriptionActivatedMail(normalizedEmail, {
    name: user.name,
    subscription,
  });
  return subscription;
};

export const listPendingTrainerGrants = ({ page = 1, limit = 20 }) => {
  const safePage = Math.max(Number.parseInt(page, 10) || 1, 1);
  const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), 50);
  const query = { status: "pending" };
  return Promise.all([
    PendingTrainerGrant.find(query)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    PendingTrainerGrant.countDocuments(query),
  ]).then(([data, total]) => ({
    data,
    pagination: {
      total,
      totalPages: Math.ceil(total / safeLimit) || 1,
      currentPage: safePage,
    },
  }));
};

export const revokePendingTrainerGrant = async ({ grantId, admin }) => {
  const grant = await PendingTrainerGrant.findOneAndUpdate(
    { _id: grantId, status: "pending" },
    {
      $set: {
        status: "revoked",
        revokedAt: new Date(),
        revokedBy: admin._id,
      },
    },
    { new: true, runValidators: true },
  );
  if (!grant) {
    throw trainerSubscriptionError(
      404,
      "PENDING_TRAINER_GRANT_NOT_FOUND",
      "Không tìm thấy gói đang chờ để thu hồi",
    );
  }
  await AuditLog.create({
    actorId: admin._id,
    actorRole: admin.role,
    action: "revoke_pending_trainer_grant",
    targetType: "pending_trainer_grant",
    targetId: grant._id,
    metadata: { normalizedEmail: grant.normalizedEmail },
  });
  return grant;
};
