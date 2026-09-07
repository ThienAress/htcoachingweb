import { beforeEach, describe, expect, it } from "vitest";

import {
  getMetricsSnapshot,
  resetMetricsForTests,
} from "../../observability/metrics.js";
import {
  recordCloudinaryUsage,
  recordGeminiRequest,
  recordGeminiResult,
  recordNetlifyBuildUsage,
  recordResendUsage,
  recordSePayApiUsage,
} from "../../observability/providerUsageMetrics.js";

describe("bounded provider usage metrics", () => {
  beforeEach(resetMetricsForTests);

  it("records provider cost drivers without dynamic labels", () => {
    recordGeminiRequest("chat");
    recordGeminiResult("chat", {
      success: true,
      usage: { promptTokens: 100, outputTokens: 20, totalTokens: 120 },
    });
    recordGeminiRequest("search_grounding");
    recordGeminiResult("search_grounding", {
      success: true,
      usage: { promptTokenCount: 30, candidatesTokenCount: 5, totalTokenCount: 35 },
    });
    recordGeminiRequest("embedding");
    recordGeminiResult("embedding", {
      success: false,
      usage: { promptTokenCount: 7, totalTokenCount: 7 },
    });
    recordGeminiRequest("kb_suggestion");
    recordGeminiResult("kb_suggestion", {
      success: true,
      usage: { promptTokenCount: 40, candidatesTokenCount: 10, totalTokenCount: 50 },
    });
    recordResendUsage("attempts");
    recordResendUsage("sent");
    recordCloudinaryUsage({ operation: "upload", success: true, bytes: 2048 });
    recordSePayApiUsage({ success: true, transactions: 3 });
    recordNetlifyBuildUsage("scheduled");

    expect(getMetricsSnapshot().counters).toMatchObject({
      "provider.gemini_chat_requests": 1,
      "provider.gemini_chat_succeeded": 1,
      "provider.gemini_chat_prompt_tokens": 100,
      "provider.gemini_chat_output_tokens": 20,
      "provider.gemini_chat_total_tokens": 120,
      "provider.gemini_search_grounding_requests": 1,
      "provider.gemini_search_grounding_succeeded": 1,
      "provider.gemini_search_grounding_total_tokens": 35,
      "provider.gemini_embedding_requests": 1,
      "provider.gemini_embedding_failed": 1,
      "provider.gemini_embedding_prompt_tokens": 7,
      "provider.gemini_embedding_total_tokens": 7,
      "provider.gemini_kb_suggestion_requests": 1,
      "provider.gemini_kb_suggestion_succeeded": 1,
      "provider.gemini_kb_suggestion_total_tokens": 50,
      "provider.resend_attempts": 1,
      "provider.resend_sent": 1,
      "provider.cloudinary_uploads": 1,
      "provider.cloudinary_upload_bytes": 2048,
      "provider.sepay_api_requests": 1,
      "provider.sepay_api_pages": 1,
      "provider.sepay_transactions_received": 3,
      "provider.netlify_build_scheduled": 1,
    });
  });

  it("rejects unknown surfaces/outcomes and tracks failures", () => {
    expect(() => recordGeminiRequest("user-id")).toThrow("Unknown Gemini");
    expect(() => recordResendUsage("recipient@example.com")).toThrow(
      "Unknown Resend",
    );
    recordGeminiResult("meal_scan", { success: false });
    recordCloudinaryUsage({ operation: "delete", success: false });
    recordSePayApiUsage({ success: false });
    recordNetlifyBuildUsage("failed");

    expect(getMetricsSnapshot().counters).toMatchObject({
      "provider.gemini_meal_scan_failed": 1,
      "provider.cloudinary_delete_failures": 1,
      "provider.sepay_api_failures": 1,
      "provider.netlify_build_failed": 1,
    });
  });
});
