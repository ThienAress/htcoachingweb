import {
  recordDeepSeekRequest,
  recordDeepSeekResult,
} from "../../../observability/providerUsageMetrics.js";
import { resolveDeepseekEndpoint } from "../../../config/deepseekEndpoint.js";
import { isDeepseekProfileActive } from "../../../config/deepseekProfile.js";
import { recordDeepseekTelemetry } from "../../../observability/deepseekRequestTelemetry.js";
import {
  byteLength,
  formatToolsForProvider,
  makeSseParser,
  normalizeCompletedToolHistory,
  protocolError,
  toProviderMessages,
  validateHistory,
  validateToolCalls,
} from "./deepseek.protocol.js";

const INPUT_LIMIT = 128 * 1024;
const FRAME_LIMIT = 64 * 1024;
const RESPONSE_LIMIT = 256 * 1024;
const TOOL_ARGS_LIMIT = 64 * 1024;
const PROVIDER_TIMEOUT = 45_000;

const createSignal = (external, timeoutMs) => {
  const controller = new AbortController();
  const abortExternal = () => controller.abort(external?.reason || new Error("aborted"));
  const timer = setTimeout(() => controller.abort(new Error("timeout")), timeoutMs);
  if (external?.aborted) abortExternal();
  else external?.addEventListener("abort", abortExternal, { once: true });
  return { signal: controller.signal, cleanup: () => {
    clearTimeout(timer); external?.removeEventListener("abort", abortExternal);
  } };
};

const limitsFor = (options) => {
  const surface = options.surface || "chat";
  if (!["chat", "kb_selection", "web_grounding"].includes(surface)) throw protocolError("DEEPSEEK_OPTIONS_INVALID");
  if (options.responseFormat && !["text", "json_object"].includes(options.responseFormat)) {
    throw protocolError("DEEPSEEK_OPTIONS_INVALID");
  }
  const limit = surface === "kb_selection" ? 256 : surface === "web_grounding" ? 1200 : 2048;
  const requested = Number(options.maxOutputTokens);
  const maxTokens = Number.isFinite(requested) && requested > 0
    ? Math.min(Math.floor(requested), limit) : limit;
  const remaining = options.deadlineAt === undefined ? Infinity : Number(options.deadlineAt) - Date.now();
  const desired = Number(options.timeoutMs);
  const surfaceTimeout = surface === "kb_selection" ? 15_000 : surface === "web_grounding" ? 20_000 : PROVIDER_TIMEOUT;
  const timeout = Math.min(surfaceTimeout, Number.isFinite(desired) && desired > 0 ? desired : surfaceTimeout, remaining);
  if (!Number.isFinite(timeout) || timeout <= 0) throw protocolError("DEEPSEEK_DEADLINE_EXCEEDED");
  return { surface, maxTokens, timeout: Math.floor(timeout) };
};

const addToolDelta = (calls, deltas) => {
  if (deltas === undefined) return;
  if (!Array.isArray(deltas)) throw protocolError("DEEPSEEK_TOOL_CALL_INVALID");
  for (const delta of deltas) {
    if (!delta || typeof delta !== "object" || Array.isArray(delta)) throw protocolError("DEEPSEEK_TOOL_CALL_INVALID");
    if (!Number.isInteger(delta?.index) || delta.index < 0) throw protocolError("DEEPSEEK_TOOL_CALL_INVALID");
    const call = calls.get(delta.index) || { id: undefined, name: undefined, arguments: "" };
    if (delta.id !== undefined) {
      if (call.id && call.id !== delta.id) throw protocolError("DEEPSEEK_TOOL_CALL_INVALID");
      call.id = delta.id;
    }
    if (delta.function !== undefined && (!delta.function || typeof delta.function !== "object" || Array.isArray(delta.function))) {
      throw protocolError("DEEPSEEK_TOOL_CALL_INVALID");
    }
    if (delta.function?.name !== undefined) {
      if (call.name && call.name !== delta.function.name) throw protocolError("DEEPSEEK_TOOL_CALL_INVALID");
      call.name = delta.function.name;
    }
    if (delta.function?.arguments !== undefined) {
      if (typeof delta.function.arguments !== "string") throw protocolError("DEEPSEEK_TOOL_CALL_INVALID");
      call.arguments += delta.function.arguments;
    }
    calls.set(delta.index, call);
  }
};

const mapAbort = (linked, external) => {
  if (!linked.aborted) return null;
  return external?.aborted ? protocolError("DEEPSEEK_ABORTED") : protocolError("DEEPSEEK_TIMEOUT");
};

export { formatToolsForProvider };

