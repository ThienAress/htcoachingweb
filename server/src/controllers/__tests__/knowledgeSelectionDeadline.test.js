import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ options: null }));
vi.mock("../../services/ai/knowledgeRetrieval.service.js", () => ({
  searchAssistantKnowledgeBase: vi.fn(async (_query, options) => {
    state.options = options;
    return { results: [], retrieval: { method: "llm_selection" } };
  }),
}));

import { searchEntries } from "../knowledgeBase.controller.js";

afterEach(() => {
  vi.useRealTimers();
  state.options = null;
});

describe("admin KB search deadline", () => {
  it("allows30seconds and preserves the response envelope", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-09T00:00:00Z"));
    const res = new EventEmitter();
    res.json = vi.fn();
    await searchEntries({ query: { q: "Huong dan tap squat" } }, res);
    expect(state.options.deadlineAt - Date.now()).toBe(30_000);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: [],
      retrieval: { method: "llm_selection" },
    });
    expect(res.listenerCount("close")).toBe(0);
  });
});
