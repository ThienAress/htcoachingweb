import "../config/env.js";
import mongoose from "mongoose";

import connectDB from "../config/db.js";
import { getSkillRadarWorkerMode } from "../config/skillRadarWorker.js";
import {
  startSkillRadarCron,
  stopSkillRadarCron,
} from "../services/skillRadarCron.js";
import { safeLog } from "../utils/safeLogger.js";
import { createSkillRadarWorker } from "./skillRadarWorkerLifecycle.js";

const main = async () => {
  const mode = getSkillRadarWorkerMode(process.env);
  if (!mode.enabled) {
    throw new Error(`Skill Radar worker configuration rejected: ${mode.reason}`);
  }

  const worker = createSkillRadarWorker({
    connect: connectDB,
    startCron: startSkillRadarCron,
    stopCron: stopSkillRadarCron,
    disconnect: () => mongoose.disconnect(),
  });
  await worker.start();
  safeLog.info("skill_radar.worker_started");

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    safeLog.info("skill_radar.worker_shutdown_started", { signal });
    try {
      await worker.stop();
      safeLog.info("skill_radar.worker_stopped", { signal });
      process.exit(0);
    } catch (error) {
      safeLog.error("skill_radar.worker_shutdown_failed", error);
      process.exit(1);
    }
  };

  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT", () => void shutdown("SIGINT"));
};

main().catch((error) => {
  safeLog.error("skill_radar.worker_start_failed", error);
  process.exitCode = 1;
});
