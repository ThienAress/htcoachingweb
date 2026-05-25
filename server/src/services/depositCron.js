import DepositRequest from "../models/DepositRequest.js";

/**
 * Cron Job: Quét các yêu cầu nạp tiền pending đã quá hạn 15 phút
 * và chuyển trạng thái thành "expired".
 *
 * Chạy mỗi 1 phút bằng setInterval (đơn giản, phù hợp MVP).
 * Có thể nâng cấp lên node-cron hoặc Agenda.js khi cần scheduling phức tạp hơn.
 */

const INTERVAL_MS = 60 * 1000; // 1 phút

async function expirePendingDeposits() {
  try {
    const now = new Date();

    const result = await DepositRequest.updateMany(
      {
        status: "pending",
        expiresAt: { $lte: now },
      },
      {
        $set: { status: "expired" },
      }
    );

    if (result.modifiedCount > 0) {
      console.log(
        `⏰ [Cron] Đã chuyển ${result.modifiedCount} yêu cầu nạp tiền sang "expired"`
      );
    }
  } catch (err) {
    console.error("❌ [Cron] Lỗi khi expire deposits:", err.message);
  }
}

export function startDepositCronJobs() {
  console.log("⏰ [Cron] Khởi động cron job: expire pending deposits (mỗi 1 phút)");

  // Chạy ngay lần đầu khi server khởi động
  expirePendingDeposits();

  // Lặp lại mỗi 1 phút
  setInterval(expirePendingDeposits, INTERVAL_MS);
}
