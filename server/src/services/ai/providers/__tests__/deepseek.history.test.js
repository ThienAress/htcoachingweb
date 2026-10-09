import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deepseekLLMStream } from "../deepseek.provider.js";

vi.mock("../../../../observability/providerUsageMetrics.js", () => ({
  recordDeepSeekRequest: vi.fn(),
  recordDeepSeekResult: vi.fn(),
}));

const call = (id, name = "suggest_meal", args = {}) => ({ id, name, args });
const assistant = (...calls) => ({ role: "assistant", content: "", tool_calls: calls });
const result = (id, name = "suggest_meal", content = "{}") => ({ role: "tool", id, name, content });
const user = { role: "user", content: "Synthetic follow-up" };
const collect = async (messages) => {
  const events = [];
  for await (const event of deepseekLLMStream(messages)) events.push(event);
  return events;
};

const freeze = (value) => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

let fetchMock;
beforeEach(() => {
  vi.stubEnv("DEEPSEEK_API_KEY", "synthetic-history-test-key");
  vi.stubEnv("DEEPSEEK_ENDPOINT_PROFILE", "official");
  vi.stubEnv("DEEPSEEK_MODEL", "deepseek-flash");
  fetchMock = vi.fn().mockResolvedValue(new Response(
    'data: {"choices":[{"delta":{"content":"OK"},"finish_reason":"stop"}]}\n\n' +
    'data: [DONE]\n\n',
    { status: 200 },
  ));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("DeepSeek completed tool history", () => {
  it("sends unique bound IDs for completed turns with a reused stored ID without mutating history", async () => {
    const id = "server-suggest_meal-1";
    const messages = freeze([
      user,
      assistant(call(id, "suggest_meal", { meal: "first" })),
      result(id, "suggest_meal", '{"meal":"first"}'),
      { role: "assistant", content: "First summary" },
      user,
      assistant(call(id, "suggest_meal", { meal: "second" })),
      result(id, "suggest_meal", '{"meal":"second"}'),
      user,
    ]);
    const original = structuredClone(messages);

    await expect(collect(messages)).resolves.toEqual([{ type: "text", content: "OK" }]);

    const sent = JSON.parse(fetchMock.mock.calls[0][1].body).messages;
    const firstId = sent[1].tool_calls[0].id;
    const secondId = sent[5].tool_calls[0].id;
    expect(secondId).not.toBe(firstId);
    expect(sent).toEqual([
      user,
      { role: "assistant", content: "", tool_calls: [{
        id: firstId, type: "function", function: { name: "suggest_meal", arguments: '{"meal":"first"}' },
      }] },
      { role: "tool", tool_call_id: firstId, content: '{"meal":"first"}' },
      { role: "assistant", content: "First summary" },
      user,
      { role: "assistant", content: "", tool_calls: [{
        id: secondId, type: "function", function: { name: "suggest_meal", arguments: '{"meal":"second"}' },
      }] },
      { role: "tool", tool_call_id: secondId, content: '{"meal":"second"}' },
      user,
    ]);
    expect(messages).toEqual(original);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps parallel results bound by ID across reused groups even when result order differs", async () => {
    const messages = [
      assistant(call("a", "lookup", { q: "first-a" }), call("b", "lookup", { q: "first-b" })),
      result("b", "lookup", "first-b"),
      result("a", "lookup", "first-a"),
      user,
      assistant(call("a", "lookup", { q: "second-a" }), call("b", "lookup", { q: "second-b" })),
      result("a", "lookup", "second-a"),
      result("b", "lookup", "second-b"),
      user,
    ];
    await collect(messages);
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body).messages;
    const calls = sent.flatMap((message) => message.tool_calls || []);
    expect(new Set(calls.map((entry) => entry.id)).size).toBe(4);
    for (const entry of calls) {
      const output = sent.find((message) => message.role === "tool" && message.tool_call_id === entry.id);
      expect(output.content).toBe(JSON.parse(entry.function.arguments).q);
    }
  });

  it.each(["a".repeat(128), "history_tool_1"])(
    "avoids existing later IDs and preserves valid identifier bounds: %s",
    async (reusedId) => {
      await collect([
        assistant(call(reusedId)), result(reusedId),
        assistant(call(reusedId)), result(reusedId),
        assistant(call("history_tool_2")), result("history_tool_2"),
        assistant(call(reusedId)), result(reusedId), user,
      ]);
      const sent = JSON.parse(fetchMock.mock.calls[0][1].body).messages;
      const calls = sent.flatMap((message) => message.tool_calls || []);
      expect(new Set(calls.map((entry) => entry.id)).size).toBe(4);
      expect(calls[2].id).toBe("history_tool_2");
      for (let index = 0; index < 4; index += 1) {
        expect(calls[index].id).toMatch(/^[A-Za-z0-9_-]{1,128}$/);
        expect(sent[index * 2 + 1].tool_call_id).toBe(calls[index].id);
      }
    },
  );

  it.each([
    ["orphan result", [result("orphan")]],
    ["name mismatch", [assistant(call("a")), result("a", "lookup")]],
    ["duplicate calls in one group", [assistant(call("a"), call("a")), result("a"), result("a")]],
    ["overlapping groups", [assistant(call("a")), assistant(call("a")), result("a")]],
    ["incomplete interior group", [assistant(call("a")), user, result("a")]],
    ["incomplete final group", [assistant(call("a")), result("a"), assistant(call("a"))]],
    ["duplicate result", [assistant(call("a")), result("a"), result("a")]],
    ["partial parallel group", [assistant(call("a"), call("b")), result("a"), user]],
    ["reused group name mismatch", [
      assistant(call("a")), result("a"), assistant(call("a", "lookup")), result("a"),
    ]],
    ["reused group invalid args", [
      assistant(call("a")), result("a"), assistant(call("a", "suggest_meal", [])), result("a"),
    ]],
    ["non-assistant calls", [{ role: "user", tool_calls: [call("a")] }, result("a")]],
    ["invalid ID", [assistant(call("invalid id")), result("invalid id")]],
    ["sparse calls", [{ role: "assistant", tool_calls: new Array(1) }]],
  ])("rejects %s before egress", async (_label, messages) => {
    const original = structuredClone(messages);
    await expect(collect(freeze(messages))).rejects.toMatchObject({ code: "DEEPSEEK_HISTORY_INVALID" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(messages).toEqual(original);
  });
});