export async function* deepseekLLMStream(messages, tools = [], options = {}) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw protocolError("DEEPSEEK_CONFIG_UNAVAILABLE");
  const endpoint = resolveDeepseekEndpoint();
  if (!endpoint || (endpoint.profile === "vibi" && !isDeepseekProfileActive())) {
    throw protocolError("DEEPSEEK_CONFIG_INVALID");
  }
  const model = endpoint.model;
  const normalizedMessages = normalizeCompletedToolHistory(messages);
  validateHistory(normalizedMessages);
  const formattedTools = formatToolsForProvider(tools);
  if (options.requiredToolName && !formattedTools.some((tool) => tool.function.name === options.requiredToolName)) {
    throw protocolError("DEEPSEEK_REQUIRED_TOOL_CONFIG_INVALID");
  }
  const { surface, maxTokens, timeout } = limitsFor(options);
  const body = {
    model, messages: toProviderMessages(normalizedMessages), tools: formattedTools.length ? formattedTools : undefined,
    stream: true, stream_options: { include_usage: true }, max_tokens: maxTokens,
    thinking: { type: "disabled" },
    ...(options.requiredToolName && { tool_choice: { type: "function", function: { name: options.requiredToolName } } }),
    ...(options.responseFormat === "json_object" && { response_format: { type: "json_object" } }),
  };
  if (!body.tools) delete body.tools;
  const payload = JSON.stringify(body);
  if (byteLength(payload) > INPUT_LIMIT) throw protocolError("DEEPSEEK_INPUT_LIMIT");

  const linked = createSignal(options.signal, timeout);
  let reader;
  let requested = false;
  let settled = false;
  const startedAt = performance.now();
  let firstTokenAt = null;
  let toolCount = 0;
  let usage = {};
  let errorCode = null;
  let status = null;
  try {
    if (linked.signal.aborted) throw protocolError("DEEPSEEK_ABORTED");
    recordDeepSeekRequest(surface);
    requested = true;
    let response;
    try {
      response = await fetch(endpoint.url, {
        method: "POST", redirect: "error", signal: linked.signal,
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Accept: "text/event-stream" },
        body: payload,
      });
    } catch {
      throw mapAbort(linked.signal, options.signal) || protocolError("DEEPSEEK_NETWORK_ERROR");
    }
    if (!response.ok) throw protocolError("DEEPSEEK_HTTP_ERROR", response.status);
    if (!response.body) throw protocolError("DEEPSEEK_STREAM_INCOMPLETE");

    const parser = makeSseParser(FRAME_LIMIT);
    const decoder = new TextDecoder();
    const calls = new Map();
    const allowedNames = new Set(formattedTools.map((tool) => tool.function.name));
    let responseBytes = 0, finish, done = false, textBytes = 0;
    reader = response.body.getReader();
    while (true) {
      let part;
      try { part = await reader.read(); } catch { throw mapAbort(linked.signal, options.signal) || protocolError("DEEPSEEK_STREAM_ERROR"); }
      const chunk = part.done ? decoder.decode() : decoder.decode(part.value, { stream: true });
      responseBytes += byteLength(chunk);
      if (responseBytes > RESPONSE_LIMIT) throw protocolError("DEEPSEEK_RESPONSE_LIMIT");
      for (const event of parser.push(chunk, part.done)) {
        if (done) throw protocolError("DEEPSEEK_STREAM_INCOMPLETE");
        if (event === "[DONE]") { done = true; continue; }
        let data;
        try { data = JSON.parse(event); } catch { throw protocolError("DEEPSEEK_SSE_JSON_INVALID"); }
        if (!data || typeof data !== "object" || Array.isArray(data)) throw protocolError("DEEPSEEK_SSE_JSON_INVALID");
        if (data.error) throw protocolError("DEEPSEEK_STREAM_ERROR");
        if (data.usage) usage = data.usage;
        if (data.choices !== undefined && !Array.isArray(data.choices)) throw protocolError("DEEPSEEK_STREAM_ERROR");
        const choice = data.choices?.[0];
        if (choice === undefined) continue;
        if (!choice || typeof choice !== "object" || Array.isArray(choice)) throw protocolError("DEEPSEEK_STREAM_ERROR");
        if (choice.delta !== undefined && (!choice.delta || typeof choice.delta !== "object" || Array.isArray(choice.delta))) {
          throw protocolError("DEEPSEEK_STREAM_ERROR");
        }
        if (firstTokenAt === null && (choice.delta?.content || choice.delta?.tool_calls?.length)) {
          firstTokenAt = performance.now();
        }
        if (choice.delta?.content !== undefined) {
          if (typeof choice.delta.content !== "string") throw protocolError("DEEPSEEK_STREAM_ERROR");
          textBytes += byteLength(choice.delta.content);
          if (textBytes > RESPONSE_LIMIT) throw protocolError("DEEPSEEK_RESPONSE_LIMIT");
          yield { type: "text", content: choice.delta.content };
        }
        addToolDelta(calls, choice.delta?.tool_calls);
        if (choice.finish_reason !== undefined && choice.finish_reason !== null) {
          if (finish || !["stop", "tool_calls"].includes(choice.finish_reason)) throw protocolError("DEEPSEEK_FINISH_INVALID");
          finish = choice.finish_reason;
        }
      }
      if (done || part.done) break;
    }
    if (!done || !finish) throw protocolError("DEEPSEEK_STREAM_INCOMPLETE");
    if (finish === "stop" && (!textBytes || calls.size)) throw protocolError("DEEPSEEK_FINISH_INVALID");
    const toolCalls = finish === "tool_calls"
      ? validateToolCalls(calls, allowedNames, TOOL_ARGS_LIMIT) : null;
    toolCount = toolCalls?.length || 0;
    recordDeepSeekResult(surface, { success: true, usage });
    settled = true;
    if (toolCalls) yield { type: "tool_call", toolCalls };
  } catch (error) {
    errorCode = error?.code;
    status = error?.status;
    throw error;
  } finally {
    await reader?.cancel?.().catch(() => {});
    linked.cleanup();
    if (requested && !settled) recordDeepSeekResult(surface, { success: false });
    if (requested) recordDeepseekTelemetry({
      surface, model, success: settled, startedAt, firstTokenAt, toolCount, usage, errorCode, status,
    });
  }
}
