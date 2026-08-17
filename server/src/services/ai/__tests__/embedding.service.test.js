import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearEmbeddingCacheForTests,
  EMBEDDING_DIMENSION,
  generateEmbedding,
} from "../embedding.service.js";

const VECTOR = Array.from(
  { length: EMBEDDING_DIMENSION },
  (_, index) => index / EMBEDDING_DIMENSION,
);

const successfulResponse = () => ({
  ok: true,
  json: vi.fn().mockResolvedValue({ embedding: { values: VECTOR } }),
});

describe("embedding provider single-flight", () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-key";
    clearEmbeddingCacheForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearEmbeddingCacheForTests();
  });

  it("coalesces concurrent identical misses and then serves the completed cache", async () => {
    let releaseFetch;
    const fetchPromise = new Promise((resolve) => {
      releaseFetch = () => resolve(successfulResponse());
    });
    const fetchMock = vi.fn().mockReturnValue(fetchPromise);
    vi.stubGlobal("fetch", fetchMock);

    const first = generateEmbedding("  Same QUERY  ");
    const second = generateEmbedding("same query");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    releaseFetch();
    await expect(Promise.all([first, second])).resolves.toEqual([VECTOR, VECTOR]);
    await expect(generateEmbedding("same query")).resolves.toEqual(VECTOR);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("removes failed in-flight work so a later request can retry", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: vi.fn().mockResolvedValue({}),
      })
      .mockResolvedValueOnce(successfulResponse());
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateEmbedding("retry me")).rejects.toThrow("HTTP 503");
    await expect(generateEmbedding("retry me")).resolves.toEqual(VECTOR);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("lets one caller abort without cancelling the shared provider request", async () => {
    let releaseFetch;
    let providerSignal;
    const fetchMock = vi.fn().mockImplementation((_url, options) => {
      providerSignal = options.signal;
      return new Promise((resolve) => {
        releaseFetch = () => resolve(successfulResponse());
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    const abortedCaller = generateEmbedding("shared work", {
      signal: controller.signal,
    });
    const activeCaller = generateEmbedding("shared work");
    controller.abort(new Error("caller left"));

    await expect(abortedCaller).rejects.toMatchObject({ name: "AbortError" });
    expect(providerSignal.aborted).toBe(false);
    releaseFetch();
    await expect(activeCaller).resolves.toEqual(VECTOR);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps a caller timeout independent from the shared provider deadline", async () => {
    vi.useFakeTimers();
    let releaseFetch;
    let providerSignal;
    const fetchMock = vi.fn().mockImplementation((_url, options) => {
      providerSignal = options.signal;
      return new Promise((resolve) => {
        releaseFetch = () => resolve(successfulResponse());
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const impatientCaller = generateEmbedding("shared timeout", {
      timeoutMs: 3000,
    });
    const activeCaller = generateEmbedding("shared timeout");
    const timeoutExpectation = expect(impatientCaller).rejects.toThrow(
      "request timed out",
    );
    await vi.advanceTimersByTimeAsync(3000);

    await timeoutExpectation;
    expect(providerSignal.aborted).toBe(false);
    releaseFetch();
    await expect(activeCaller).resolves.toEqual(VECTOR);
    vi.useRealTimers();
  });
});
