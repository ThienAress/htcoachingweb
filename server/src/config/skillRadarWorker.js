const normalized = (value) => String(value || "").trim().toLowerCase();

export const getSkillRadarWorkerMode = (env = process.env) => {
  const workerValue = normalized(env.SKILL_RADAR_WORKER_ENABLED);
  const explicit = ["true", "false"].includes(workerValue);

  if (!explicit) {
    return {
      enabled: false,
      explicit: false,
      reason: "worker_flag_required",
    };
  }
  if (workerValue === "false") {
    return { enabled: false, explicit: true, reason: "disabled" };
  }
  if (normalized(env.BACKGROUND_JOBS_ENABLED) !== "false") {
    return {
      enabled: false,
      explicit: true,
      reason: "global_jobs_must_be_disabled",
    };
  }
  if (!String(env.SKILL_RADAR_GITHUB_TOKEN || "").trim()) {
    return {
      enabled: false,
      explicit: true,
      reason: "github_token_missing",
    };
  }

  return { enabled: true, explicit: true, reason: null };
};
