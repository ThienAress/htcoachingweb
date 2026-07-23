import { afterEach, describe, expect, it, vi } from "vitest";

import {
  formatToolsForProvider,
  geminiLLMStream,
} from "../gemini.provider.js";

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
  it("removes unsupported Gemini schema keys without mutating tool schemas", () => {
    const tools = [
      {
        type: "function",
        function: {
          name: "lookup",
          description: "Lookup a value",
          parameters: {
            type: "object",
            additionalProperties: false,
            properties: {
              filters: {
                type: "object",
                additionalProperties: false,
                properties: { query: { type: "string" } },
              },
            },
          },
        },
      },
    ];

    const formatted = formatToolsForProvider(tools);

    expect(formatted[0].functionDeclarations[0].parameters).toEqual({
      type: "object",
      properties: {
        filters: {
          type: "object",
          properties: { query: { type: "string" } },
        },
      },
    });
    expect(tools[0].function.parameters.additionalProperties).toBe(false);
    expect(
      tools[0].function.parameters.properties.filters.additionalProperties,
    ).toBe(false);
  });

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

  it("retries a rejected tool request without tools", async () => {
    process.env.GEMINI_API_KEY = "test-api-key";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { code: 400, status: "INVALID_ARGUMENT" },
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          'data: {"candidates":[{"content":{"parts":[{"text":"Fallback response"}]}}]}\n\n',
          {
            status: 200,
            headers: { "Content-Type": "text/event-stream" },
          },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const tools = [
      {
        type: "function",
        function: {
          name: "lookup",
          description: "Lookup a value",
          parameters: {
            type: "object",
            additionalProperties: false,
            properties: {},
          },
        },
      },
    ];
    const chunks = await collectStream(
      geminiLLMStream([{ role: "user", content: "Hello" }], tools),
    );

    const firstBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    const retryBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(firstBody.tools).toBeDefined();
    expect(
      firstBody.tools[0].functionDeclarations[0].parameters
        .additionalProperties,
    ).toBeUndefined();
    expect(retryBody.tools).toBeUndefined();
    expect(chunks).toEqual([
      { type: "text", content: "Fallback response" },
    ]);
  });
});
