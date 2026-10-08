import { isIP } from "node:net";
import { resolveDeepseekEndpoint } from "./deepseekEndpoint.js";

const productionOrigin = (value) => {
  try {
    const url = new URL(value);
    const host = url.hostname;
    if (url.protocol !== "https:" || url.pathname !== "/" || url.search || url.hash ||
        url.username || url.password || url.port || !host.includes(".") ||
        isIP(host) || host.startsWith("[") || /staging|localhost|\.local$/.test(host)) return null;
    return url.origin;
  } catch {
    return null;
  }
};

const validKey = (value) => {
  const key = String(value || "");
  return key.length >= 20 && key.length <= 512 && !/\s/.test(key);
};

export const validateDeepseekProductionEnvironment = (env = process.env) => {
  const errors = [];
  const reject = (code) => errors.push({ code, message: "Vibi requires the approved production profile." });
  if (env.APP_ENV !== "production" || env.NODE_ENV !== "production") {
    reject("DEEPSEEK_PRODUCTION_ENV_REQUIRED");
  }
  if (env.AI_PRODUCTION_PROVIDER_PROFILE !== "vibi" || env.AI_PROVIDER !== "deepseek" ||
      env.AI_KB_RETRIEVAL_MODE !== "llm_selection" || String(env.AI_STAGING_PROVIDER_TRIAL || "").trim()) {
    reject("DEEPSEEK_PRODUCTION_PROFILE_MISMATCH");
  }
  const endpoint = resolveDeepseekEndpoint(env);
  if (endpoint?.profile !== "vibi") reject("DEEPSEEK_PRODUCTION_ENDPOINT_INVALID");
  if (!validKey(env.DEEPSEEK_API_KEY)) reject("DEEPSEEK_PRODUCTION_KEY_INVALID");
  if (env.AI_WEB_SEARCH_PROVIDER !== "brave" || !validKey(env.BRAVE_SEARCH_API_KEY)) {
    reject("DEEPSEEK_PRODUCTION_SEARCH_INVALID");
  }
  try {
    const mongo = new URL(env.MONGO_URI);
    if (!["mongodb:", "mongodb+srv:"].includes(mongo.protocol) || mongo.pathname !== "/gym-app") {
      reject("DEEPSEEK_PRODUCTION_DATABASE_INVALID");
    }
  } catch {
    reject("DEEPSEEK_PRODUCTION_DATABASE_INVALID");
  }
  const client = productionOrigin(env.CLIENT_URL);
  const api = productionOrigin(env.PUBLIC_API_ORIGIN);
  const allowed = String(env.ALLOWED_ORIGINS || "").split(",").map((v) => v.trim()).filter(Boolean);
  if (!client || !api || client === api || !allowed.length ||
      allowed.some((v) => !productionOrigin(v)) || !allowed.some((v) => productionOrigin(v) === client)) {
    reject("DEEPSEEK_PRODUCTION_ORIGIN_INVALID");
  }
  return { valid: errors.length === 0, active: errors.length === 0, profile: "production", errors };
};
