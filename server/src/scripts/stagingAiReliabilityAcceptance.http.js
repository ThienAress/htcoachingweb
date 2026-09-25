import crypto from "node:crypto";
import { createAccessToken } from "./stagingAiChatAcceptance.http.js";
import { EXPECTED_CLIENT_URL } from "./stagingAiChatAcceptance.config.js";

const failure = (code) => {
  const error = new Error(code);
  error.code = code;
  return error;
};

export const readChatSse = async (response) => {
  if (response.status !== 200 || !response.headers.get("content-type")?.includes("text/event-stream")) {
    throw failure("STAGING_AI_RELIABILITY_HTTP_FAILED");
  }
  if (!response.body) throw failure("STAGING_AI_RELIABILITY_SSE_INVALID");
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let buffer = "";
  let bytes = 0;
  let doneCount = 0;
  let conversationId = null;
  let text = "";
  const cards = [];
  let toolResults = 0;
  const consume = (frame) => {
    const lines = frame.split("\n").filter((line) => line.startsWith("data:"));
    if (!lines.length) return;
    let event;
    try { event = JSON.parse(lines.map((line) => line.slice(5).trimStart()).join("\n")); }
    catch { throw failure("STAGING_AI_RELIABILITY_SSE_INVALID"); }
    if (!event || typeof event.type !== "string" || doneCount) {
      throw failure("STAGING_AI_RELIABILITY_SSE_INVALID");
    }
    if (event.type === "error") throw failure("STAGING_AI_RELIABILITY_STREAM_ERROR");
    if (event.type === "text") {
      if (typeof event.content !== "string") throw failure("STAGING_AI_RELIABILITY_SSE_INVALID");
      text += event.content;
    }
    if (event.type === "ui_card") cards.push({ cardType: event.cardType, data: event.data });
    if (event.type === "tool_result") toolResults += 1;
    if (event.type === "conversation" || event.type === "done") {
      if (!/^[a-f0-9]{24}$/i.test(String(event.conversationId || "")) ||
          (conversationId && conversationId !== String(event.conversationId))) {
        throw failure("STAGING_AI_RELIABILITY_SSE_INVALID");
      }
      conversationId = String(event.conversationId);
    }
    if (event.type === "done") {
      if (event.duplicate === true) throw failure("STAGING_AI_RELIABILITY_DUPLICATE");
      doneCount += 1;
    }
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 1_000_000) throw failure("STAGING_AI_RELIABILITY_SSE_TOO_LARGE");
      try { buffer += decoder.decode(value, { stream: true }); }
      catch { throw failure("STAGING_AI_RELIABILITY_SSE_INVALID"); }
      buffer = buffer.replaceAll("\r\n", "\n");
      let boundary;
      while ((boundary = buffer.indexOf("\n\n")) >= 0) {
        consume(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
      }
    }
    try { buffer += decoder.decode(); }
    catch { throw failure("STAGING_AI_RELIABILITY_SSE_INVALID"); }
    buffer = buffer.replaceAll("\r\n", "\n");
    if (buffer.trim()) throw failure("STAGING_AI_RELIABILITY_SSE_INVALID");
    if (doneCount !== 1 || !conversationId || !text.trim()) {
      throw failure("STAGING_AI_RELIABILITY_SSE_INCOMPLETE");
    }
    return { conversationId, text, cards, toolResults };
  } finally {
    reader.releaseLock();
  }
};

export const createReliabilityClient = ({ origin, user, jwtSecret, fetchImpl = fetch }) => {
  const csrfToken = crypto.randomBytes(32).toString("hex");
  return async ({ message, conversationId, requestId }) => {
    const accessToken = createAccessToken(user, jwtSecret);
    const body = { message, requestId, ...(conversationId && { conversationId }) };
    const response = await fetchImpl(`${origin}/api/ai/chat`, {
      method: "POST",
      headers: {
        Accept: "text/event-stream",
        "Content-Type": "application/json",
        Origin: EXPECTED_CLIENT_URL,
        Cookie: `accessToken=${accessToken}; csrfToken=${csrfToken}`,
        "X-CSRF-Token": csrfToken,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90_000),
    });
    return readChatSse(response);
  };
};
