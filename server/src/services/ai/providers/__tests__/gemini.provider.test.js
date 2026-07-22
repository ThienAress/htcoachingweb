import { afterEach, describe, expect, it, vi } from "vitest";

import { geminiLLMStream } from "../gemini.provider.js";

const collectStream = async (stream) => {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return chunks;
};

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GEMINI_API_KEY;
});

describe("geminiLLMStream retry", () => {
  it("streams the successful retry after an initial 400 response", async () => {
    process.env.GEMINI_API_KEY = "test-api-key";

    const successEvent = {
      candidates: [
        {
          content: {
            parts: [{ text: "Recovered response" }],
          },
        },
      ],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: { message: "Invalid history" } }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response("data: " + JSON.stringify(successEvent) + "\n\n", {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const chunks = await collectStream(
      geminiLLMStream(
        [
          { role: "system", content: "System instructions" },
          { role: "user", content: "Hello" },
        ],
        [],
      ),
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(chunks).toEqual([
      { type: "text", content: "Recovered response" },
    ]);
  });
});
