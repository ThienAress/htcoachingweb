import { expireOldContracts } from "./contract.service.js";
import { createRecurringJob } from "../operations/recurringJob.js";
import { safeLog } from "../utils/safeLogger.js";
import { recoverContractSigningAttempts } from "./contractSigningAttempt.service.js";

// Chạy mỗi 24 giờ — expire HĐ chưa ký sau 7 ngày
const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 giờ

async function runExpireContracts() {
  try {
    const count = await expireOldContracts();
    if (count > 0) {
      safeLog.info("contract_cron.expired", { count });
    }
  } catch (error) {
    safeLog.error("contract_cron.failed", error);
  }
}

const contractCron = createRecurringJob({
  name: "contract_cron",
  intervalMs: INTERVAL_MS,
  task: runExpireContracts,
});

const signingRecovery = createRecurringJob({
  name: "contract_signing_recovery",
  intervalMs: 60 * 1000,
  task: () => recoverContractSigningAttempts({ limit: 20 }),
});

export function startContractCronJobs() {
  safeLog.info("contract_cron.started", { intervalMs: INTERVAL_MS });
  signingRecovery.start();
  return contractCron.start();
}

export const stopContractCronJobs = () => Promise.all([contractCron.stop(), signingRecovery.stop()]);
