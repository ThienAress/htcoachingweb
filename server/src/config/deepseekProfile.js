import { validateDeepseekProductionEnvironment } from "./deepseekProduction.js";
import { validateDeepseekTrialEnvironment } from "./deepseekTrial.js";

export const validateDeepseekProfile = (env = process.env) => {
  if (String(env.AI_PRODUCTION_PROVIDER_PROFILE || "").trim()) {
    return validateDeepseekProductionEnvironment(env);
  }
  const trial = validateDeepseekTrialEnvironment(env);
  return { ...trial, profile: trial.active ? "staging" : null };
};

export const isDeepseekProfileActive = (env = process.env) => validateDeepseekProfile(env).active;

export const assertDeepseekProfile = (env = process.env) => {
  const result = validateDeepseekProfile(env);
  if (!result.valid) {
    const code = result.profile === "production"
      ? "DEEPSEEK_PRODUCTION_CONFIG_INVALID" : "DEEPSEEK_TRIAL_CONFIG_INVALID";
    const error = new Error(code);
    error.code = code;
    error.findings = result.errors;
    throw error;
  }
  return result;
};
