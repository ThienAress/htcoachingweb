import { resolveDeepseekEndpoint } from "../../config/deepseekEndpoint.js";

export const WEB_GROUNDING_TIMEOUT_MS = 30_000;

export const resolveWebPolicy = (decision, { optionalEvidenceRequested = false } = {}) => {
  if (!decision || decision.risk === "disallowed" || decision.domain === "ht_service" || decision.urgency) {
    return "no_web";
  }
  if (decision.webSearchRequired && decision.evidence === "web_required") return "web_required";
  if (decision.risk !== "low") return "no_web";
  if (optionalEvidenceRequested && decision.freshness === "stable" && !decision.preferredTool) {
    return "web_optional";
  }
  return "no_web";
};

export const resolveAiCapabilities = (env = process.env) => {
  const deepseek = env.AI_PROVIDER === "deepseek";
  const endpoint = deepseek ? resolveDeepseekEndpoint(env) : null;
  const externalSearchConfigured = env.AI_WEB_SEARCH_PROVIDER === "brave" && Boolean(env.BRAVE_SEARCH_API_KEY);
  return Object.freeze({
    chatProvider: deepseek ? endpoint?.profile || "unavailable" : "gemini",
    model: deepseek ? endpoint?.model || null : env.GEMINI_MODEL || "gemini-3.1-flash-lite",
    nativeWebSearch: !deepseek && Boolean(env.GEMINI_API_KEY),
    externalWebSearch: externalSearchConfigured,
    searchProvider: externalSearchConfigured ? "brave" : !deepseek && env.GEMINI_API_KEY ? "gemini" : null,
    canSearchWeb: externalSearchConfigured || !deepseek && Boolean(env.GEMINI_API_KEY),
  });
};
