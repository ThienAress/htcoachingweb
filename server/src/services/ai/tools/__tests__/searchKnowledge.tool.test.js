import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { searchKnowledge } from "../searchKnowledge.tool.js";
import {
  getMetricsSnapshot,
  resetMetricsForTests,
} from "../../../../observability/metrics.js";

beforeEach(resetMetricsForTests);

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GEMINI_API_KEY;
});

describe("Google grounding source boundary", () => {
  it("keeps only bounded HTTPS sources and safe Markdown labels", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: { parts: [{ text: "Kết quả tra cứu." }] },
                groundingMetadata: {
                  groundingChunks: [
                    {
                      web: {
                        title: "Trusted [source]\u202Etxt.exe",
                        uri: "https://example.com/article#tracking",
                      },
                    },
                    {
                      web: {
                        title: "Unsafe",
                        uri: "javascript:alert(document.domain)",
                      },
                    },
                    {
                      web: {
                        title: "Credential URL",
                        uri: "https://user:password@example.com/private",
                      },
                    },
                  ],
                },
              },
            ],
            usageMetadata: {
              promptTokenCount: 24,
              candidatesTokenCount: 6,
              totalTokenCount: 30,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const result = await searchKnowledge({ query: "fitness research" });

    expect(result.text).toContain(
      "[Trusted \\[source\\] txt.exe](<https://example.com/article>)",
    );
    expect(result.text).not.toContain("\u202E");
    expect(result.text).not.toContain("javascript:");
    expect(result.text).not.toContain("password");
    expect(getMetricsSnapshot().counters).toMatchObject({
      "provider.gemini_search_grounding_requests": 1,
      "provider.gemini_search_grounding_succeeded": 1,
      "provider.gemini_search_grounding_prompt_tokens": 24,
      "provider.gemini_search_grounding_output_tokens": 6,
      "provider.gemini_search_grounding_total_tokens": 30,
    });
  });

  it("counts a rejected grounding request without logging its query", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            error: { status: "UNAVAILABLE" },
            usageMetadata: {
              promptTokenCount: 5,
              candidatesTokenCount: 1,
              totalTokenCount: 6,
            },
          }),
          {
            status: 503,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );

    await searchKnowledge({ query: "synthetic private query" });

    expect(getMetricsSnapshot().counters).toMatchObject({
      "provider.gemini_search_grounding_requests": 1,
      "provider.gemini_search_grounding_failed": 1,
      "provider.gemini_search_grounding_prompt_tokens": 5,
      "provider.gemini_search_grounding_output_tokens": 1,
      "provider.gemini_search_grounding_total_tokens": 6,
    });
  });
});
