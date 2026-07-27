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
  it("sends function responses back to Gemini as user turns", async () => {
    process.env.GEMINI_API_KEY = "test-api-key";

    const successEvent = {
      candidates: [{ content: { parts: [{ text: "Used the tool result" }] } }],
    };
    const fetchMock = vi.fn(async (_url, options) => {
      const body = JSON.parse(options.body);
      const functionResponseTurn = body.contents.find((content) =>
        content.parts.some((part) => part.functionResponse),
      );
      if (functionResponseTurn?.role !== "user") {
        return new Response(
          JSON.stringify({ error: { code: 400, status: "INVALID_ARGUMENT" } }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(`data: ${JSON.stringify(successEvent)}\n\n`, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const chunks = await collectStream(
      geminiLLMStream(
        [
          { role: "system", content: "System instructions" },
          { role: "user", content: "Calculate my TDEE" },
          {
            role: "assistant",
            content: "",
            tool_calls: [{
              id: "call_tdee_1",
              name: "calculate_tdee",
              args: { weightKg: 70 },
              thoughtSignature: "signature_tdee_1",
            }],
          },
          {
            role: "tool",
            name: "calculate_tdee",
            id: "call_tdee_1",
            content: JSON.stringify({ targetCalories: 2207 }),
          },
        ],
        [],
      ),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.contents.map((content) => content.role)).toEqual([
      "user", "model", "user",
    ]);
    expect(body.contents[1].parts[0]).toEqual({
      functionCall: {
        id: "call_tdee_1",
        name: "calculate_tdee",
        args: { weightKg: 70 },
      },
      thoughtSignature: "signature_tdee_1",
    });
    expect(body.contents[2].parts[0]).toEqual({
      functionResponse: {
        id: "call_tdee_1",
        name: "calculate_tdee",
        response: { targetCalories: 2207 },
      },
    });
    expect(chunks).toEqual([
      { type: "text", content: "Used the tool result" },
    ]);
  });

  it("preserves thought signatures from streamed Gemini function calls", async () => {
    process.env.GEMINI_API_KEY = "test-api-key";
    const toolEvent = {
      candidates: [{
        content: {
          parts: [{
            functionCall: {
              id: "call_meal_1",
              name: "suggest_meal",
              args: { mealsPerDay: 4 },
            },
            thoughtSignature: "signature_meal_1",
          }],
        },
      }],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(`data: ${JSON.stringify(toolEvent)}\n\n`, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }),
      ),
    );

    const chunks = await collectStream(
      geminiLLMStream([{ role: "user", content: "Four meals" }], []),
    );

    expect(chunks).toEqual([{
      type: "tool_call",
      toolCalls: [{
        id: "call_meal_1",
        name: "suggest_meal",
        args: { mealsPerDay: 4 },
        thoughtSignature: "signature_meal_1",
      }],
      thoughtParts: undefined,
    }]);
  });

  it("keeps parallel function calls in one ordered model turn", async () => {
    process.env.GEMINI_API_KEY = "test-api-key";
    const toolEvent = {
      candidates: [{
        content: {
          parts: [
            {
              functionCall: {
                id: "call_meal_1",
                name: "suggest_meal",
                args: { mealsPerDay: 4 },
              },
              thoughtSignature: "signature_parallel_1",
            },
            {
              functionCall: {
                id: "call_exercise_1",
                name: "search_exercises",
                args: { muscleGroup: "Ngực" },
              },
            },
          ],
        },
      }],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(`data: ${JSON.stringify(toolEvent)}\n\n`, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }),
      ),
    );

    const chunks = await collectStream(
      geminiLLMStream([{ role: "user", content: "Meal and workout" }], []),
    );

    expect(chunks).toEqual([{
      type: "tool_call",
      toolCalls: [
        {
          id: "call_meal_1",
          name: "suggest_meal",
          args: { mealsPerDay: 4 },
          thoughtSignature: "signature_parallel_1",
        },
        {
          id: "call_exercise_1",
          name: "search_exercises",
          args: { muscleGroup: "Ngực" },
        },
      ],
      thoughtParts: undefined,
    }]);
  });

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

  it("keeps tools when retrying with minimal conversation history", async () => {
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
    expect(retryBody.tools).toBeDefined();
    expect(chunks).toEqual([
      { type: "text", content: "Fallback response" },
    ]);
  });

  it("falls back without tools when the minimal tool request is still rejected", async () => {
    process.env.GEMINI_API_KEY = "test-api-key";
    const badResponse = () =>
      new Response(
        JSON.stringify({ error: { code: 400, status: "INVALID_ARGUMENT" } }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(badResponse())
      .mockResolvedValueOnce(badResponse())
      .mockResolvedValueOnce(
        new Response(
          'data: {"candidates":[{"content":{"parts":[{"text":"Tool-free fallback"}]}}]}\n\n',
          { status: 200, headers: { "Content-Type": "text/event-stream" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const tools = [{
      type: "function",
      function: {
        name: "lookup",
        description: "Lookup a value",
        parameters: { type: "object", properties: {} },
      },
    }];
    const chunks = await collectStream(
      geminiLLMStream([{ role: "user", content: "Hello" }], tools),
    );

    const minimalBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    const toolFreeBody = JSON.parse(fetchMock.mock.calls[2][1].body);
    expect(minimalBody.tools).toBeDefined();
    expect(toolFreeBody.tools).toBeUndefined();
    expect(chunks).toEqual([
      { type: "text", content: "Tool-free fallback" },
    ]);
  });
});
