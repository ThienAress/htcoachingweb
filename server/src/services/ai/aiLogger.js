import crypto from "crypto";
import {
  incrementMetric,
  observeMetric,
} from "../../observability/metrics.js";

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

const actorRef = (userId) =>
  crypto
    .createHmac("sha256", process.env.LOG_HASH_SECRET || process.env.JWT_SECRET || "local")
    .update(String(userId || "anonymous"))
    .digest("hex")
    .slice(0, 16);

export const aiLogger = {
  /** Chat session bắt đầu */
  chatStart: (userId, conversationId) => {
    incrementMetric("ai.requests");
    log("info", "chat_start", { actorRef: actorRef(userId), conversationId });
  },

  /** Chat session kết thúc thành công */
  chatEnd: (userId, conversationId, { iterations, toolCalls, durationMs, kbHits }) => {
    incrementMetric("ai.completed");
    observeMetric("ai.total_latency_ms", durationMs);
    log("info", "chat_end", { actorRef: actorRef(userId), conversationId, iterations, toolCalls, durationMs, kbHits });
  },

  /** Tool được gọi */
  toolCall: (userId, toolName, durationMs, success) => {
    incrementMetric("ai.tool_calls");
    if (!success) incrementMetric("ai.tool_failures");
    observeMetric("ai.tool_latency_ms", durationMs);
    log("info", "tool_call", { actorRef: actorRef(userId), toolName, durationMs, success });
  },

  /** Knowledge Base match */
  kbMatch: (userId, matchCount, topSimilarity) =>
    log("debug", "kb_match", { actorRef: actorRef(userId), matchCount, topSimilarity }),

  /** Content moderation trigger */
  moderationTrigger: (userId, action) => {
    incrementMetric("ai.moderation_blocks");
    log("warn", "moderation_trigger", { actorRef: actorRef(userId), action });
  },

  /** Lỗi trong chat flow */
  chatError: (userId, error, context) => {
    incrementMetric("ai.errors");
    log("error", "chat_error", { actorRef: actorRef(userId), error: error.message || error, context });
  },

  /** User bị locked */
  userLocked: (userId, remainingMinutes) =>
    log("warn", "user_locked", { actorRef: actorRef(userId), remainingMinutes }),
};
