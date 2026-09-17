// Gemini LLM Provider — Google AI Free Tier
// Model: gemini-3.1-flash-lite (Free: 15 RPM, 250K TPM, 500 RPD)
// Hỗ trợ: Function Calling + Streaming
import { safeLog } from "../../../utils/safeLogger.js";
import {
  recordGeminiChatDisposition,
  recordGeminiRequest,
  recordGeminiResult,
} from "../../../observability/providerUsageMetrics.js";
import {
  canonicalizeToolResultForModel,
  serializeToolResultForModel,
} from "../tools/toolResultBoundary.js";

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 45000;
const GEMINI_TRANSIENT_MAX_ATTEMPTS = 3;
const GEMINI_RETRY_BASE_DELAY_MS = 250;
const GEMINI_RETRY_JITTER_RATIO = 0.25;
const GEMINI_RETRY_MAX_DELAY_MS = 4000;
const GEMINI_RETRY_DEADLINE_RESERVE_MS = 50;
const GEMINI_TRANSIENT_HTTP_STATUSES = new Set([500, 502, 503, 504]);
const GEMINI_UNSUPPORTED_SCHEMA_KEYS = new Set(["additionalProperties"]);
const GEMINI_OUTCOME_RECORDED = Symbol("geminiOutcomeRecorded");

const operationalError = (code, status) => {
  const error = new Error("Gemini provider unavailable");
  error.name = "AiProviderOperationalError";
  error.code = code;
  if (status) error.status = status;
  return error;
};

const recordGeminiFailure = (error) => {
  recordGeminiResult("chat", { success: false });
  if (error && typeof error === "object") {
    error[GEMINI_OUTCOME_RECORDED] = true;
  }
};

const recordGeminiHttpDisposition = (status) => {
  if (status === 429) {
    recordGeminiChatDisposition("rate_limited");
  } else if (Number(status) >= 500) {
    recordGeminiChatDisposition("unavailable");
  }
};

const parseRetryAfterMs = (response) => {
  const raw = response?.headers?.get?.("Retry-After")?.trim();
  if (!raw) return null;
  if (/^\d+(?:\.\d+)?$/.test(raw)) {
    const milliseconds = Number(raw) * 1000;
    return Number.isFinite(milliseconds) ? milliseconds : null;
  }
  const retryAt = Date.parse(raw);
  if (!Number.isFinite(retryAt)) return null;
  return Math.max(0, retryAt - Date.now());
};

const getTransientRetryDelayMs = (
  response,
  attempt,
  { deadlineAt, retryBaseDelayMs, retryJitterRatio },
) => {
  let delayMs = null;
  if (response.status === 429) {
    delayMs = parseRetryAfterMs(response);
  } else if (GEMINI_TRANSIENT_HTTP_STATUSES.has(response.status)) {
    const exponentialDelay = Math.min(
      retryBaseDelayMs * (2 ** Math.max(0, attempt - 1)),
      GEMINI_RETRY_MAX_DELAY_MS,
    );
    delayMs = exponentialDelay +
      Math.floor(exponentialDelay * retryJitterRatio * Math.random());
  }
  if (delayMs === null) return null;
  const remainingMs = deadlineAt - Date.now();
  if (delayMs + GEMINI_RETRY_DEADLINE_RESERVE_MS >= remainingMs) return null;
  return Math.max(0, Math.floor(delayMs));
};

const waitForRetry = (delayMs, signal) => {
  if (signal.aborted) return Promise.reject(signal.reason);
  if (delayMs <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);
    signal.addEventListener("abort", onAbort, { once: true });
  });
};

const fetchGeminiResponse = async (
  url,
  body,
  signal,
  retryOptions,
  retryBudget,
) => {
  let transientAttempt = 1;
  while (true) {
    let response;
    try {
      recordGeminiRequest("chat");
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });
    } catch {
      const error = operationalError("GEMINI_NETWORK_ERROR");
      recordGeminiFailure(error);
      if (!signal.aborted) {
        safeLog.error("ai.gemini_fetch_failed", "Provider connection failed");
      }
      throw error;
    }

    if (response.ok || retryBudget.remaining <= 0) return response;
    const retryDelayMs = getTransientRetryDelayMs(
      response,
      transientAttempt,
      retryOptions,
    );
    if (retryDelayMs === null) return response;

    recordGeminiResult("chat", { success: false });
    recordGeminiHttpDisposition(response.status);
    const providerError = await readProviderError(response);
    safeLog.warn("ai.gemini_transient_retry", "Retrying transient provider error", {
      status: response.status,
      attempt: transientAttempt,
      retryDelayMs,
      ...providerError,
    });
    retryBudget.remaining -= 1;
    try {
      await waitForRetry(retryDelayMs, signal);
    } catch (error) {
      if (error && typeof error === "object") {
        error[GEMINI_OUTCOME_RECORDED] = true;
      }
      throw error;
    }
    transientAttempt += 1;
  }
};

