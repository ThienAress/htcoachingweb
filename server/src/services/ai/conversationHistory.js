import { AI_RUNTIME_POLICY } from "./runtimePolicy.js";

// Only a cut at the leading boundary can orphan a tool group in valid stored
// history. Interior corruption remains visible to the provider's validator.
export const selectConversationHistory = (messages, limit = AI_RUNTIME_POLICY.maxHistoryMessages) => {
  if (!Array.isArray(messages)) return [];
  const bounded = Math.floor(Math.min(Math.max(Number(limit) || 20, 1), AI_RUNTIME_POLICY.maxHistoryMessages));
  const suffix = messages.slice(-bounded);
  if (messages.length > bounded) {
    while (suffix[0]?.role === "tool") suffix.shift();
  }
  return suffix;
};
