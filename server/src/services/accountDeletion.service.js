import mongoose from "mongoose";

import AccountDeletionRecord from "../models/AccountDeletionRecord.js";
import AiModerationState from "../models/AiModerationState.js";
import AiToolConfirmation from "../models/AiToolConfirmation.js";
import AuditLog from "../models/AuditLog.js";
import Booking from "../models/Booking.js";
import ChatConversation from "../models/ChatConversation.js";
import Checkin from "../models/Checkin.js";
import CoachingDay from "../models/CoachingDay.js";
import Contract from "../models/Contract.js";
import DepositRequest from "../models/DepositRequest.js";
import ExerciseReview from "../models/ExerciseReview.js";
import FitnessPlusQuotaUsage from "../models/FitnessPlusQuotaUsage.js";
import FitnessSubscription from "../models/FitnessSubscription.js";
import F1Customer from "../models/F1Customer.js";
import IncomingBankTransaction from "../models/IncomingBankTransaction.js";
import Order from "../models/Order.js";
import PracticeEmailDelivery from "../models/PracticeEmailDelivery.js";
import RecipeReview from "../models/RecipeReview.js";
import ServiceUsageBucket from "../models/ServiceUsageBucket.js";
import TrainerSubscription from "../models/TrainerSubscription.js";
import TrainerTransfer from "../models/TrainerTransfer.js";
import TrainerTransferLock from "../models/TrainerTransferLock.js";
import TrainerTrialClaim from "../models/TrainerTrialClaim.js";
import TrainingSchedule from "../models/TrainingSchedule.js";
import TrainingScheduleCommand from "../models/TrainingScheduleCommand.js";
import TrainingSlotClaim from "../models/TrainingSlotClaim.js";
import User from "../models/User.js";
import Wallet from "../models/Wallet.js";
import WalletTransaction from "../models/WalletTransaction.js";
import WorkoutPlan from "../models/WorkoutPlan.js";
import { deleteAiMemoryForUser } from "./aiMemory.service.js";
import {
  enqueueAccountDeletionMedia,
} from "./accountDeletionMedia.service.js";
import { collectCoachingMediaDeletionInventory } from "./coachingPrivateMedia.service.js";
import { requestF1CustomerDeletion } from "./f1PrivacyLifecycle.service.js";
import { deleteTodayDashboardData } from "./todayDashboardPrivacy.service.js";

export const ACCOUNT_DELETION_DEFERRED_BOUNDARIES = Object.freeze([
  "financial_legal_pseudonymization_policy",
  "operational_audit_pseudonymization_policy",
]);

export const ACCOUNT_DELETION_RETAINED_COLLECTIONS = Object.freeze([
  "orders",
  "contracts",
  "depositRequests",
  "wallets",
  "walletTransactions",
  "incomingBankTransactions",
  "fitnessSubscriptions",
  "trainerSubscriptions",
  "auditLogs",
  "trainerTransfers",
]);

const deleteMany = async (Model, filter, session) => {
  const result = await Model.deleteMany(filter).session(session);
  return result.deletedCount;
};

const accountDeletionError = (status, code, message) =>
  Object.assign(new Error(message), { status, code });

const countRetainedRecords = async ({ userId, session }) => {
  const definitions = [
    ["orders", Order, { userId }],
    ["contracts", Contract, { clientId: userId }],
    ["depositRequests", DepositRequest, { userId }],
    ["wallets", Wallet, { userId }],
    ["walletTransactions", WalletTransaction, { userId }],
    ["incomingBankTransactions", IncomingBankTransaction, { userId }],
    ["fitnessSubscriptions", FitnessSubscription, { userId }],
    ["trainerSubscriptions", TrainerSubscription, { userId }],
    [
      "auditLogs",
      AuditLog,
      { $or: [{ actorId: userId }, { targetId: userId }] },
    ],
    [
      "trainerTransfers",
      TrainerTransfer,
      {
        $or: [
          { clientId: userId },
          { fromTrainerId: userId },
          { toTrainerId: userId },
          { requestedBy: userId },
        ],
      },
    ],
  ];
  const retainedCounts = {};
  for (const [key, Model, filter] of definitions) {
    retainedCounts[key] = await Model.countDocuments(filter).session(session);
  }
  return retainedCounts;
};

