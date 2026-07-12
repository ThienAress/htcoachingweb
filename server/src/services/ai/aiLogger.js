// AI Logger — Structured JSON logging cho AI Chat system
// Ghi vào console với format JSON, dễ parse cho analytics sau này

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const CURRENT_LEVEL = LOG_LEVELS[process.env.AI_LOG_LEVEL || "info"];

/**
 * Ghi structured log cho AI system
 * @param {"debug"|"info"|"warn"|"error"} level
 * @param {string} event - Tên sự kiện (VD: "chat_start", "tool_call")
 * @param {object} data - Data bổ sung
 */
function log(level, event, data = {}) {
  if (LOG_LEVELS[level] < CURRENT_LEVEL) return;

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: "ai-chat",
    event,
    ...data,
  };

  // Không log sensitive data
  if (entry.message) {
    entry.messageLength = entry.message.length;
    delete entry.message;
  }

  const output = JSON.stringify(entry);

  switch (level) {
    case "error":
      console.error(output);
      break;
    case "warn":
      console.warn(output);
      break;
    default:
      console.log(output);
  }
}

export const aiLogger = {
  /** Chat session bắt đầu */
  chatStart: (userId, conversationId) =>
    log("info", "chat_start", { userId, conversationId }),

  /** Chat session kết thúc thành công */
  chatEnd: (userId, conversationId, { iterations, toolCalls, durationMs, kbHits }) =>
    log("info", "chat_end", { userId, conversationId, iterations, toolCalls, durationMs, kbHits }),

  /** Tool được gọi */
  toolCall: (userId, toolName, durationMs, success) =>
    log("info", "tool_call", { userId, toolName, durationMs, success }),

  /** Knowledge Base match */
  kbMatch: (userId, matchCount, topSimilarity) =>
    log("debug", "kb_match", { userId, matchCount, topSimilarity }),

  /** Content moderation trigger */
  moderationTrigger: (userId, action) =>
    log("warn", "moderation_trigger", { userId, action }),

  /** Lỗi trong chat flow */
  chatError: (userId, error, context) =>
    log("error", "chat_error", { userId, error: error.message || error, context }),

  /** User bị locked */
  userLocked: (userId, remainingMinutes) =>
    log("warn", "user_locked", { userId, remainingMinutes }),
};
