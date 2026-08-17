// Gemini LLM Provider — Google AI Free Tier
// Model: gemini-3.1-flash-lite (Free: 15 RPM, 250K TPM, 500 RPD)
// Hỗ trợ: Function Calling + Streaming
import { safeLog } from "../../../utils/safeLogger.js";
import {
  canonicalizeToolResultForModel,
  serializeToolResultForModel,
} from "../tools/toolResultBoundary.js";

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 45000;
const GEMINI_UNSUPPORTED_SCHEMA_KEYS = new Set(["additionalProperties"]);

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
async function* streamGemini(messages, tools, signal) {
  // Đọc API key tại runtime (không phải lúc import) để đảm bảo .env đã load
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    yield { type: "text", content: "⚠️ Chưa cấu hình GEMINI_API_KEY. Vui lòng thêm vào file .env của server." };
    return;
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

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (signal.aborted) throw err;
    safeLog.error("ai.gemini_fetch_failed", err);
    yield { type: "text", content: "⚠️ Không thể kết nối tới Gemini API. Kiểm tra kết nối mạng." };
    return;
  }

  if (!response.ok) {
    const providerError = await readProviderError(response);
    safeLog.warn("ai.gemini_http_error", "Provider returned an error", {
      status: response.status,
      ...providerError,
    });

    if (response.status === 429) {
      yield { type: "text", content: "⚠️ HT Assistant đang bận (rate limit). Vui lòng thử lại sau 1 phút." };
      return;
    }
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

      let retryResponse;
      try {
        retryResponse = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(retryBody),
          signal,
        });
      } catch (err) {
        if (signal.aborted) throw err;
        yield { type: "text", content: "Xin lỗi, tôi không thể xử lý lúc này. Bạn thử lại nhé! 😊" };
        return;
      }

      if (!retryResponse.ok && retryResponse.status === 400 && geminiTools) {
        safeLog.warn(
          "ai.gemini_tool_free_retry",
          "Retrying provider without tools after minimal retry failed",
        );
        const toolFreeRetryBody = { ...retryBody };
        delete toolFreeRetryBody.tools;
        try {
          retryResponse = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(toolFreeRetryBody),
            signal,
          });
        } catch (err) {
          if (signal.aborted) throw err;
          yield { type: "text", content: "Xin lỗi, tôi không thể xử lý lúc này. Bạn thử lại nhé! 😊" };
          return;
        }
      }

      if (!retryResponse.ok) {
        const retryError = await readProviderError(retryResponse);
        safeLog.warn("ai.gemini_retry_failed", "Minimal provider retry failed", {
          status: retryResponse.status,
          ...retryError,
        });
        yield { type: "text", content: "Xin lỗi, tôi không xử lý được yêu cầu này. Bạn thử bắt đầu cuộc trò chuyện mới nhé! 😊" };
        return;
      }

      // Dùng retryResponse thay cho response ban đầu
      response = retryResponse;
    } else if (response.status === 403) {
      yield { type: "text", content: "⚠️ API Key không hợp lệ hoặc chưa kích hoạt. Kiểm tra lại GEMINI_API_KEY." };
      return;
    } else {
      yield {
        type: "text",
        content: "HT Assistant đang gặp lỗi từ nhà cung cấp. Vui lòng thử lại sau.",
      };
      return;
    }
  }

  // Parse SSE stream
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const thoughtBuffer = []; // Buffer thought parts để gửi kèm tool_call
  const pendingToolCalls = [];

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

        // Gemini trả error trong stream body (HTTP 200 nhưng có lỗi)
        if (data.error) {
          safeLog.warn("ai.gemini_stream_error", "Provider stream error");
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
            yield { type: "text", content: part.text };
          }

          if (part.functionCall) {
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

  try {
    yield* streamGemini(messages, tools, linked.signal);
  } catch (error) {
    if (!linked.signal.aborted) throw error;
    if (!options.signal?.aborted) {
      safeLog.warn("ai.gemini_timeout", "Provider request timed out");
      yield {
        type: "text",
        content: "HT Assistant phản hồi quá lâu. Bạn thử lại sau ít phút nhé.",
      };
    }
  } finally {
    linked.cleanup();
  }
}