export const deleteAccountData = async ({ userId, actorId, actorRole }) => {
  const session = await mongoose.startSession();
  let result = null;
  try {
    await session.withTransaction(async () => {
      const user = await User.findById(userId).select("email").session(session);
      if (!user) return;

      const orders = await Order.find({ userId })
        .select("_id")
        .session(session)
        .lean();
      const schedules = await TrainingSchedule.find({ clientId: userId })
        .select("_id")
        .session(session)
        .lean();
      const coachingDays = await CoachingDay.find({ userId })
        .session(session)
        .lean();
      const bookings = await Booking.find({ userId })
        .select("_id")
        .session(session)
        .lean();
      const retainedCounts = await countRetainedRecords({ userId, session });
      const orderIds = orders.map(({ _id }) => _id);
      const scheduleIds = schedules.map(({ _id }) => _id);
      const bookingIds = bookings.map(({ _id }) => _id);
      const normalizedEmail = String(user.email || "").trim().toLowerCase();
      const linkedF1Customers = bookingIds.length
        ? await F1Customer.find({
            originBookingId: { $in: bookingIds },
            deletedAt: null,
          })
            .select("+originBookingId email status archivedAt")
            .session(session)
        : [];
      const emailMatchedF1Customers = normalizedEmail
        ? await F1Customer.find({ email: normalizedEmail, deletedAt: null })
            .select("+originBookingId email status archivedAt")
            .session(session)
        : [];
      const linkedF1Ids = new Set(
        linkedF1Customers.map(({ _id }) => String(_id)),
      );
      const ambiguousF1Customers = emailMatchedF1Customers.filter(
        ({ _id }) => !linkedF1Ids.has(String(_id)),
      );
      if (ambiguousF1Customers.length > 0) {
        throw accountDeletionError(
          409,
          "F1_ACCOUNT_LINKAGE_REQUIRED",
          "Cần xác minh liên kết hồ sơ F1 trước khi xóa tài khoản",
        );
      }

      for (const customer of linkedF1Customers) {
        await requestF1CustomerDeletion({
          customer,
          actorId,
          actorRole,
          reason: "user_request",
          session,
        });
      }
      const mediaInventory = collectCoachingMediaDeletionInventory(coachingDays);
      if (mediaInventory.unsupported.length > 0) {
        throw accountDeletionError(
          409,
          "COACHING_MEDIA_OWNERSHIP_REQUIRED",
          "Cần xác minh nguồn video Coaching trước khi xóa tài khoản",
        );
      }
      const mediaJobsQueued = await enqueueAccountDeletionMedia({
        targetUserId: userId,
        assets: mediaInventory.assets,
        session,
      });

      const deletedCounts = {};
      deletedCounts.checkins = orderIds.length
        ? await deleteMany(Checkin, { orderId: { $in: orderIds } }, session)
        : 0;
      const today = await deleteTodayDashboardData({
        clientId: userId,
        actorId,
        actorRole,
        session,
      });
      for (const [key, count] of Object.entries(today.counts)) {
        deletedCounts[`today_${key}`] = count;
      }
      await deleteAiMemoryForUser(userId, { session });

      const operations = [
        ["chatConversations", ChatConversation, { userId }],
        ["coachingDays", CoachingDay, { userId }],
        [
          "workoutPlans",
          WorkoutPlan,
          {
            $or: [
              { clientId: userId },
              ...(normalizedEmail
                ? [{ clientId: null, clientEmail: normalizedEmail }]
                : []),
            ],
          },
        ],
        [
          "trainingSlotClaims",
          TrainingSlotClaim,
          {
            $or: [
              { clientId: userId },
              ...(scheduleIds.length
                ? [{ scheduleId: { $in: scheduleIds } }]
                : []),
            ],
          },
        ],
        [
          "trainingScheduleCommands",
          TrainingScheduleCommand,
          {
            $or: [
              { actorId: userId },
              ...(scheduleIds.length
                ? [{ scheduleId: { $in: scheduleIds } }]
                : []),
            ],
          },
        ],
        ["trainingSchedules", TrainingSchedule, { clientId: userId }],
        ["exerciseReviews", ExerciseReview, { userId }],
        ["recipeReviews", RecipeReview, { userId }],
        ["serviceUsageBuckets", ServiceUsageBucket, { userId }],
        ["aiModerationStates", AiModerationState, { userId }],
        ["aiToolConfirmations", AiToolConfirmation, { userId }],
        ["bookings", Booking, { userId }],
        ["trainerTrialClaims", TrainerTrialClaim, { userId }],
        ["fitnessQuotaUsage", FitnessPlusQuotaUsage, { userId }],
        ["practiceEmailDeliveries", PracticeEmailDelivery, { userId }],
        ["trainerTransferLocks", TrainerTransferLock, { _id: userId }],
      ];
      for (const [key, Model, filter] of operations) {
        deletedCounts[key] = await deleteMany(Model, filter, session);
      }

      deletedCounts.users = await deleteMany(User, { _id: userId }, session);
      await AccountDeletionRecord.create(
        [
          {
            targetUserId: userId,
            actorId,
            actorRole,
            deletedCounts,
            retainedCounts,
            deferredBoundaries: ACCOUNT_DELETION_DEFERRED_BOUNDARIES,
            mediaJobsQueued,
            f1DeletionJobsQueued: linkedF1Customers.length,
          },
        ],
        { session },
      );
      result = {
        deletedCounts,
        retainedCounts,
        deferredBoundaries: [...ACCOUNT_DELETION_DEFERRED_BOUNDARIES],
        mediaJobsQueued,
        f1DeletionJobsQueued: linkedF1Customers.length,
      };
    });
  } finally {
    await session.endSession();
  }

  if (result) {
    result.mediaCleanup = {
      completed: 0,
      failed: 0,
      pending: result.mediaJobsQueued,
    };
  }
  return result;
};
