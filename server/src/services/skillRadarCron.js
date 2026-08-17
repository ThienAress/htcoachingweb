import { refreshDueSkillRadarSources } from "./skillRadar.service.js";
import { createRecurringJob } from "../operations/recurringJob.js";
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

const skillRadarCron = createRecurringJob({
  name: "skill_radar.cron",
  intervalMs: CHECK_INTERVAL_MS,
  task: runRefresh,
});

export const startSkillRadarCron = () => {
  safeLog.info("skill_radar.cron_started", { intervalMs: CHECK_INTERVAL_MS });
  return skillRadarCron.start();
};

export const stopSkillRadarCron = () => skillRadarCron.stop();
