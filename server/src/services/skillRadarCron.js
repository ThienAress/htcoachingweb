import { refreshDueSkillRadarSources } from "./skillRadar.service.js";
import { safeLog } from "../utils/safeLogger.js";

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

const runRefresh = async () => {
  try {
    const result = await refreshDueSkillRadarSources();
    if (result.checked > 0) safeLog.info("skill_radar.refresh_completed", result);
  } catch (error) {
    safeLog.error("skill_radar.refresh_failed", error);
  }
};

let activeRefresh = null;

const runRefreshOnce = () => {
  if (activeRefresh) return activeRefresh;
  activeRefresh = runRefresh().finally(() => {
    activeRefresh = null;
  });
  return activeRefresh;
};

export const startSkillRadarCron = () => {
  safeLog.info("skill_radar.cron_started", { intervalMs: CHECK_INTERVAL_MS });
  void runRefreshOnce();
  const timer = setInterval(runRefreshOnce, CHECK_INTERVAL_MS);
  timer.unref?.();
  return timer;
};
