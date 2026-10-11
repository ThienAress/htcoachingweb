import { safeLog } from "../utils/safeLogger.js";

const count = (value, limit) => Number.isSafeInteger(value) && value >= 0 && value <= limit ? value : 0;
const duration = (value) => Number.isFinite(value) && value >= 0 ? Math.min(Math.round(value), 300_000) : null;
const ERROR_CODES = new Set([
  "DEEPSEEK_ABORTED", "DEEPSEEK_TIMEOUT", "DEEPSEEK_NETWORK_ERROR", "DEEPSEEK_HTTP_ERROR",
  "DEEPSEEK_STREAM_INCOMPLETE", "DEEPSEEK_STREAM_ERROR", "DEEPSEEK_RESPONSE_LIMIT",
  "DEEPSEEK_SSE_JSON_INVALID", "DEEPSEEK_SSE_FRAME_LIMIT", "DEEPSEEK_FINISH_INVALID",
  "DEEPSEEK_TOOL_CALL_INVALID", "DEEPSEEK_TOOL_ARGS_INVALID", "DEEPSEEK_TOOL_ARGS_LIMIT",
]);

export const recordDeepseekTelemetry = ({ surface, model, success, startedAt, firstTokenAt,
  toolCount, usage, errorCode, status, headersAt = null, firstByteAt = null,
  receivedBytes = 0, requestBytes = 0, reasoningObserved = false }) => {
  safeLog.info("ai.deepseek_request_completed", {
    surface: ["chat", "kb_selection", "web_grounding"].includes(surface) ? surface : "unknown",
    model: typeof model === "string" && /^[a-z0-9._-]{1,100}$/i.test(model) ? model : "unknown",
    success: success === true,
    durationMs: duration(performance.now() - startedAt),
    ttftMs: firstTokenAt === null ? null : duration(firstTokenAt - startedAt),
    headersMs: headersAt === null ? null : duration(headersAt - startedAt),
    firstByteMs: firstByteAt === null ? null : duration(firstByteAt - startedAt),
    receivedBytes: Math.min(count(receivedBytes, Number.MAX_SAFE_INTEGER), 1_048_576),
    requestBytes: count(requestBytes, 128 * 1024),
    reasoningObserved: reasoningObserved === true,
    promptTokens: count(usage?.prompt_tokens, 1_000_000),
    outputTokens: count(usage?.completion_tokens, 1_000_000),
    totalTokens: count(usage?.total_tokens, 1_000_000),
    toolCount: count(toolCount, 64),
    retryCount: 0,
    providerErrorCode: success ? null : ERROR_CODES.has(errorCode) ? errorCode : "DEEPSEEK_REQUEST_FAILED",
    httpStatus: Number.isInteger(status) && status >= 100 && status <= 599 ? status : null,
  });
};
