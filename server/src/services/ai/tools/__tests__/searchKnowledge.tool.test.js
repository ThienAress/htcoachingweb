import { afterEach, describe, expect, it, vi } from "vitest";

import { searchKnowledge } from "../searchKnowledge.tool.js";

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
  });
});
