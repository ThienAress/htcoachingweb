// LLM Provider Factory — Swap provider bằng 1 dòng .env
// AI_PROVIDER=mock | gemini | openai | claude

import { mockLLMStream, formatToolsForProvider as mockFormatTools } from "./mock.provider.js";
import { geminiLLMStream, formatToolsForProvider as geminiFormatTools } from "./gemini.provider.js";

const providers = {
  mock: { stream: mockLLMStream, formatTools: mockFormatTools },
  gemini: { stream: geminiLLMStream, formatTools: geminiFormatTools },
  // openai: sẽ thêm khi production
  // claude: sẽ thêm khi production
};

const providerName = process.env.AI_PROVIDER || "mock";

if (!providers[providerName]) {
  console.warn(`⚠️ AI_PROVIDER="${providerName}" không tồn tại, fallback về mock`);
}

const activeProvider = providers[providerName] || providers.mock;

export const llmStream = activeProvider.stream;
export const formatTools = activeProvider.formatTools;
export { providerName };
