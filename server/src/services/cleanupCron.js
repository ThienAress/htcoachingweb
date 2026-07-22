import DepositRequest from "../models/DepositRequest.js";
import ContactMessage from "../models/ContactMessage.js";
import { safeLog } from "../utils/safeLogger.js";

const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 giờ

/**
 * Xóa DepositRequest đã kết thúc (expired / rejected) quá 90 ngày.
 * Lý do: Dữ liệu này không còn giá trị vận hành sau 90 ngày.
 * Lưu ý: KHÔNG xóa status "success" vì WalletTransaction còn reference đến referenceId.
 */
async function cleanupOldDepositRequests() {
  try {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const result = await DepositRequest.deleteMany({
      status: { $in: ["expired", "rejected"] },
      createdAt: { $lt: cutoff },
    });
    if (result.deletedCount > 0) {
      safeLog.info("cleanup_cron.deposit_deleted", {
        count: result.deletedCount,
      });
    }
  } catch (err) {
    safeLog.error("cleanup_cron.deposit_failed", err);
  }
}

/**
 * Xóa ContactMessage đã xử lý (processed) quá 180 ngày.
 * Lý do: Tin nhắn liên hệ đã xử lý không cần lưu quá 6 tháng.
 */
async function cleanupOldContactMessages() {
  try {
    const cutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
    const result = await ContactMessage.deleteMany({
      status: "processed",
      processedAt: { $lt: cutoff },
    });
    if (result.deletedCount > 0) {
      safeLog.info("cleanup_cron.contact_deleted", {
        count: result.deletedCount,
      });
    }
  } catch (err) {
    safeLog.error("cleanup_cron.contact_failed", err);
  }
}

export function startCleanupCronJobs() {
  safeLog.info("cleanup_cron.started", { intervalMs: INTERVAL_MS });

  // Chạy ngay lần đầu khi server khởi động
  cleanupOldDepositRequests();
  cleanupOldContactMessages();

  // Lặp lại mỗi 24 giờ
  setInterval(() => {
    cleanupOldDepositRequests();
    cleanupOldContactMessages();
  }, INTERVAL_MS);
}
