import http from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deepseekLLMStream } from "../deepseek.provider.js";

const logs = vi.hoisted(() => ({ info: vi.fn() }));
vi.mock("../../../../utils/safeLogger.js", () => ({ safeLog: logs }));
vi.mock("../../../../observability/providerUsageMetrics.js", () => ({
  recordDeepSeekRequest: vi.fn(),
  recordDeepSeekResult: vi.fn(),
}));

const nativeFetch = globalThis.fetch;
let server;
const collect = async options => {
  const events = [];
  for await (const event of deepseekLLMStream([
    { role: "user", content: "Synthetic local transport probe" },
  ], [], options)) events.push(event);
  return events;
};

const startTransport = async handler => {
  vi.stubEnv("DEEPSEEK_API_KEY", "synthetic-local-key");
  vi.stubEnv("DEEPSEEK_ENDPOINT_PROFILE", "official");
  vi.stubEnv("DEEPSEEK_MODEL", "deepseek-flash");
  logs.info.mockClear();
  server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  vi.stubGlobal("fetch", (url, options) => {
    if (url !== "https://api.deepseek.com/chat/completions") throw new Error("Unexpected test egress");
    return nativeFetch(origin, options);
  });
};

const telemetry = () => logs.info.mock.calls
  .find(([name]) => name === "ai.deepseek_request_completed")?.[1];

const openSse = response => {
  response.writeHead(200, { "Content-Type": "text/event-stream" });
  response.flushHeaders();
};

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  server?.closeAllConnections();
  if (server) await new Promise(resolve => server.close(resolve));
  server = undefined;
});

describe("DeepSeek real HTTP streaming boundary", () => {
  it("reports a deadline before HTTP headers without inventing received output", async () => {
    await startTransport(() => {});
    await expect(collect({ timeoutMs: 200 })).rejects.toMatchObject({ code: "DEEPSEEK_TIMEOUT" });
    expect(telemetry()).toMatchObject({
      httpStatus: null, headersMs: null, firstByteMs: null, receivedBytes: 0,
      ttftMs: null, success: false, providerErrorCode: "DEEPSEEK_TIMEOUT",
    });
  });

  it("distinguishes HTTP200 with stalled body from a deadline before headers", async () => {
    await startTransport((_request, response) => openSse(response));
    await expect(collect({ timeoutMs: 200 })).rejects.toMatchObject({ code: "DEEPSEEK_TIMEOUT" });
    expect(telemetry()).toMatchObject({
      httpStatus: 200, headersMs: expect.any(Number), firstByteMs: null,
      receivedBytes: 0, ttftMs: null, success: false,
    });
  });

  it("records heartbeat bytes separately from the first output token", async () => {
    await startTransport((_request, response) => {
      openSse(response);
      response.write(": heartbeat\n\n");
    });
    await expect(collect({ timeoutMs: 200 })).rejects.toMatchObject({ code: "DEEPSEEK_TIMEOUT" });
    expect(telemetry()).toMatchObject({
      httpStatus: 200, headersMs: expect.any(Number), firstByteMs: expect.any(Number),
      receivedBytes: 13, ttftMs: null, reasoningObserved: false,
    });
  });

  it("preserves fragmented UTF8 text and closes a valid DONE on an open connection", async () => {
    await startTransport((_request, response) => {
      openSse(response);
      const frame = Buffer.from(
        'data: {"choices":[{"delta":{"content":"Xin 🏋 chào"},"finish_reason":"stop"}]}\r\n\r\n',
      );
      const split = frame.indexOf(Buffer.from("🏋")) + 2;
      response.write(frame.subarray(0, split));
      setTimeout(() => {
        response.write(frame.subarray(split));
        response.write("data: [DONE]\r\n\r\n");
      }, 20);
    });
    await expect(collect({ timeoutMs: 1000 })).resolves.toEqual([
      { type: "text", content: "Xin 🏋 chào" },
    ]);
    expect(telemetry()).toMatchObject({
      httpStatus: 200, success: true, firstByteMs: expect.any(Number),
      ttftMs: expect.any(Number), reasoningObserved: false,
    });
  });

  it("keeps caller cancellation distinct after headers and heartbeat bytes", async () => {
    const abort = new AbortController();
    await startTransport((_request, response) => {
      openSse(response);
      response.write(": heartbeat\n\n");
      setTimeout(() => abort.abort(), 25);
    });
    await expect(collect({ signal: abort.signal, timeoutMs: 1000 }))
      .rejects.toMatchObject({ code: "DEEPSEEK_ABORTED" });
    expect(telemetry()).toMatchObject({
      httpStatus: 200, firstByteMs: expect.any(Number), ttftMs: null,
      providerErrorCode: "DEEPSEEK_ABORTED", retryCount: 0,
    });
  });
  it("detects reasoning-only bytes without treating them as answer tokens or logging content", async () => {
    await startTransport((_request, response) => {
      openSse(response);
      response.write('data: {"choices":[{"delta":{"reasoning_content":"synthetic-private-reasoning"}}]}\n\n');
    });
    await expect(collect({ timeoutMs: 200 })).rejects.toMatchObject({ code: "DEEPSEEK_TIMEOUT" });
    expect(telemetry()).toMatchObject({
      httpStatus: 200, firstByteMs: expect.any(Number), ttftMs: null, reasoningObserved: true,
    });
    expect(JSON.stringify(logs.info.mock.calls)).not.toContain("synthetic-private-reasoning");
  });
});
