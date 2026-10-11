// LLM Provider Factory — Swap provider bằng 1 dòng .env
// AI_PROVIDER=mock | gemini | deepseek (validated staging trial or explicit production profile)

import { mockLLMStream, formatToolsForProvider as mockFormatTools } from "./mock.provider.js";
import { geminiLLMStream, formatToolsForProvider as geminiFormatTools } from "./gemini.provider.js";
import { deepseekLLMStream, formatToolsForProvider as deepseekFormatTools } from "./deepseek.provider.js";
import { assertDeepseekProfile } from "../../../config/deepseekProfile.js";
import { safeLog } from "../../../utils/safeLogger.js";

const providers = {
  mock: { stream: mockLLMStream, formatTools: mockFormatTools },
  gemini: { stream: geminiLLMStream, formatTools: geminiFormatTools },
  deepseek: { stream: deepseekLLMStream, formatTools: deepseekFormatTools },
};

assertDeepseekProfile();

const providerName =
  process.env.AI_PROVIDER ||
  (process.env.NODE_ENV === "production" ? "" : "mock");

if (!providers[providerName]) {
  if (process.env.NODE_ENV === "production") {
    const error = new Error("A production AI provider must be configured");
    error.code = "AI_PROVIDER_NOT_CONFIGURED";
    throw error;
  }
  safeLog.warn("ai.provider_fallback", "Unknown provider, using mock", {
    provider: providerName,
  });
}

const activeProvider = providers[providerName] || providers.mock;

export const llmStream = activeProvider.stream;
export const formatTools = activeProvider.formatTools;
export { providerName };
