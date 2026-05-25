import TrainerSubscription from "../models/TrainerSubscription.js";

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
        $set: { status: "expired" },
      }
    );

    if (result.modifiedCount > 0) {
      console.log(
        `⏰ [Cron] Đã hết hạn ${result.modifiedCount} gói HLV`
      );
    }
  } catch (err) {
    console.error("❌ [Cron] Lỗi khi expire trainer subscriptions:", err.message);
  }
}

export function startSubscriptionCronJobs() {
  console.log("⏰ [Cron] Khởi động cron job: expire trainer subscriptions (mỗi 1 phút)");

  // Chạy ngay lần đầu khi server khởi động
  expireTrainerSubscriptions();

  // Lặp lại mỗi 1 phút
  setInterval(expireTrainerSubscriptions, INTERVAL_MS);
}
