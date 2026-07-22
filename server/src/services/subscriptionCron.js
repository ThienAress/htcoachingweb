import TrainerSubscription from "../models/TrainerSubscription.js";
import { safeLog } from "../utils/safeLogger.js";

/**
 * Cron Job: Quét các gói HLV đang "active" nhưng đã quá endDate
 * và chuyển trạng thái thành "expired".
 *
 * Chạy mỗi 1 phút bằng setInterval.
 */

const INTERVAL_MS = 60 * 1000; // 1 phút

async function expireTrainerSubscriptions() {
  try {
    const now = new Date();

    const result = await TrainerSubscription.updateMany(
      {
        status: "active",
        endDate: { $lte: now },
      },
      {
        $set: { status: "expired", isActive: false },
      }
    );

    if (result.modifiedCount > 0) {
      safeLog.info("subscription_cron.expired", {
        count: result.modifiedCount,
      });
    }
  } catch (err) {
    safeLog.error("subscription_cron.failed", err);
  }
}

export function startSubscriptionCronJobs() {
  safeLog.info("subscription_cron.started", { intervalMs: INTERVAL_MS });

  // Chạy ngay lần đầu khi server khởi động
  expireTrainerSubscriptions();

  // Lặp lại mỗi 1 phút
  setInterval(expireTrainerSubscriptions, INTERVAL_MS);
}
