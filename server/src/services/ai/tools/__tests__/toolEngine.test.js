import { afterEach, describe, expect, it } from "vitest";

import { executeTool } from "../toolEngine.js";
import { toolRegistry } from "../toolRegistry.js";

const originalSearchKnowledge = toolRegistry.search_knowledge.execute;

afterEach(() => {
  toolRegistry.search_knowledge.execute = originalSearchKnowledge;
});

describe("AI tool runtime validation", () => {
  it("rejects out-of-range arguments before executing a tool", async () => {
    const result = await executeTool(
      "calculate_tdee",
      {
        gender: "male",
        age: 999,
        heightCm: 175,
        weightKg: 70,
        activityLevel: "moderate",
        goal: "maintenance",
      },
      {},
    );

    expect(result.meta.validationFailed).toBe(true);
    expect(result.meta.invalidFields).toContain("age");
  });

  it("rejects additional properties supplied by the model", async () => {
    const result = await executeTool(
      "search_exercises",
      { muscleGroup: "Ngực", limit: 5, injected: true },
      {},
    );

    expect(result.meta.validationFailed).toBe(true);
    expect(result.meta.invalidFields).toContain("parameters");
  });

  it("times out a tool that does not settle", async () => {
    toolRegistry.search_knowledge.execute = () => new Promise(() => {});

    const outcome = await Promise.race([
      executeTool("search_knowledge", { query: "CBum" }, { timeoutMs: 10 }),
      new Promise((resolve) => setTimeout(() => resolve(null), 100)),
    ]);

    expect(outcome?.meta?.timedOut).toBe(true);
  });

  it("propagates an external abort instead of swallowing it", async () => {
    toolRegistry.search_knowledge.execute = () => new Promise(() => {});
    const controller = new AbortController();
    const execution = executeTool(
      "search_knowledge",
      { query: "vận động viên Việt Nam" },
      { signal: controller.signal, timeoutMs: 1000 },
    ).then(
      () => "resolved",
      (error) => error.name,
    );

    controller.abort();
    const outcome = await Promise.race([
      execution,
      new Promise((resolve) => setTimeout(() => resolve("still-pending"), 100)),
    ]);

    expect(outcome).toBe("AbortError");
  });
});
