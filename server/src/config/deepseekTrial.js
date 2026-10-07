import { validateStagingEnvironment } from "./stagingSafety.js";
import { resolveDeepseekEndpoint } from "./deepseekEndpoint.js";

export { DEEPSEEK_TRIAL_MODEL } from "./deepseekEndpoint.js";

const CLIENT_ORIGIN = "https://staging--htcoachingweb.netlify.app";
const API_ORIGIN = "https://htcoachingweb-staging.onrender.com";

export const isDeepseekTrialRequested = (env = process.env) =>
  env.AI_PROVIDER === "deepseek" ||
  Boolean(String(env.AI_STAGING_PROVIDER_TRIAL || "").trim()) ||
  env.AI_KB_RETRIEVAL_MODE === "llm_selection" ||
  Boolean(env.DEEPSEEK_ENDPOINT_PROFILE);

const exactOrigin = (value, expected) => {
  try {
    const url = new URL(value);
    return url.origin === expected && url.pathname === "/" &&
      !url.search && !url.hash && !url.username && !url.password;
  } catch {
    return false;
  }
};

export const validateDeepseekTrialEnvironment = (env = process.env) => {
  if (!isDeepseekTrialRequested(env)) return { valid: true, active: false, errors: [] };
  const errors = [];
  const reject = (code) => errors.push({ code, message: "DeepSeek requires the isolated staging trial profile." });
  if (env.APP_ENV !== "staging") reject("DEEPSEEK_TRIAL_STAGING_REQUIRED");
  if (env.AI_PROVIDER !== "deepseek" || env.AI_STAGING_PROVIDER_TRIAL !== "deepseek" ||
      env.AI_KB_RETRIEVAL_MODE !== "llm_selection") reject("DEEPSEEK_TRIAL_PROFILE_MISMATCH");
  if (!env.DEEPSEEK_MODEL || !resolveDeepseekEndpoint(env)) reject("DEEPSEEK_TRIAL_MODEL_INVALID");
  const key = String(env.DEEPSEEK_API_KEY || "");
  if (key.length < 20 || /\s/.test(key)) reject("DEEPSEEK_TRIAL_KEY_INVALID");
  if (!exactOrigin(env.CLIENT_URL, CLIENT_ORIGIN) || !exactOrigin(env.PUBLIC_API_ORIGIN, API_ORIGIN)) {
    reject("DEEPSEEK_TRIAL_ORIGIN_INVALID");
  }
  const allowed = String(env.ALLOWED_ORIGINS || "").split(",").map(value => value.trim()).filter(Boolean);
  if (!allowed.length || allowed.some(value => !exactOrigin(value, CLIENT_ORIGIN))) {
    reject("DEEPSEEK_TRIAL_ALLOWED_ORIGINS_INVALID");
  }
  // The helper is deliberately a no-op outside staging; the positive check above
  // is essential before its result can authorize a provider.
  if (env.APP_ENV === "staging") errors.push(...validateStagingEnvironment(env).errors);
  return { valid: errors.length === 0, active: errors.length === 0, errors };
};

export const isDeepseekStagingTrial = (env = process.env) =>
  validateDeepseekTrialEnvironment(env).active;

export const assertDeepseekTrialEnvironment = (env = process.env) => {
  const result = validateDeepseekTrialEnvironment(env);
  if (!result.valid) {
    const error = new Error("DEEPSEEK_TRIAL_CONFIG_INVALID");
    error.code = "DEEPSEEK_TRIAL_CONFIG_INVALID";
    error.findings = result.errors;
    throw error;
  }
  return result;
};
