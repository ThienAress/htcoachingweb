import { afterEach, describe, expect, it } from "vitest";

import { executeTool, isSuccessfulToolResult } from "../toolEngine.js";
import { getToolSchemas, toolRegistry } from "../toolRegistry.js";

const originalSearchKnowledge = toolRegistry.search_knowledge.execute;
const originalSearchKnowledgeConfirmation =
  toolRegistry.search_knowledge.requiresConfirmation;

afterEach(() => {
  toolRegistry.search_knowledge.execute = originalSearchKnowledge;
  toolRegistry.search_knowledge.requiresConfirmation =
    originalSearchKnowledgeConfirmation;
});

describe("AI tool runtime validation", () => {
  it("classifies validation, timeout, and internal-error responses as unsuccessful", () => {
    expect([
      isSuccessfulToolResult({ error: null, meta: { validationFailed: true } }),
      isSuccessfulToolResult({ error: null, meta: { timedOut: true } }),
      isSuccessfulToolResult({ error: null, meta: { internalError: "synthetic" } }),
      isSuccessfulToolResult({ error: "failed" }),
      isSuccessfulToolResult({ error: null, needsConfirmation: true }),
      isSuccessfulToolResult({
        error: null,
        uiCard: { cardType: "meal", data: { status: "missing_data" } },
      }),
    ]).toEqual([false, false, false, false, false, false]);
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

  it("only exposes web search when the authenticated request route allows it", () => {
    const allowed = getToolSchemas({
      isAuthenticated: true,
      allowWebSearch: true,
    }).map((schema) => schema.function.name);
    const blocked = getToolSchemas({
      isAuthenticated: true,
      allowWebSearch: false,
    }).map((schema) => schema.function.name);

    expect({
      allowed: allowed.includes("search_knowledge"),
      blocked: blocked.includes("search_knowledge"),
    }).toEqual({ allowed: true, blocked: false });
  });

  it("preserves only the canonical web-search outcome across the tool boundary", async () => {
    toolRegistry.search_knowledge.execute = async () => ({
      text: "Không có nguồn phù hợp.",
      uiCard: null,
      meta: {
        evidenceAvailable: false,
        sourceCount: 0,
        sources: [],
        searchOutcome: "no_supported_source",
        unsafeInternalDetail: "must-not-cross",
      },
    });

    const result = await executeTool(
      "search_knowledge",
      { query: "Ronaldo routine" },
      { userId: "authenticated-user" },
    );

    expect(result.meta).toMatchObject({
      searchOutcome: "no_supported_source",
      evidenceAvailable: false,
    });
    expect(result.meta).not.toHaveProperty("unsafeInternalDetail");
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

  it("enforces the server routing allowlist again at the execution boundary", async () => {
    const originalExecute = toolRegistry.check_wallet.execute;
    toolRegistry.check_wallet.execute = () => {
      throw new Error("executor must not be reached");
    };

    try {
      const result = await executeTool(
        "check_wallet",
        {},
        {
          userId: "authenticated-user",
          allowedToolNames: ["search_exercises"],
        },
      );

      expect(result).toMatchObject({
        error: null,
        meta: {
          toolName: "check_wallet",
          validationFailed: true,
          routeBlocked: true,
        },
      });
    } finally {
      toolRegistry.check_wallet.execute = originalExecute;
    }
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

  it("does not trust a caller-supplied confirmation identifier", async () => {
    toolRegistry.search_knowledge.requiresConfirmation = true;
    toolRegistry.search_knowledge.execute = () => {
      throw new Error("executor must not be reached");
    };

    const result = await executeTool(
      "search_knowledge",
      { query: "fitness research" },
      { userId: "authenticated-user", confirmedChallengeId: "forged" },
    );

    expect(result.needsConfirmation).toBe(true);
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