function sanitizeSchemaForGemini(value) {
  if (Array.isArray(value)) return value.map(sanitizeSchemaForGemini);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !GEMINI_UNSUPPORTED_SCHEMA_KEYS.has(key))
      .map(([key, child]) => [key, sanitizeSchemaForGemini(child)]),
  );
}

async function readProviderError(response) {
  const payload = await response.json().catch(() => ({}));
  return {
    code: payload?.error?.code || null,
    providerStatus: payload?.error?.status || null,
  };
}

function createLinkedSignal(externalSignal, timeoutMs) {
  const controller = new AbortController();
  const abortFromExternal = () => controller.abort(externalSignal?.reason);
  const timeout = setTimeout(
    () => controller.abort(new Error("Gemini request timed out")),
    timeoutMs,
  );

  if (externalSignal?.aborted) {
    abortFromExternal();
  } else {
    externalSignal?.addEventListener("abort", abortFromExternal, { once: true });
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeout);
      externalSignal?.removeEventListener("abort", abortFromExternal);
    },
  };
}

/**
 * Convert OpenAI-style messages → Gemini format (With strict sanitization to prevent 400 Bad Request)
 */
function convertMessages(messages) {
  let systemInstruction = null;
  const rawContents = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      systemInstruction = { parts: [{ text: msg.content }] };
      continue;
    }

    if (msg.role === "user") {
      const userParts = [];
      if (msg.content) userParts.push({ text: msg.content });
      
      // Hỗ trợ đọc ảnh (Multimodal)
      if (msg.image) {
        const match = msg.image.match(/^data:(image\/[a-zA-Z0-9.-]+);base64,(.+)$/);
        if (match) {
          userParts.push({
            inlineData: {
              mimeType: match[1],
              data: match[2],
            },
          });
        }
      }
      
      if (userParts.length === 0) userParts.push({ text: " " });
      rawContents.push({ role: "user", parts: userParts });
    } else if (msg.role === "assistant") {
      const parts = [];
      if (msg.content) parts.push({ text: msg.content });
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        // Include thought parts TRƯỚC functionCall (Gemini yêu cầu khi thinking mode bật)
        if (msg._thoughtParts && msg._thoughtParts.length > 0) {
          for (const tp of msg._thoughtParts) {
            const thoughtPart = { thought: true };
            if (tp.text) thoughtPart.text = tp.text;
            const thoughtSignature =
              tp.thoughtSignature || tp.thought_signature;
            if (thoughtSignature) {
              thoughtPart.thoughtSignature = thoughtSignature;
            }
            parts.push(thoughtPart);
          }
        }
        for (const tc of msg.tool_calls) {
          const fnCall = { name: tc.name, args: tc.args || {} };
          if (tc.id) fnCall.id = tc.id;
          const functionCallPart = { functionCall: fnCall };
          const thoughtSignature =
            tc.thoughtSignature || tc.thought_signature;
          if (thoughtSignature) {
            functionCallPart.thoughtSignature = thoughtSignature;
          }
          parts.push(functionCallPart);
        }
      }
      if (parts.length > 0) rawContents.push({ role: "model", parts });
    } else if (msg.role === "tool") {
      const content =
        typeof msg.content === "string"
          ? msg.content
          : JSON.stringify(msg.content ?? "");
      const responseData = JSON.parse(
        msg.toolResultEnvelope === true
          ? canonicalizeToolResultForModel({
              toolName: msg.name,
              content,
            })
          : serializeToolResultForModel({
              toolName: msg.name,
              text: content,
              status: "success",
            }),
      );

      rawContents.push({
        role: "user",
        parts: [{
          functionResponse: {
            id: msg.id || msg.name,
            name: msg.name || "unknown_tool",
            response: responseData,
          },
        }],
      });
    }
  }

  // 1. Gộp các block giống role liên tiếp nhau (User-User, Model-Model)
  const mergedContents = [];
  for (const current of rawContents) {
    const prev = mergedContents[mergedContents.length - 1];
    if (prev && prev.role === current.role) {
      prev.parts.push(...current.parts);
    } else {
      mergedContents.push({ ...current, parts: [...current.parts] });
    }
  }

  // 2. Sanitize xen kẽ: functionResponse là một user turn theo Gemini API.
  const finalContents = [];
  for (const current of mergedContents) {
    const prev = finalContents[finalContents.length - 1];

    if (current.role === "user") {
      finalContents.push(current);
    } else if (current.role === "model") {
      if (!prev) {
        finalContents.push({ role: "user", parts: [{ text: "Bắt đầu trò chuyện." }] });
      }
      finalContents.push(current);
    }
  }
  
  // 3. Đảm bảo block Model cuối cùng (nếu có) không chứa functionCall chờ (vì LLM expect user ask)
  const lastItem = finalContents[finalContents.length - 1];
  if (lastItem && lastItem.role === "model") {
     const hasFunctionCall = lastItem.parts.some(p => p.functionCall);
     if (hasFunctionCall) {
        lastItem.parts = lastItem.parts.filter(p => !p.functionCall);
        if (lastItem.parts.length === 0) lastItem.parts.push({ text: "Tiếp tục." });
     }
  }

  return { systemInstruction, contents: finalContents };
}

