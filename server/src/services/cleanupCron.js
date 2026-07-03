import DepositRequest from "../models/DepositRequest.js";
import ContactMessage from "../models/ContactMessage.js";

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
      console.log(`🧹 [Cron] Đã xóa ${result.deletedCount} DepositRequest cũ (expired/rejected > 90 ngày)`);
    }
  } catch (err) {
    console.error("❌ [Cron] Lỗi khi cleanup DepositRequest:", err.message);
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
      console.log(`🧹 [Cron] Đã xóa ${result.deletedCount} ContactMessage cũ (processed > 180 ngày)`);
    }
  } catch (err) {
    console.error("❌ [Cron] Lỗi khi cleanup ContactMessage:", err.message);
  }
}

export function startCleanupCronJobs() {
  console.log("🧹 [Cron] Khởi động cron job: cleanup DB (mỗi 24 giờ)");

  // Chạy ngay lần đầu khi server khởi động
  cleanupOldDepositRequests();
  cleanupOldContactMessages();

  // Lặp lại mỗi 24 giờ
  setInterval(() => {
    cleanupOldDepositRequests();
    cleanupOldContactMessages();
  }, INTERVAL_MS);
}
