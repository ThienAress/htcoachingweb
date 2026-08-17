import { resolveSePayConfig } from "../config/sepay.js";
import { safeLog } from "../utils/safeLogger.js";
import { runSePayReconciliation } from "./sepayReconciliation.service.js";

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
const MIN_INTERVAL_MS = 60 * 1000;
const MAX_INTERVAL_MS = 60 * 60 * 1000;

const boundedInterval = (value) => {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) return DEFAULT_INTERVAL_MS;
  return Math.min(MAX_INTERVAL_MS, Math.max(MIN_INTERVAL_MS, parsed));
};

const retryDelay = (error, fallback) => {
  if (error?.code !== "SEPAY_API_RATE_LIMITED") return fallback;
  const providerDelay = Number(error.retryAfterMs);
  if (!Number.isFinite(providerDelay)) return fallback;
  return Math.min(MAX_INTERVAL_MS, Math.max(1000, providerDelay));
};

export const startSePayReconciliationJob = ({
  run = runSePayReconciliation,
  setTimer = setTimeout,
} = {}) => {
  const config = resolveSePayConfig(process.env);
  if (!config.enabled || !config.reconciliationEnabled) {
    safeLog.info("financial.sepay_reconciliation_job_disabled", {
      enabled: config.enabled,
      reconciliationEnabled: config.reconciliationEnabled,
    });
    return { started: false, stop: () => {} };
  }

  const intervalMs = boundedInterval(
    process.env.SEPAY_RECONCILIATION_INTERVAL_MS,
  );
  let timer = null;
  let stopped = false;
  let activeRun = null;
  const schedule = (delayMs) => {
    if (stopped) return;
    timer = setTimer(execute, delayMs);
    timer?.unref?.();
  };
  const execute = () => {
    if (stopped) return Promise.resolve();
    if (activeRun) return activeRun;
    let nextDelay = intervalMs;
    activeRun = Promise.resolve()
      .then(run)
      .then((result) => {
        safeLog.info("financial.sepay_reconciliation_completed", {
          imported: result.imported,
          processed: result.processed,
          deferred: result.deferred,
          locked: result.locked,
        });
      })
      .catch((error) => {
        nextDelay = retryDelay(error, intervalMs);
        safeLog.error("financial.sepay_reconciliation_job_failed", error, {
          errorCode: error?.code || "UNKNOWN_ERROR",
          retryInMs: nextDelay,
        });
      })
      .finally(() => {
        activeRun = null;
        schedule(nextDelay);
      });
    return activeRun;
  };

  safeLog.info("financial.sepay_reconciliation_job_started", { intervalMs });
  schedule(0);
  return {
    started: true,
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      return activeRun || Promise.resolve();
    },
  };
};