/**
 * Convert tool schemas → Gemini functionDeclarations format
 */
export function formatToolsForProvider(tools) {
  if (!tools || tools.length === 0) return undefined;

  return [{
    functionDeclarations: tools.map((t) => ({
      name: t.function.name,
      description: t.function.description,
      parameters: sanitizeSchemaForGemini(t.function.parameters),
    })),
  }];
}

/**
 * Gemini streaming với function calling
 * @param {Array} messages - Conversation messages (OpenAI format)
 * @param {Array} tools - Tool schemas (OpenAI format)
 * @yields {{ type: "text"|"tool_call", content?: string, toolCalls?: Array }}
 */
async function* streamGemini(messages, tools, signal, retryOptions) {
  // Đọc API key tại runtime (không phải lúc import) để đảm bảo .env đã load
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw operationalError("GEMINI_CONFIG_UNAVAILABLE");
  }

  const { systemInstruction, contents } = convertMessages(messages);
  const geminiTools = formatToolsForProvider(tools);

  const body = {
    contents,
    ...(systemInstruction && { systemInstruction }),
    ...(geminiTools && { tools: geminiTools }),
    generationConfig: {
      temperature: 0.4,
      topP: 0.9,
      maxOutputTokens: 2048,
    },
  };

  const url = `${GEMINI_BASE_URL}/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const retryBudget = { remaining: GEMINI_TRANSIENT_MAX_ATTEMPTS - 1 };
  let response = await fetchGeminiResponse(
    url,
    body,
    signal,
    retryOptions,
    retryBudget,
  );

  if (!response.ok) {
    recordGeminiResult("chat", { success: false });
    recordGeminiHttpDisposition(response.status);
    const providerError = await readProviderError(response);
    safeLog.warn("ai.gemini_http_error", "Provider returned an error", {
      status: response.status,
      ...providerError,
    });

    if (response.status === 400) {
      safeLog.warn(
        "ai.gemini_minimal_retry",
        "Retrying provider with minimal context",
      );

      // Retry với chỉ system prompt + message cuối (bỏ history bị lỗi format)
      const minimalMessages = messages.filter(m => m.role === "system");
      const lastUserMsg = [...messages].reverse().find(m => m.role === "user");
      if (lastUserMsg) minimalMessages.push(lastUserMsg);

      const { systemInstruction: retrySystem, contents: retryContents } = convertMessages(minimalMessages);
      const retryBody = {
        contents: retryContents,
        ...(retrySystem && { systemInstruction: retrySystem }),
        ...(geminiTools && { tools: geminiTools }),
        generationConfig: body.generationConfig,
      };

      let retryResponse = await fetchGeminiResponse(
        url,
        retryBody,
        signal,
        retryOptions,
        retryBudget,
      );

      if (!retryResponse.ok && retryResponse.status === 400 && geminiTools) {
        recordGeminiResult("chat", { success: false });
        safeLog.warn(
          "ai.gemini_tool_free_retry",
          "Retrying provider without tools after minimal retry failed",
        );
        const toolFreeRetryBody = { ...retryBody };
        delete toolFreeRetryBody.tools;
        retryResponse = await fetchGeminiResponse(
          url,
          toolFreeRetryBody,
          signal,
          retryOptions,
          retryBudget,
        );
      }

      if (!retryResponse.ok) {
        recordGeminiResult("chat", { success: false });
        recordGeminiHttpDisposition(retryResponse.status);
        const retryError = await readProviderError(retryResponse);
        safeLog.warn("ai.gemini_retry_failed", "Minimal provider retry failed", {
          status: retryResponse.status,
          ...retryError,
        });
        const error = operationalError("GEMINI_HTTP_ERROR", retryResponse.status);
        error[GEMINI_OUTCOME_RECORDED] = true;
        throw error;
      }

      // Dùng retryResponse thay cho response ban đầu
      response = retryResponse;
    } else {
      const error = operationalError("GEMINI_HTTP_ERROR", response.status);
      error[GEMINI_OUTCOME_RECORDED] = true;
      throw error;
    }
  }

  // Parse SSE stream
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const thoughtBuffer = []; // Buffer thought parts để gửi kèm tool_call
  const pendingToolCalls = [];
  const usage = {
    promptTokenCount: 0,
    candidatesTokenCount: 0,
    totalTokenCount: 0,
  };
  let receivedOutput = false;
  let terminalStreamError = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const jsonStr = line.slice(6).trim();
      if (!jsonStr || jsonStr === "[DONE]") continue;

      try {
        const data = JSON.parse(jsonStr);
        for (const field of Object.keys(usage)) {
          usage[field] = Math.max(
            usage[field],
            Number(data.usageMetadata?.[field]) || 0,
          );
        }

        // Gemini trả error trong stream body (HTTP 200 nhưng có lỗi)
        if (data.error) {
          safeLog.warn("ai.gemini_stream_error", "Provider stream error");
          terminalStreamError = true;
          continue;
        }

        const candidate = data.candidates?.[0];
        if (!candidate?.content?.parts) continue;

        for (const part of candidate.content.parts) {
          const thoughtSignature =
            part.thoughtSignature || part.thought_signature;

          // Buffer thought parts — KHÔNG gửi ra UI nhưng CẦN echo lại cho Gemini
          if (part.thought) {
            thoughtBuffer.push({
              thought: true,
              ...(part.text && { text: part.text }),
              ...(thoughtSignature && { thoughtSignature }),
            });
            continue;
          }

          if (part.text) {
            receivedOutput = true;
            yield { type: "text", content: part.text };
          }

          if (part.functionCall) {
            receivedOutput = true;
            pendingToolCalls.push({
              id: part.functionCall.id || part.id || `gemini_${Date.now()}`,
              name: part.functionCall.name,
              args: part.functionCall.args || {},
              ...(thoughtSignature && { thoughtSignature }),
            });
          }
        }
      } catch {
        // JSON parse error — skip malformed chunk
      }
    }
  }

  if (terminalStreamError || !receivedOutput) {
    throw operationalError(
      terminalStreamError ? "GEMINI_STREAM_ERROR" : "GEMINI_STREAM_EMPTY",
    );
  }
  recordGeminiResult("chat", { success: true, usage });

  if (pendingToolCalls.length > 0) {
    yield {
      type: "tool_call",
      toolCalls: pendingToolCalls,
      // Echo lại nguyên thứ tự model parts trước toàn bộ parallel calls.
      thoughtParts: thoughtBuffer.length > 0 ? thoughtBuffer : undefined,
    };
  }
}

/**
 * Gemini stream có cancellation và deadline dùng chung cho cả fetch lẫn body stream.
 */
export async function* geminiLLMStream(messages, tools, options = {}) {
  const timeoutMs = Math.min(
    Math.max(Number(options.timeoutMs) || GEMINI_TIMEOUT_MS, 5000),
    120000,
  );
  const linked = createLinkedSignal(options.signal, timeoutMs);
  const parsedRetryBaseDelayMs = Number(options.retryBaseDelayMs);
  const parsedRetryJitterRatio = Number(options.retryJitterRatio);
  const retryOptions = {
    deadlineAt: Date.now() + timeoutMs,
    retryBaseDelayMs: Number.isFinite(parsedRetryBaseDelayMs)
      ? Math.min(Math.max(parsedRetryBaseDelayMs, 0), GEMINI_RETRY_MAX_DELAY_MS)
      : GEMINI_RETRY_BASE_DELAY_MS,
    retryJitterRatio: Number.isFinite(parsedRetryJitterRatio)
      ? Math.min(Math.max(parsedRetryJitterRatio, 0), 1)
      : GEMINI_RETRY_JITTER_RATIO,
  };

  try {
    yield* streamGemini(messages, tools, linked.signal, retryOptions);
  } catch (error) {
    if (!error?.[GEMINI_OUTCOME_RECORDED]) {
      recordGeminiFailure(error);
    }
    if (!linked.signal.aborted) {
      throw error;
    }
    if (!options.signal?.aborted) {
      safeLog.warn("ai.gemini_timeout", "Provider request timed out");
      throw operationalError("GEMINI_TIMEOUT");
    }
  } finally {
    linked.cleanup();
  }
}
