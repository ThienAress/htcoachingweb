import { afterEach, describe, expect, it, vi } from "vitest";

const metrics = { request: vi.fn(), result: vi.fn() };
vi.mock("../../../../observability/providerUsageMetrics.js", () => ({
  recordDeepSeekRequest: metrics.request,
  recordDeepSeekResult: metrics.result,
}));

const { deepseekLLMStream } = await import("../deepseek.provider.js");

const collect = async (stream) => {
  const events = [];
  for await (const event of stream) events.push(event);
  return events;
};

afterEach(() => {
  vi.unstubAllGlobals();
  metrics.request.mockReset();
  metrics.result.mockReset();
  delete process.env.DEEPSEEK_API_KEY;
  delete process.env.DEEPSEEK_MODEL;
});

describe("deepseekLLMStream", () => {
  it("sends the fixed non-thinking chat request and streams fragmented UTF-8 text", async () => {
    process.env.DEEPSEEK_API_KEY = "synthetic-key";
    const body = new TextEncoder().encode(
      ': keepalive\r\n\r\ndata: {"choices":[{"delta":{"content":"Xin 🏋"}}]}\r\n\r\ndata: {"choices":[{"delta":{"content":" chào"},"finish_reason":"stop"}]}\r\n\r\ndata: [DONE]\r\n\r\n',
    );
    const fetchMock = vi.fn().mockResolvedValue(new Response(new ReadableStream({
      start(controller) { controller.enqueue(body.slice(0, 48)); controller.enqueue(body.slice(48)); controller.close(); },
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(collect(deepseekLLMStream([{ role: "user", content: "Hi" }]))).resolves.toEqual([
      { type: "text", content: "Xin 🏋" }, { type: "text", content: " chào" },
    ]);
    const [, options] = fetchMock.mock.calls[0];
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.deepseek.com/chat/completions");
    expect(options.redirect).toBe("error");
    expect(JSON.parse(options.body)).toMatchObject({
      model: "deepseek-flash", stream: true, max_tokens: 2048,
      thinking: { type: "disabled" }, stream_options: { include_usage: true },
    });
    expect(metrics.request).toHaveBeenCalledWith("chat");
    expect(metrics.result).toHaveBeenCalledWith("chat", expect.objectContaining({ success: true }));
  });

  it("buffers parallel fragmented tool calls until tool_calls finish and DONE", async () => {
    process.env.DEEPSEEK_API_KEY = "synthetic-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response([
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_a","function":{"name":"lookup","arguments":"{\\"q\\":"}},{"index":1,"id":"call_b","function":{"name":"weather","arguments":"{\\"city\\":\\"Ha"}}]}}]}\n\n',
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"x\\"}"}},{"index":1,"function":{"arguments":" Noi\\"}"}}]},"finish_reason":"tool_calls"}]}\n\n',
      'data: [DONE]\n\n',
    ].join(""), { status: 200 })));

    await expect(collect(deepseekLLMStream([{ role: "user", content: "Hi" }], [
      { type: "function", function: { name: "lookup", parameters: { type: "object" } } },
      { type: "function", function: { name: "weather", parameters: { type: "object" } } },
    ]))).resolves.toEqual([{ type: "tool_call", toolCalls: [
      { id: "call_a", name: "lookup", args: { q: "x" } },
      { id: "call_b", name: "weather", args: { city: "Ha Noi" } },
    ] }]);
  });

  it("fails closed without DONE and never emits pending tool calls", async () => {
    process.env.DEEPSEEK_API_KEY = "synthetic-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_a","function":{"name":"lookup","arguments":"{}"}}]},"finish_reason":"tool_calls"}]}\n\n',
      { status: 200 },
    )));
    await expect(collect(deepseekLLMStream([{ role: "user", content: "Hi" }], [
      { type: "function", function: { name: "lookup", parameters: { type: "object" } } },
    ]))).rejects.toMatchObject({ code: "DEEPSEEK_STREAM_INCOMPLETE" });
    expect(metrics.result).toHaveBeenCalledWith("chat", { success: false });
  });

  it("rejects invalid config and malformed history before egress", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(collect(deepseekLLMStream([{ role: "user", content: "Hi" }]))).rejects.toMatchObject({ code: "DEEPSEEK_CONFIG_UNAVAILABLE" });
    process.env.DEEPSEEK_API_KEY = "synthetic-key";
    await expect(collect(deepseekLLMStream([{ role: "tool", id: "missing", name: "lookup", content: "{}" }]))).rejects.toMatchObject({ code: "DEEPSEEK_HISTORY_INVALID" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not retry HTTP errors and sanitizes them", async () => {
    process.env.DEEPSEEK_API_KEY = "synthetic-key";
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"error":{"message":"secret"}}', { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(collect(deepseekLLMStream([{ role: "user", content: "Hi" }]))).rejects.toMatchObject({ code: "DEEPSEEK_HTTP_ERROR", status: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("maps completed tool history by tool-call id and bounds KB selection output", async () => {
    process.env.DEEPSEEK_API_KEY = "synthetic-key";
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      'data: {"choices":[{"delta":{"content":"{\\"refs\\":[]}"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
      { status: 200 },
    ));
    vi.stubGlobal("fetch", fetchMock);
    await collect(deepseekLLMStream([
      { role: "user", content: "Find" },
      { role: "assistant", content: "", tool_calls: [{ id: "call_1", name: "lookup", args: {} }] },
      { role: "tool", id: "call_1", name: "lookup", content: "{}" },
      { role: "user", content: "Continue" },
    ], [], { surface: "kb_selection", maxOutputTokens: 999, responseFormat: "json_object" }));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[1].tool_calls[0]).toEqual({
      id: "call_1", type: "function", function: { name: "lookup", arguments: "{}" },
    });
    expect(body.messages[2]).toEqual({ role: "tool", tool_call_id: "call_1", content: "{}" });
    expect(body.max_tokens).toBe(256);
  });

  it("finishes and cancels an open reader immediately after a valid DONE", async () => {
    process.env.DEEPSEEK_API_KEY = "synthetic-key";
    let cancelCalled = false;
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(
          'data: {"choices":[{"delta":{"content":"done"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
        ));
      },
      cancel() { cancelCalled = true; },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status: 200 })));
    const iterator = deepseekLLMStream([{ role: "user", content: "Hi" }]);
    await expect(iterator.next()).resolves.toMatchObject({ value: { type: "text", content: "done" } });
    const result = await Promise.race([
      iterator.next(), new Promise((resolve) => setTimeout(() => resolve("timed-out"), 100)),
    ]);
    expect(result).toMatchObject({ done: true });
    expect(cancelCalled).toBe(true);
  });

  it("accepts multiple legal SSE frames in one transport chunk and a text/tool terminal", async () => {
    process.env.DEEPSEEK_API_KEY = "synthetic-key";
    const first = "a".repeat(32 * 1024);
    const second = "b".repeat(32 * 1024);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response([
      `data: ${JSON.stringify({ choices: [{ delta: { content: first } }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: { content: second } }] })}\n\n`,
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_a","function":{"name":"lookup","arguments":"{}"}}]},"finish_reason":"tool_calls"}]}\n\n',
      "data: [DONE]\n\n",
    ].join(""), { status: 200 })));
    const events = await collect(deepseekLLMStream([{ role: "user", content: "Hi" }], [
      { type: "function", function: { name: "lookup", parameters: { type: "object" } } },
    ]));
    expect(events).toHaveLength(3);
    expect(events[0].content).toHaveLength(first.length);
    expect(events[2]).toEqual({ type: "tool_call", toolCalls: [{ id: "call_a", name: "lookup", args: {} }] });
  });

  it("fails malformed input before egress and malformed stream structures with typed errors", async () => {
    process.env.DEEPSEEK_API_KEY = "synthetic-key";
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      'data: {"choices":[{"delta":{"tool_calls":{}}}]}\n\n', { status: 200 },
    ));
    vi.stubGlobal("fetch", fetchMock);
    await expect(collect(deepseekLLMStream([{ role: "user", content: "Hi", image: "data:image/png;base64,x" }]))).rejects.toMatchObject({ code: "DEEPSEEK_INPUT_UNSUPPORTED" });
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(collect(deepseekLLMStream([{ role: "user", content: "Hi" }]))).rejects.toMatchObject({ code: expect.stringMatching(/^DEEPSEEK_/) });
  });

  it("does not fetch a pre-aborted request and forces only an available tool", async () => {
    process.env.DEEPSEEK_API_KEY = "synthetic-key";
    const controller = new AbortController();
    controller.abort();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(collect(deepseekLLMStream([{ role: "user", content: "Hi" }], [], { signal: controller.signal }))).rejects.toMatchObject({ code: "DEEPSEEK_ABORTED" });
    await expect(collect(deepseekLLMStream([{ role: "user", content: "Hi" }], [], { requiredToolName: "missing" }))).rejects.toMatchObject({ code: "DEEPSEEK_REQUIRED_TOOL_CONFIG_INVALID" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects response and frame caps without retries", async () => {
    process.env.DEEPSEEK_API_KEY = "synthetic-key";
    const huge = "x".repeat(64 * 1024);
    const fetchMock = vi.fn().mockResolvedValue(new Response(`data: ${huge}\n\n`, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(collect(deepseekLLMStream([{ role: "user", content: "Hi" }]))).rejects.toMatchObject({ code: "DEEPSEEK_SSE_FRAME_LIMIT" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sanitizes 5xx, redirect rejection, bad JSON and provider error frames", async () => {
    process.env.DEEPSEEK_API_KEY = "synthetic-key";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockRejectedValueOnce(new TypeError("redirect refused"))
      .mockResolvedValueOnce(new Response("data: {bad}\n\n", { status: 200 }))
      .mockResolvedValueOnce(new Response('data: {"error":{"message":"private"}}\n\n', { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    for (const code of ["DEEPSEEK_HTTP_ERROR", "DEEPSEEK_NETWORK_ERROR", "DEEPSEEK_SSE_JSON_INVALID", "DEEPSEEK_STREAM_ERROR"]) {
      await expect(collect(deepseekLLMStream([{ role: "user", content: "Hi" }]))).rejects.toMatchObject({ code });
    }
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
