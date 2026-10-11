const encoder = new TextEncoder();

export const byteLength = (value) => encoder.encode(value).byteLength;

export const protocolError = (code, status) => {
  const error = new Error("DeepSeek provider unavailable");
  error.name = "AiProviderOperationalError";
  error.code = code;
  if (status) error.status = status;
  return error;
};

const validName = (value) => typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const plainObject = (value) => value && typeof value === "object" && !Array.isArray(value);

export const formatToolsForProvider = (tools = []) => {
  if (!Array.isArray(tools)) throw protocolError("DEEPSEEK_TOOL_SCHEMA_INVALID");
  const names = new Set();
  return tools.map((tool) => {
    const fn = tool?.function;
    if (tool?.type !== "function" || !validName(fn?.name) || names.has(fn.name) ||
      (fn.parameters !== undefined && !plainObject(fn.parameters))) {
      throw protocolError("DEEPSEEK_TOOL_SCHEMA_INVALID");
    }
    names.add(fn.name);
    return { type: "function", function: structuredClone(fn) };
  });
};

const inspectHistory = (messages, normalize = false) => {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw protocolError("DEEPSEEK_HISTORY_INVALID");
  }
  const ids = new Set();
  const reservedIds = new Set(messages.flatMap((message) => (
    Array.isArray(message?.tool_calls) ? message.tool_calls.map((call) => call?.id) : []
  )));
  const waiting = new Map();
  const normalized = [];
  let nextId = 0;
  for (const message of messages) {
    if (!plainObject(message) || !["system", "user", "assistant", "tool"].includes(message.role)) {
      throw protocolError("DEEPSEEK_HISTORY_INVALID");
    }
    if (message.image !== undefined) throw protocolError("DEEPSEEK_INPUT_UNSUPPORTED");
    if (message.role === "tool") {
      const pending = waiting.get(message.id);
      if (!validName(message.id) || !pending || pending.name !== message.name ||
        typeof message.content !== "string") {
        throw protocolError("DEEPSEEK_HISTORY_INVALID");
      }
      normalized.push({ ...message, id: pending.id });
      waiting.delete(message.id);
      continue;
    }
    if (waiting.size || (message.content !== undefined && typeof message.content !== "string")) {
      throw protocolError("DEEPSEEK_HISTORY_INVALID");
    }
    if (message.tool_calls !== undefined && !Array.isArray(message.tool_calls)) {
      throw protocolError("DEEPSEEK_HISTORY_INVALID");
    }
    if (message.role !== "assistant" && message.tool_calls !== undefined) {
      throw protocolError("DEEPSEEK_HISTORY_INVALID");
    }
    const toolCalls = Array.from(message.tool_calls || []).map((call) => {
      if (!validName(call?.id) || !validName(call?.name) || !plainObject(call.args) ||
        (!normalize && ids.has(call.id)) || waiting.has(call.id)) {
        throw protocolError("DEEPSEEK_HISTORY_INVALID");
      }
      let id = call.id;
      if (ids.has(id)) {
        // Reserve every stored ID so a remap cannot collide with a later group.
        do {
          nextId += 1;
          id = `history_tool_${nextId}`;
        } while (reservedIds.has(id));
        reservedIds.add(id);
      }
      ids.add(id);
      waiting.set(call.id, { name: call.name, id });
      return { ...call, id };
    });
    normalized.push({ ...message, ...(message.tool_calls !== undefined && { tool_calls: toolCalls }) });
  }
  if (waiting.size) throw protocolError("DEEPSEEK_HISTORY_INVALID");
  return normalized;
};

export const validateHistory = (messages) => {
  inspectHistory(messages);
};

export const normalizeCompletedToolHistory = (messages) => inspectHistory(messages, true);

export const toProviderMessages = (messages) => messages.map((message) => {
  if (message.role === "assistant" && message.tool_calls?.length) {
    return {
      role: "assistant", content: message.content || "", tool_calls: message.tool_calls.map((call) => ({
        id: call.id, type: "function", function: { name: call.name, arguments: JSON.stringify(call.args) },
      })),
    };
  }
  if (message.role === "tool") return { role: "tool", tool_call_id: message.id, content: String(message.content ?? "") };
  return { role: message.role, content: message.content || "" };
});

export const makeSseParser = (maxFrameBytes) => {
  let buffer = "";
  let data = [];
  let frameBytes = 0;
  const dispatch = (events) => {
    if (!data.length) { frameBytes = 0; return; }
    const value = data.join("\n");
    data = [];
    frameBytes = 0;
    events.push(value);
  };
  return {
    push(chunk, done = false) {
      buffer += chunk;
      const events = [];
      const lines = buffer.split("\n");
      buffer = done ? "" : lines.pop();
      for (let line of lines) {
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line) { dispatch(events); continue; }
        if (line.startsWith(":")) continue;
        frameBytes += byteLength(line) + 1;
        if (frameBytes > maxFrameBytes) throw protocolError("DEEPSEEK_SSE_FRAME_LIMIT");
        if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
      }
      if (byteLength(buffer) + frameBytes > maxFrameBytes) throw protocolError("DEEPSEEK_SSE_FRAME_LIMIT");
      if (done) dispatch(events);
      return events;
    },
  };
};

export const validateToolCalls = (calls, allowedNames, maxArgsBytes) => {
  if (!calls.size) throw protocolError("DEEPSEEK_TOOL_CALL_INVALID");
  let total = 0;
  const ids = new Set();
  const result = [...calls.entries()].sort(([a], [b]) => a - b).map(([, call]) => {
    if (!validName(call.id) || !allowedNames.has(call.name) || typeof call.arguments !== "string") {
      throw protocolError("DEEPSEEK_TOOL_CALL_INVALID");
    }
    if (ids.has(call.id)) throw protocolError("DEEPSEEK_TOOL_CALL_INVALID");
    ids.add(call.id);
    total += byteLength(call.arguments);
    if (total > maxArgsBytes) throw protocolError("DEEPSEEK_TOOL_ARGS_LIMIT");
    let args;
    try { args = JSON.parse(call.arguments); } catch { throw protocolError("DEEPSEEK_TOOL_ARGS_INVALID"); }
    if (!plainObject(args)) throw protocolError("DEEPSEEK_TOOL_ARGS_INVALID");
    return { id: call.id, name: call.name, args };
  });
  return result;
};
