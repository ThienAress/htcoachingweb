import { beforeEach, describe, expect, it } from "vitest";
import { recordDeepSeekRequest, recordDeepSeekResult } from "../providerUsageMetrics.js";
import { getMetricsSnapshot, resetMetricsForTests } from "../metrics.js";

describe("DeepSeek usage attribution", () => {
  beforeEach(resetMetricsForTests);
  it("records separate chat and selection calls, never Gemini usage", () => {
    recordDeepSeekRequest("chat");
    recordDeepSeekResult("chat", { success: true, usage: { prompt_tokens: 12, completion_tokens: 7, total_tokens: 19 } });
    recordDeepSeekRequest("kb_selection");
    recordDeepSeekResult("kb_selection", { success: false });
    expect(getMetricsSnapshot().counters).toMatchObject({
      "provider.deepseek_chat_requests": 1, "provider.deepseek_chat_succeeded": 1,
      "provider.deepseek_chat_prompt_tokens": 12, "provider.deepseek_chat_output_tokens": 7,
      "provider.deepseek_chat_total_tokens": 19, "provider.deepseek_kb_selection_requests": 1,
      "provider.deepseek_kb_selection_failed": 1, "provider.gemini_chat_requests": 0,
    });
  });
  it("rejects unbounded surface names", () => {
    expect(() => recordDeepSeekRequest("private-chat-text")).toThrow("Unknown DeepSeek surface");
  });
  it("ignores invalid token values", () => {
    recordDeepSeekResult("chat", { success: false, usage: { prompt_tokens: -2, completion_tokens: Infinity, total_tokens: "private" } });
    expect(getMetricsSnapshot().counters["provider.deepseek_chat_total_tokens"]).toBe(0);
  });
});
