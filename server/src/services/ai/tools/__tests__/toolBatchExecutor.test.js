import { describe, expect, it, vi } from "vitest";

import {
  executeToolBatch,
  resolveToolExecutionMode,
  TOOL_EXECUTION_MODES,
} from "../toolBatchExecutor.js";
import { toolRegistry } from "../toolRegistry.js";
import { boundAiToolCalls } from "../../runtimePolicy.js";

const calls = [
  { id: "first", name: "first", args: { value: 1 } },
  { id: "second", name: "second", args: { value: 2 } },
];

const parallelRegistry = {
  first: { readOnly: true, parallelSafe: true, requiresConfirmation: false },
  second: { readOnly: true, parallelSafe: true, requiresConfirmation: false },
};

describe("AI tool batch execution", () => {
  it("requires explicit capability metadata on every registered tool", () => {
    expect(
      Object.values(toolRegistry).every(
        (tool) =>
          typeof tool.readOnly === "boolean" &&
          typeof tool.parallelSafe === "boolean",
      ),
    ).toBe(true);
  });

  it("requires bounded public confirmation copy for future mutating tools", () => {
    const confirmableTools = Object.values(toolRegistry).filter(
      (tool) => tool.requiresConfirmation === true,
    );

    expect(
      confirmableTools.every(
        (tool) =>
          typeof tool.confirmation?.title === "string" &&
          tool.confirmation.title.trim().length > 0 &&
          tool.confirmation.title.length <= 100 &&
          typeof tool.confirmation?.description === "string" &&
          tool.confirmation.description.trim().length > 0 &&
          tool.confirmation.description.length <= 300,
      ),
    ).toBe(true);
  });

  it("bounds provider calls per iteration and across the request", () => {
    const manyCalls = Array.from({ length: 10 }, (_, index) => ({
      name: `tool_${index}`,
    }));

    expect(boundAiToolCalls(manyCalls, 0)).toHaveLength(4);
    expect(boundAiToolCalls(manyCalls, 6)).toHaveLength(2);
    expect(boundAiToolCalls(manyCalls, 8)).toHaveLength(0);
  });

  it("runs an explicitly safe read-only batch concurrently and preserves order", async () => {
    let active = 0;
    let maxActive = 0;
    const executor = vi.fn(async (name) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, name === "first" ? 30 : 5));
      active -= 1;
      return { text: name };
    });

    const results = await executeToolBatch(calls, {}, {
      registry: parallelRegistry,
      executor,
    });

    expect(maxActive).toBe(2);
    expect(results.map(({ call, result }) => [call.id, result.text])).toEqual([
      ["first", "first"],
      ["second", "second"],
    ]);
  });

  it("keeps mixed or confirmation-required batches sequential", async () => {
    const registry = {
      ...parallelRegistry,
      second: {
        readOnly: false,
        parallelSafe: false,
        requiresConfirmation: true,
      },
    };
    let active = 0;
    let maxActive = 0;
    const lifecycle = [];
    const executor = async (name) => {
      lifecycle.push(`execute:${name}`);
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return { text: name };
    };

    const results = await executeToolBatch(calls, {}, {
      registry,
      executor,
      onStart: (call) => lifecycle.push(`start:${call.name}`),
    });

    expect(resolveToolExecutionMode(calls, { registry })).toBe(
      TOOL_EXECUTION_MODES.SEQUENTIAL,
    );
    expect(maxActive).toBe(1);
    expect(results.map(({ call }) => call.id)).toEqual(["first", "second"]);
    expect(lifecycle).toEqual([
      "start:first",
      "execute:first",
      "start:second",
      "execute:second",
    ]);
  });

  it("defaults unknown capabilities to sequential execution", () => {
    expect(
      resolveToolExecutionMode([{ name: "unregistered" }, { name: "first" }], {
        registry: parallelRegistry,
      }),
    ).toBe(TOOL_EXECUTION_MODES.SEQUENTIAL);
  });

  it("does not start a later sequential call after the request aborts", async () => {
    const controller = new AbortController();
    const started = [];
    const executor = vi.fn(async (name) => {
      if (name === "first") controller.abort(new Error("request stopped"));
      return { text: name };
    });

    await expect(
      executeToolBatch(calls, { signal: controller.signal }, {
        registry: {
          ...parallelRegistry,
          second: { readOnly: true, parallelSafe: false },
        },
        executor,
        onStart: (call) => started.push(call.name),
      }),
    ).rejects.toThrow("request stopped");
    expect(started).toEqual(["first"]);
    expect(executor).toHaveBeenCalledTimes(1);
  });
});
