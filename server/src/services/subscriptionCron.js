import TrainerSubscription from "../models/TrainerSubscription.js";
import { createRecurringJob } from "../operations/recurringJob.js";
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

const subscriptionCron = createRecurringJob({
  name: "subscription_cron",
  intervalMs: INTERVAL_MS,
  task: expireTrainerSubscriptions,
});

export function startSubscriptionCronJobs() {
  safeLog.info("subscription_cron.started", { intervalMs: INTERVAL_MS });
  return subscriptionCron.start();
}

export const stopSubscriptionCronJobs = () => subscriptionCron.stop();
