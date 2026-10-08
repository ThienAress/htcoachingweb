import { beforeEach, describe, expect, it, vi } from "vitest";

const logs = vi.hoisted(() => ({ info: vi.fn() }));
vi.mock("../../utils/safeLogger.js", () => ({ safeLog: logs }));
import { recordDeepseekTelemetry } from "../deepseekRequestTelemetry.js";

beforeEach(() => logs.info.mockClear());

describe("DeepSeek request telemetry", () => {
  it("records bounded operational metadata and excludes sensitive input", () => {
    const start = performance.now() - 30;
    recordDeepseekTelemetry({ surface: "web_grounding", model: "deepseek-v4.1-flash",
      success: true, startedAt: start, firstTokenAt: start + 10, toolCount: 1,
      usage: { prompt_tokens: 21, completion_tokens: 8, total_tokens: 29 },
      prompt: "private", arguments: { health: "private" }, apiKey: "private" });
    expect(logs.info).toHaveBeenCalledWith("ai.deepseek_request_completed", {
      surface: "web_grounding", model: "deepseek-v4.1-flash", success: true,
      durationMs: expect.any(Number), ttftMs: 10, promptTokens: 21, outputTokens: 8,
      totalTokens: 29, toolCount: 1, retryCount: 0, providerErrorCode: null, httpStatus: null,
      headersMs: null, firstByteMs: null, receivedBytes: 0, requestBytes: 0, reasoningObserved: false,
    });
    expect(JSON.stringify(logs.info.mock.calls)).not.toContain("private");
  });

  it("retains timeout signals, absent TTFT and sanitizes untrusted error labels", () => {
    recordDeepseekTelemetry({ surface: "chat", model: "deepseek-flash", startedAt: performance.now(),
      firstTokenAt: null, errorCode: "DEEPSEEK_TIMEOUT", status: 504 });
    expect(logs.info.mock.calls[0][1]).toMatchObject({
      success: false, ttftMs: null, providerErrorCode: "DEEPSEEK_TIMEOUT", httpStatus: 504,
    });
    recordDeepseekTelemetry({ surface: "private", model: "private email", startedAt: performance.now(),
      firstTokenAt: null, errorCode: "private error", usage: { total_tokens: Infinity } });
    expect(logs.info.mock.calls[1][1]).toMatchObject({
      surface: "unknown", model: "unknown", providerErrorCode: "DEEPSEEK_REQUEST_FAILED", totalTokens: 0,
    });
  });
  it("bounds transport timing and byte counts without accepting untrusted metadata", () => {
    const start = performance.now() - 30;
    recordDeepseekTelemetry({ surface: "chat", model: "deepseek-flash", startedAt: start,
      firstTokenAt: null, headersAt: start + 4, firstByteAt: start + 8,
      requestBytes: 1024, receivedBytes: 2_000_000, reasoningObserved: true, status: 200 });
    expect(logs.info.mock.calls[0][1]).toMatchObject({
      headersMs: 4, firstByteMs: 8, requestBytes: 1024, receivedBytes: 1_048_576,
      reasoningObserved: true, httpStatus: 200, ttftMs: null,
    });
    recordDeepseekTelemetry({ startedAt: start, firstTokenAt: null,
      headersAt: Infinity, firstByteAt: start - 1, requestBytes: 131073,
      receivedBytes: NaN, reasoningObserved: "private" });
    expect(logs.info.mock.calls[1][1]).toMatchObject({
      headersMs: null, firstByteMs: null, requestBytes: 0, receivedBytes: 0,
      reasoningObserved: false,
    });
    expect(JSON.stringify(logs.info.mock.calls)).not.toContain("private");
  });
});
