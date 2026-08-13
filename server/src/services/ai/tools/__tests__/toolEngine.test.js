import { afterEach, describe, expect, it } from "vitest";

import { executeTool, isSuccessfulToolResult } from "../toolEngine.js";
import { getToolSchemas, toolRegistry } from "../toolRegistry.js";

const originalSearchKnowledge = toolRegistry.search_knowledge.execute;

afterEach(() => {
  toolRegistry.search_knowledge.execute = originalSearchKnowledge;
});

describe("AI tool runtime validation", () => {
  it("classifies validation, timeout, and internal-error responses as unsuccessful", () => {
    expect([
      isSuccessfulToolResult({ error: null, meta: { validationFailed: true } }),
      isSuccessfulToolResult({ error: null, meta: { timedOut: true } }),
      isSuccessfulToolResult({ error: null, meta: { internalError: "synthetic" } }),
      isSuccessfulToolResult({ error: "failed" }),
    ]).toEqual([false, false, false, false]);
  });

  it("only exposes public, bounded-cost tools to guest chat", () => {
    const guestToolNames = getToolSchemas({ isAuthenticated: false }).map(
      (schema) => schema.function.name,
    );

    expect(guestToolNames).not.toContain("check_wallet");
    expect(guestToolNames).not.toContain("get_workout_plan");
    expect(guestToolNames).not.toContain("search_knowledge");
    expect(guestToolNames).toContain("search_blog");
  });

  it("rejects a guest-only-disabled tool even when the provider calls it", async () => {
    toolRegistry.search_knowledge.execute = () => {
      throw new Error("executor must not be reached");
    };

    const result = await executeTool(
      "search_knowledge",
      { query: "fitness news" },
      {},
    );

    expect(result.error).toBe("Guest tool unavailable");
  });

  it("rejects out-of-range arguments before executing a tool", async () => {
    const result = await executeTool(
      "calculate_tdee",
      {
        gender: "male",
        age: 999,
        heightCm: 175,
        weightKg: 70,
        activityLevel: "moderate",
        dailyMovement: "mostly_seated",
        steps: "under_5000",
        trainingFrequency: "five_plus",
        trainingDuration: "between_45_60",
        trainingIntensity: "moderate",
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
      executeTool(
        "search_knowledge",
        { query: "CBum" },
        { userId: "authenticated-user", timeoutMs: 10 },
      ),
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
      {
        userId: "authenticated-user",
        signal: controller.signal,
        timeoutMs: 1000,
      },
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
