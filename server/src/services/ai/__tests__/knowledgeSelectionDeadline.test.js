import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ entry: null }));
vi.mock("../../../models/KnowledgeEntry.js", () => ({
  default: {
    find: () => ({
      select: () => ({ sort: () => ({ limit: () => ({ lean: async () => [state.entry] }) }) }),
    }),
    findById: () => ({ select: () => ({ lean: async () => state.entry }) }),
  },
}));
vi.mock("../../../observability/providerUsageMetrics.js", () => ({
  recordDeepSeekRequest: vi.fn(),
  recordDeepSeekResult: vi.fn(),
}));

import { EMBEDDING_VERSION } from "../embeddingProfile.js";
import { searchDeepseekKnowledgeBase } from "../deepseekKnowledgeSelection.service.js";

const selectionResponse = () => new Response(
  'data: {"choices":[{"delta":{"content":"{\\"refs\\":[\\"kb_1\\"]}"},"finish_reason":"stop"}]}\n\n' +
    'data: [DONE]\n\n',
  { status: 200 },
);

const delayedFetch = (delayMs) => vi.fn((_url, { signal }) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => {
    signal.removeEventListener("abort", abort);
    resolve(selectionResponse());
  }, delayMs);
  const abort = () => {
    clearTimeout(timer);
    reject(signal.reason);
  };
  signal.addEventListener("abort", abort, { once: true });
}));

const search = (options = {}) => searchDeepseekKnowledgeBase("Huong dan tap squat", options)
  .then((value) => ({ value }), (error) => ({ error }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-09T00:00:00Z"));
  vi.stubEnv("DEEPSEEK_API_KEY", "synthetic-key");
  vi.stubEnv("DEEPSEEK_ENDPOINT_PROFILE", "official");
  vi.stubEnv("DEEPSEEK_MODEL", "deepseek-flash");
  state.entry = {
    _id: "synthetic-entry",
    question: "Huong dan tap squat",
    answer: "Tap cham va giu ky thuat an toan.",
    category: "training",
    tags: [],
    variants: [],
    sources: [{ type: "article", title: "Public source", url: "https://example.org/a" }],
    status: "published",
    embeddingStatus: "ready",
    embeddingVersion: EMBEDDING_VERSION,
    evidenceLevel: "source_backed",
    reviewStatus: "reviewed",
    freshnessClass: "stable",
    reviewedAt: new Date(),
    reviewDueAt: null,
    revision: 1,
  };
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("KB selection deadline through the real provider", () => {
  it("accepts a complete selection arriving after20seconds", async () => {
    vi.stubGlobal("fetch", delayedFetch(20_000));
    const pending = search();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(await pending).toMatchObject({ value: { results: [{ _id: "synthetic-entry" }] } });
  });

  it("caps a stalled selection at30seconds even with a later chat deadline", async () => {
    const fetchMock = delayedFetch(40_000);
    vi.stubGlobal("fetch", fetchMock);
    let settled = false;
    const pending = search({ deadlineAt: Date.now() + 75_000 }).then((result) => {
      settled = true;
      return result;
    });
    await vi.advanceTimersByTimeAsync(29_999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toMatchObject({ error: { cause: { code: "DEEPSEEK_TIMEOUT" } } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("honors a shorter remaining caller deadline", async () => {
    vi.stubGlobal("fetch", delayedFetch(20_000));
    const pending = search({ deadlineAt: Date.now() + 7_000 });
    await vi.advanceTimersByTimeAsync(7_000);
    expect(await pending).toMatchObject({ error: { cause: { code: "DEEPSEEK_TIMEOUT" } } });
  });

  it("honors caller cancellation after15seconds without retry", async () => {
    const controller = new AbortController();
    const fetchMock = delayedFetch(40_000);
    vi.stubGlobal("fetch", fetchMock);
    const pending = search({ signal: controller.signal });
    await vi.advanceTimersByTimeAsync(20_000);
    controller.abort();
    await vi.advanceTimersByTimeAsync(0);
    expect(await pending).toMatchObject({ error: { code: "DEEPSEEK_ABORTED" } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
