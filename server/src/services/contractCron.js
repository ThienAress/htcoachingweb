import { expireOldContracts } from "./contract.service.js";

// Chạy mỗi 24 giờ — expire HĐ chưa ký sau 7 ngày
const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 giờ

async function runExpireContracts() {
  try {
    const count = await expireOldContracts();
    if (count > 0) {
      console.log(`📋 [Cron] Đã expire ${count} hợp đồng quá hạn`);
    }
  } catch (error) {
    console.error("❌ [Cron] Lỗi khi expire contracts:", error.message);
  }
}

export function startContractCronJobs() {
  console.log("📋 [Cron] Khởi động cron job: expire contracts (mỗi 24 giờ)");

  // Chạy ngay lần đầu
  runExpireContracts();

  // Lặp lại mỗi 24 giờ
  setInterval(runExpireContracts, INTERVAL_MS);
}
