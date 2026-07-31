const normalizedFlag = (value) => String(value || "").trim().toLowerCase();

export const getTodayPlatformMode = (env = {}) => {
  const configuredValue = normalizedFlag(env.VITE_TODAY_PLATFORM_ENABLED);
  const explicit = ["true", "false"].includes(configuredValue);
  return {
    enabled: explicit && configuredValue === "true",
    explicit,
  };
};

export const TODAY_PLATFORM_ENABLED = getTodayPlatformMode(
  import.meta.env,
).enabled;
