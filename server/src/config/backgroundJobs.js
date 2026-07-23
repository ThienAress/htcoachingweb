export const getBackgroundJobsMode = (env = process.env) => {
  const configuredValue = String(env.BACKGROUND_JOBS_ENABLED || "")
    .trim()
    .toLowerCase();
  return {
    enabled: configuredValue === "true",
    explicit: ["true", "false"].includes(configuredValue),
  };
};
