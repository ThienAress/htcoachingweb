// Gemini LLM Provider — Google AI Free Tier
// Model: gemini-3.1-flash-lite (Free: 15 RPM, 250K TPM, 500 RPD)
// Hỗ trợ: Function Calling + Streaming

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

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
        for (const tc of msg.tool_calls) {
          const fnCall = { name: tc.name, args: tc.args || {} };
          if (tc.id) fnCall.id = tc.id;
          parts.push({ functionCall: fnCall });
        }
      }
      if (parts.length > 0) rawContents.push({ role: "model", parts });
    } else if (msg.role === "tool") {
      let responseData;
      try {
        responseData = typeof msg.content === "string" ? JSON.parse(msg.content) : msg.content;
      } catch {
        responseData = { result: msg.content };
      }
      if (typeof responseData !== "object" || responseData === null) {
         responseData = { result: String(responseData) };
      }

      rawContents.push({
        role: "function",
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

  // 1. Gộp các block giống role liên tiếp nhau (User-User, Model-Model, Function-Function)
  const mergedContents = [];
  for (const current of rawContents) {
    const prev = mergedContents[mergedContents.length - 1];
    if (prev && prev.role === current.role) {
      prev.parts.push(...current.parts);
    } else {
      mergedContents.push({ ...current, parts: [...current.parts] });
    }
  }

  // 2. Sanitize Xen Kẽ: Đảm bảo luồng hợp lệ: user -> model -> function -> model -> user ...
  const finalContents = [];
  for (const current of mergedContents) {
    const prev = finalContents[finalContents.length - 1];

    if (current.role === "user") {
      if (prev && prev.role === "function") {
        finalContents.push({ role: "model", parts: [{ text: "Đã xử lý xong kết quả." }] });
      }
      finalContents.push(current);
    } else if (current.role === "model") {
      if (!prev) {
        finalContents.push({ role: "user", parts: [{ text: "Bắt đầu trò chuyện." }] });
      }
      finalContents.push(current);
    } else if (current.role === "function") {
      if (prev && prev.role === "model") {
        finalContents.push(current);
      } else {
        // Bỏ qua function mồ côi (trước nó không phải model có call)
        continue;
      }
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
                id: part.functionCall.id || part.id || `gemini_${Date.now()}`,
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
