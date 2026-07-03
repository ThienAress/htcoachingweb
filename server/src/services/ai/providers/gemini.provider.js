// Gemini LLM Provider — Google AI Free Tier
// Model: gemini-3.1-flash-lite (Free: 15 RPM, 250K TPM, 500 RPD)
// Hỗ trợ: Function Calling + Streaming

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

/**
 * Convert OpenAI-style messages → Gemini format
 */
function convertMessages(messages) {
  let systemInstruction = null;
  const contents = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      systemInstruction = { parts: [{ text: msg.content }] };
      continue;
    }

    if (msg.role === "user") {
      contents.push({ role: "user", parts: [{ text: msg.content }] });
    } else if (msg.role === "assistant") {
      const parts = [];
      if (msg.content) parts.push({ text: msg.content });
      if (msg.tool_calls) {
        for (const tc of msg.tool_calls) {
          parts.push({ functionCall: { name: tc.name, args: tc.args } });
        }
      }
      if (parts.length > 0) contents.push({ role: "model", parts });
    } else if (msg.role === "tool") {
      // Gemini API cần response là object, không phải string
      let responseData;
      try {
        responseData = typeof msg.content === "string" ? JSON.parse(msg.content) : msg.content;
      } catch {
        responseData = { result: msg.content };
      }

      contents.push({
        role: "function",
        parts: [{
          functionResponse: {
            name: msg.name,
            response: responseData,
          },
        }],
      });
    }
  }

  return { systemInstruction, contents };
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
      parameters: t.function.parameters,
    })),
  }];
}

/**
 * Gemini streaming với function calling
 * @param {Array} messages - Conversation messages (OpenAI format)
 * @param {Array} tools - Tool schemas (OpenAI format)
 * @yields {{ type: "text"|"tool_call", content?: string, toolCalls?: Array }}
 */
export async function* geminiLLMStream(messages, tools) {
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
      temperature: 0.7,
      topP: 0.9,
      maxOutputTokens: 1024,
    },
  };

  const url = `${GEMINI_BASE_URL}/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${apiKey}`;

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error("Gemini fetch error:", err.message);
    yield { type: "text", content: "⚠️ Không thể kết nối tới Gemini API. Kiểm tra kết nối mạng." };
    return;
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMsg = errorData?.error?.message || `HTTP ${response.status}`;
    console.error(`Gemini API Error [${response.status}]:`, errorMsg);

    if (response.status === 429) {
      yield { type: "text", content: "⚠️ HT Assistant đang bận (rate limit). Vui lòng thử lại sau 1 phút." };
      return;
    }
    if (response.status === 400) {
      console.error("Gemini 400 request body:", JSON.stringify(body, null, 2).slice(0, 1000));
      yield { type: "text", content: "⚠️ Lỗi xử lý. Vui lòng thử lại hoặc bắt đầu cuộc trò chuyện mới." };
      return;
    }
    if (response.status === 403) {
      yield { type: "text", content: "⚠️ API Key không hợp lệ hoặc chưa kích hoạt. Kiểm tra lại GEMINI_API_KEY." };
      return;
    }

    yield { type: "text", content: `⚠️ Lỗi AI (${response.status}): ${errorMsg}` };
    return;
  }

  // Parse SSE stream
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

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
        const candidate = data.candidates?.[0];
        if (!candidate?.content?.parts) continue;

        for (const part of candidate.content.parts) {
          if (part.text) {
            yield { type: "text", content: part.text };
          }

          if (part.functionCall) {
            yield {
              type: "tool_call",
              toolCalls: [{
                id: `gemini_${Date.now()}`,
                name: part.functionCall.name,
                args: part.functionCall.args || {},
              }],
            };
          }
        }
      } catch {
        // JSON parse error — skip malformed chunk
      }
    }
  }
}
