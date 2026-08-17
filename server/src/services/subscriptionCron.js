import TrainerSubscription from "../models/TrainerSubscription.js";
import FitnessSubscription from "../models/FitnessSubscription.js";
import { calculateRetentionDeadlines } from "./trainerSubscriptionLifecycle.service.js";
import { safeLog } from "../utils/safeLogger.js";

const INTERVAL_MS = 60 * 1000;

export async function expireTrainerSubscriptions() {
  try {
    const now = new Date();
    const expiredCandidates = await TrainerSubscription.find({
      status: "active",
      endDate: { $lte: now },
    })
      .select("_id endDate")
      .lean();

    if (expiredCandidates.length === 0) return 0;
    const result = await TrainerSubscription.bulkWrite(
      expiredCandidates.map((subscription) => {
        const retention = calculateRetentionDeadlines(
          subscription.endDate || now,
        );
        return {
          updateOne: {
            filter: { _id: subscription._id, status: "active" },
            update: {
              $set: {
                status: "expired",
                isActive: false,
                structuredRetentionExpiresAt:
                  retention.structuredRetentionExpiresAt,
                mediaRetentionExpiresAt: retention.mediaRetentionExpiresAt,
              },
            },
          },
        };
      }),
    );

    if (result.modifiedCount > 0) {
      safeLog.info("subscription_cron.expired", {
        count: result.modifiedCount,
      });
    }
    return result.modifiedCount;
  } catch (error) {
    safeLog.error("subscription_cron.failed", error);
    return 0;
  }
}

export async function expireFitnessPlusSubscriptions() {
  try {
    const result = await FitnessSubscription.updateMany(
      {
        status: "active",
        endDate: { $lte: new Date() },
      },
      {
        $set: {
          status: "expired",
          isActive: false,
        },
      },
    );
    return result.modifiedCount || 0;
  } catch (error) {
    safeLog.error("fitness_plus_subscription_cron.failed", error);
    return 0;
  }
}

export function startSubscriptionCronJobs() {
  safeLog.info("subscription_cron.started", { intervalMs: INTERVAL_MS });
  expireTrainerSubscriptions();
  expireFitnessPlusSubscriptions();
  setInterval(() => {
    expireTrainerSubscriptions();
    expireFitnessPlusSubscriptions();
  }, INTERVAL_MS);
}
