import { safeLog } from "../utils/safeLogger.js";

export const createRecurringJob = ({
  name,
  intervalMs,
  task,
  initialDelayMs = 0,
  runOnStart = true,
}) => {
  if (!name || !Number.isFinite(intervalMs) || intervalMs < 1) {
    throw new Error("Recurring job requires a name and positive intervalMs");
  }
  if (typeof task !== "function") {
    throw new Error(`Recurring job ${name} requires a task function`);
  }

  let intervalTimer = null;
  let initialTimer = null;
  let activeRun = null;
  let started = false;

  const run = () => {
    if (!started) return Promise.resolve();
    if (activeRun) {
      safeLog.warn(
        `${name}.overlap_skipped`,
        "Previous recurring job tick is still running",
      );
      return activeRun;
    }

    activeRun = Promise.resolve()
      .then(task)
      .catch((error) => {
        safeLog.error(`${name}.tick_failed`, error);
      })
      .finally(() => {
        activeRun = null;
      });
    return activeRun;
  };

  const start = () => {
    if (intervalTimer) return intervalTimer;

    started = true;
    intervalTimer = setInterval(() => void run(), intervalMs);
    intervalTimer.unref?.();

    if (runOnStart) {
      if (initialDelayMs > 0) {
        initialTimer = setTimeout(() => {
          initialTimer = null;
          void run();
        }, initialDelayMs);
        initialTimer.unref?.();
      } else {
        void run();
      }
    }

    return intervalTimer;
  };

  const stop = () => {
    started = false;
    if (initialTimer) clearTimeout(initialTimer);
    if (intervalTimer) clearInterval(intervalTimer);
    initialTimer = null;
    intervalTimer = null;
    return activeRun || Promise.resolve();
  };

  return { start, stop };
};
