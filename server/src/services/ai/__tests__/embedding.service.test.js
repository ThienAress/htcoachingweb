import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearEmbeddingCacheForTests,
  EMBEDDING_DIMENSION,
  EMBEDDING_VERSION,
  generateEmbedding,
  LEGACY_EMBEDDING_VERSION,
  prepareEmbeddingInput,
  searchKnowledgeBase,
} from "../embedding.service.js";
import KnowledgeEntry from "../../../models/KnowledgeEntry.js";
import {
  getMetricsSnapshot,
  resetMetricsForTests,
} from "../../../observability/metrics.js";

const VECTOR = Array.from(
  { length: EMBEDDING_DIMENSION },
  (_, index) => index / EMBEDDING_DIMENSION,
);

const successfulResponse = () => ({
  ok: true,
  json: vi.fn().mockResolvedValue({
    embedding: { values: VECTOR },
    usageMetadata: {
      promptTokenCount: 12,
      candidatesTokenCount: 0,
      totalTokenCount: 12,
    },
  }),
});

describe("embedding provider single-flight", () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-key";
    clearEmbeddingCacheForTests();
    resetMetricsForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearEmbeddingCacheForTests();
    delete process.env.KB_VECTOR_INDEX;
    delete process.env.KB_VARIANT_VECTOR_INDEX;
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
    expect(getMetricsSnapshot().counters).toMatchObject({
      "provider.gemini_embedding_requests": 1,
      "provider.gemini_embedding_succeeded": 1,
      "provider.gemini_embedding_prompt_tokens": 12,
      "provider.gemini_embedding_total_tokens": 12,
    });
  });

  it("removes failed in-flight work so a later request can retry", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: vi.fn().mockResolvedValue({
          usageMetadata: {
            promptTokenCount: 7,
            totalTokenCount: 7,
          },
        }),
      })
      .mockResolvedValueOnce(successfulResponse());
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateEmbedding("retry me")).rejects.toThrow("HTTP 503");
    await expect(generateEmbedding("retry me")).resolves.toEqual(VECTOR);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getMetricsSnapshot().counters).toMatchObject({
      "provider.gemini_embedding_requests": 2,
      "provider.gemini_embedding_failed": 1,
      "provider.gemini_embedding_succeeded": 1,
      "provider.gemini_embedding_prompt_tokens": 19,
      "provider.gemini_embedding_total_tokens": 19,
    });
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

  it("gives the question-answering query and document formats a distinct version", () => {
    const query = prepareEmbeddingInput("  Creatine có tác dụng gì?  ", {
      inputType: "query",
      profileId: "question-answering-v1",
    });
    const document = prepareEmbeddingInput("  Creatine có tác dụng gì?  ", {
      inputType: "document",
      profileId: "question-answering-v1",
    });

    expect({ query, document, legacyVersion: LEGACY_EMBEDDING_VERSION }).toEqual({
      query: {
        inputType: "query",
        profileId: "question-answering-v1",
        text: "task: question answering | query: creatine có tác dụng gì?",
        version: "gemini-embedding-2:768:question-answering-v1",
      },
      document: {
        inputType: "document",
        profileId: "question-answering-v1",
        text: "title: none | text: creatine có tác dụng gì?",
        version: "gemini-embedding-2:768:question-answering-v1",
      },
      legacyVersion: "gemini-embedding-2:768",
    });
  });

  it("uses an explicitly requested profile for provider input and cache isolation", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => successfulResponse());
    vi.stubGlobal("fetch", fetchMock);

    await generateEmbedding("Creatine có tác dụng gì?", {
      inputType: "document",
    });
    await generateEmbedding("Creatine có tác dụng gì?", {
      inputType: "document",
      profileId: "question-answering-v1",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(
      JSON.parse(fetchMock.mock.calls[1][1].body).content.parts[0].text,
    ).toBe("title: none | text: creatine có tác dụng gì?");
  });
});

describe("Knowledge Base retrieval parity", () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-key";
    clearEmbeddingCacheForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    clearEmbeddingCacheForTests();
    delete process.env.KB_VECTOR_INDEX;
    delete process.env.KB_VARIANT_VECTOR_INDEX;
  });

  it("keeps production defaults at top three and threshold 0.75", async () => {
    const existsSpy = vi.spyOn(KnowledgeEntry, "exists").mockResolvedValue(null);

    await expect(searchKnowledgeBase("synthetic query")).resolves.toEqual([]);

    expect(existsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "published",
        embeddingStatus: "ready",
        embeddingVersion: EMBEDDING_VERSION,
        $or: [
          { reviewDueAt: { $exists: false } },
          { reviewDueAt: null },
          { reviewDueAt: { $gt: expect.any(Date) } },
        ],
      }),
    );
  });

  it("queries current-version variants through Atlas while root fallback stays primary-only", async () => {
    process.env.KB_VECTOR_INDEX = "synthetic_root_index";
    process.env.KB_VARIANT_VECTOR_INDEX = "synthetic_variant_index";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(successfulResponse()));
    vi.spyOn(KnowledgeEntry, "exists").mockResolvedValue({ _id: "synthetic" });
    const variantId = "68c3cd2c192a76513568606d";
    const aggregateSpy = vi
      .spyOn(KnowledgeEntry, "aggregate")
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          _id: variantId,
          question: "Cách thực hiện squat?",
          answer: "Synthetic answer.",
          category: "training",
          tags: [],
          status: "published",
          embeddingStatus: "ready",
          embedding: Array(EMBEDDING_DIMENSION).fill(0),
          embeddingVersion: EMBEDDING_VERSION,
          variants: [{ text: "Squat sao cho đúng?", embedding: VECTOR }],
          variantCount: 1,
          evidenceLevel: "source_backed",
          reviewStatus: "reviewed",
          reviewDueAt: new Date("2099-01-01T00:00:00.000Z"),
          similarity: 1,
        },
      ]);
    const findSpy = vi.spyOn(KnowledgeEntry, "find").mockReturnValue({
      select: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([]),
    });

    const results = await searchKnowledgeBase("Squat sao cho đúng?", {
      limit: 3,
      threshold: 0.75,
    });

    expect(results).toEqual([
      expect.objectContaining({
        _id: variantId,
        category: "training",
        matchedQuestion: "Squat sao cho đúng?",
        similarity: 1,
        sources: [],
        evidenceLevel: "source_backed",
        reviewStatus: "reviewed",
        freshnessClass: "stable",
        reviewDueAt: new Date("2099-01-01T00:00:00.000Z"),
        reviewedAt: null,
        revision: 1,
      }),
    ]);
    expect(aggregateSpy).toHaveBeenCalledTimes(2);
    expect(aggregateSpy.mock.calls[0][0][0].$vectorSearch).toMatchObject({
      index: "synthetic_root_index",
      path: "embedding",
      filter: {
        status: "published",
        embeddingStatus: "ready",
        embeddingVersion: EMBEDDING_VERSION,
        reviewStatus: "reviewed",
        evidenceLevel: {
          $in: ["editor_reviewed", "source_backed", "canonical_internal"],
        },
        $or: [
          { reviewDueAt: { $exists: false } },
          { reviewDueAt: null },
          { reviewDueAt: { $gt: expect.any(Date) } },
        ],
      },
    });
    expect(aggregateSpy.mock.calls[1][0][0].$vectorSearch).toMatchObject({
      index: "synthetic_variant_index",
      path: "variants.embedding",
      parentFilter: expect.objectContaining({
        embeddingVersion: EMBEDDING_VERSION,
        reviewStatus: "reviewed",
        evidenceLevel: {
          $in: ["editor_reviewed", "source_backed", "canonical_internal"],
        },
        $or: [
          { reviewDueAt: { $exists: false } },
          { reviewDueAt: null },
          { reviewDueAt: { $gt: expect.any(Date) } },
        ],
      }),
      nestedOptions: { scoreMode: "max" },
    });
    expect(
      aggregateSpy.mock.calls[1][0][0].$vectorSearch,
    ).not.toHaveProperty("filter");
    expect(findSpy).toHaveBeenCalledTimes(1);
    expect(findSpy).toHaveBeenCalledWith(
      expect.not.objectContaining({ variantCount: { $gt: 0 } }),
    );
  });

  it("uses a bounded variant fallback when the variant Atlas index is not configured", async () => {
    process.env.KB_VECTOR_INDEX = "synthetic_root_index";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(successfulResponse()));
    vi.spyOn(KnowledgeEntry, "exists").mockResolvedValue({ _id: "synthetic" });
    const aggregateSpy = vi.spyOn(KnowledgeEntry, "aggregate").mockResolvedValue([]);
    const limitSpy = vi.fn().mockReturnThis();
    const findSpy = vi.spyOn(KnowledgeEntry, "find").mockReturnValue({
      select: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      limit: limitSpy,
      lean: vi.fn().mockResolvedValue([
        {
          _id: "68c3cd2c192a765135686080",
          question: "Cách thực hiện squat?",
          answer: "Synthetic answer.",
          category: "training",
          tags: [],
          status: "published",
          embeddingStatus: "ready",
          embedding: Array(EMBEDDING_DIMENSION).fill(0),
          embeddingVersion: EMBEDDING_VERSION,
          variants: [{ text: "Squat sao cho đúng?", embedding: VECTOR }],
          variantCount: 1,
          evidenceLevel: "source_backed",
          reviewStatus: "reviewed",
          reviewDueAt: null,
        },
      ]),
    });

    const results = await searchKnowledgeBase("Squat sao cho đúng?");

    expect(results).toEqual([
      expect.objectContaining({
        _id: "68c3cd2c192a765135686080",
        matchedQuestion: "Squat sao cho đúng?",
        matchSource: "variant",
      }),
    ]);
    expect(aggregateSpy).toHaveBeenCalledTimes(1);
    expect(limitSpy).toHaveBeenCalledWith(expect.any(Number));
    expect(limitSpy.mock.calls[0][0]).toBeLessThanOrEqual(2000);
    expect(findSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        variantCount: { $gt: 0 },
        $or: [
          { reviewDueAt: { $exists: false } },
          { reviewDueAt: null },
          { reviewDueAt: { $gt: expect.any(Date) } },
        ],
      }),
    );
  });

  it("uses the bounded variant fallback when the configured nested index is incompatible", async () => {
    process.env.KB_VECTOR_INDEX = "synthetic_root_index";
    process.env.KB_VARIANT_VECTOR_INDEX = "synthetic_variant_index";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(successfulResponse()));
    vi.spyOn(KnowledgeEntry, "exists").mockResolvedValue({ _id: "synthetic" });
    const aggregateSpy = vi
      .spyOn(KnowledgeEntry, "aggregate")
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error("nestedRoot mismatch"));
    vi.spyOn(KnowledgeEntry, "find").mockReturnValue({
      select: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([
        {
          _id: "68c3cd2c192a765135686081",
          question: "Cách thực hiện deadlift?",
          answer: "Synthetic answer.",
          category: "training",
          tags: [],
          status: "published",
          embeddingStatus: "ready",
          embedding: Array(EMBEDDING_DIMENSION).fill(0),
          embeddingVersion: EMBEDDING_VERSION,
          variants: [{ text: "Deadlift sao cho đúng?", embedding: VECTOR }],
          variantCount: 1,
          evidenceLevel: "source_backed",
          reviewStatus: "reviewed",
          reviewDueAt: null,
        },
      ]),
    });

    const results = await searchKnowledgeBase("Deadlift sao cho đúng?");

    expect(results).toEqual([
      expect.objectContaining({
        _id: "68c3cd2c192a765135686081",
        matchedQuestion: "Deadlift sao cho đúng?",
        matchSource: "variant",
      }),
    ]);
    expect(aggregateSpy).toHaveBeenCalledTimes(2);
  });

  it("uses the bounded root fallback when a configured Atlas index returns no rows", async () => {
    process.env.KB_VECTOR_INDEX = "synthetic_root_index";
    process.env.KB_VARIANT_VECTOR_INDEX = "synthetic_variant_index";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(successfulResponse()));
    vi.spyOn(KnowledgeEntry, "exists").mockResolvedValue({ _id: "synthetic" });
    vi.spyOn(KnowledgeEntry, "aggregate").mockResolvedValue([]);
    const findSpy = vi.spyOn(KnowledgeEntry, "find").mockReturnValue({
      select: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([
        {
          _id: "68c3cd2c192a765135686082",
          question: "Synthetic root fallback",
          answer: "Recovered from a bounded scan.",
          category: "training",
          tags: [],
          status: "published",
          embeddingStatus: "ready",
          embedding: VECTOR,
          embeddingVersion: EMBEDDING_VERSION,
          variants: [],
          variantCount: 0,
          evidenceLevel: "source_backed",
          reviewStatus: "reviewed",
          reviewDueAt: null,
        },
      ]),
    });

    const results = await searchKnowledgeBase("Synthetic root fallback");

    expect(results).toEqual([
      expect.objectContaining({
        _id: "68c3cd2c192a765135686082",
        matchSource: "primary",
      }),
    ]);
    expect(findSpy).toHaveBeenCalledWith(
      expect.not.objectContaining({ variantCount: { $gt: 0 } }),
    );
  });

  it("does not fallback when Atlas returns healthy candidates below the answer threshold", async () => {
    process.env.KB_VECTOR_INDEX = "synthetic_root_index";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(successfulResponse()));
    vi.spyOn(KnowledgeEntry, "exists")
      .mockResolvedValueOnce({ _id: "synthetic" })
      .mockResolvedValueOnce(null);
    vi.spyOn(KnowledgeEntry, "aggregate").mockResolvedValue([
      {
        _id: "68c3cd2c192a765135686085",
        question: "Low-confidence Atlas candidate",
        answer: "Must remain below the answer threshold.",
        category: "training",
        tags: [],
        status: "published",
        embeddingStatus: "ready",
        embeddingVersion: EMBEDDING_VERSION,
        evidenceLevel: "source_backed",
        reviewStatus: "reviewed",
        reviewDueAt: null,
        similarity: 0.7,
      },
    ]);
    const findSpy = vi.spyOn(KnowledgeEntry, "find");

    await expect(
      searchKnowledgeBase("Healthy Atlas no-hit", { threshold: 0.75 }),
    ).resolves.toEqual([]);
    expect(findSpy).not.toHaveBeenCalled();
  });

  it("uses the bounded variant fallback when a configured nested index returns no rows", async () => {
    process.env.KB_VECTOR_INDEX = "synthetic_root_index";
    process.env.KB_VARIANT_VECTOR_INDEX = "synthetic_variant_index";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(successfulResponse()));
    vi.spyOn(KnowledgeEntry, "exists").mockResolvedValue({ _id: "synthetic" });
    vi.spyOn(KnowledgeEntry, "aggregate")
      .mockResolvedValueOnce([
        {
          _id: "68c3cd2c192a765135686083",
          question: "Synthetic Atlas root hit",
          answer: "Root answer.",
          category: "training",
          tags: [],
          status: "published",
          embeddingStatus: "ready",
          embeddingVersion: EMBEDDING_VERSION,
          evidenceLevel: "source_backed",
          reviewStatus: "reviewed",
          reviewDueAt: null,
          similarity: 0.95,
        },
      ])
      .mockResolvedValueOnce([]);
    vi.spyOn(KnowledgeEntry, "find").mockReturnValue({
      select: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([
        {
          _id: "68c3cd2c192a765135686084",
          question: "Canonical variant source",
          answer: "Variant answer.",
          category: "training",
          tags: [],
          status: "published",
          embeddingStatus: "ready",
          embedding: VECTOR,
          embeddingVersion: EMBEDDING_VERSION,
          variants: [{ text: "Synthetic nested fallback", embedding: VECTOR }],
          variantCount: 1,
          evidenceLevel: "source_backed",
          reviewStatus: "reviewed",
          reviewDueAt: null,
        },
      ]),
    });

    const results = await searchKnowledgeBase("Synthetic nested fallback");

    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          _id: "68c3cd2c192a765135686084",
          matchedQuestion: "Synthetic nested fallback",
          matchSource: "variant",
        }),
      ]),
    );
  });

  it("normalizes fallback cosine similarity to the same zero-to-one scale as Atlas", async () => {
    const queryVector = Array(EMBEDDING_DIMENSION).fill(0);
    queryVector[0] = 1;
    const cosinePointSixVector = Array(EMBEDDING_DIMENSION).fill(0);
    cosinePointSixVector[0] = 0.6;
    cosinePointSixVector[1] = 0.8;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          embedding: { values: queryVector },
        }),
      }),
    );
    vi.spyOn(KnowledgeEntry, "exists").mockResolvedValue({ _id: "synthetic" });
    vi.spyOn(KnowledgeEntry, "find").mockReturnValue({
      select: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([
        {
          _id: "68c3cd2c192a76513568606f",
          question: "Synthetic fallback score",
          answer: "Synthetic answer.",
          category: "training",
          tags: [],
          status: "published",
          embeddingStatus: "ready",
          embedding: cosinePointSixVector,
          embeddingVersion: EMBEDDING_VERSION,
          variants: [],
          variantCount: 0,
          evidenceLevel: "editor_reviewed",
          reviewStatus: "reviewed",
        },
      ]),
    });

    const results = await searchKnowledgeBase("normalized score query", {
      threshold: 0.75,
    });

    expect(results).toEqual([
      expect.objectContaining({ similarity: 0.8 }),
    ]);
  });

  it("excludes stale, expired, and legacy fallback candidates before ranking", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-12T00:00:00.000Z"));
    const queryVector = Array(EMBEDDING_DIMENSION).fill(0);
    queryVector[0] = 1;
    const eligibleVector = Array(EMBEDDING_DIMENSION).fill(0);
    eligibleVector[0] = 0.8;
    eligibleVector[1] = 0.6;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          embedding: { values: queryVector },
        }),
      }),
    );
    vi.spyOn(KnowledgeEntry, "exists").mockResolvedValue({ _id: "synthetic" });
    vi.spyOn(KnowledgeEntry, "find").mockReturnValue({
      select: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([
        {
          _id: "68c3cd2c192a765135686071",
          question: "Synthetic stale candidate",
          answer: "Must not rank.",
          embedding: queryVector,
          status: "published",
          embeddingStatus: "ready",
          embeddingVersion: EMBEDDING_VERSION,
          evidenceLevel: "source_backed",
          reviewStatus: "stale",
        },
        {
          _id: "68c3cd2c192a765135686072",
          question: "Synthetic legacy candidate",
          answer: "Must not rank.",
          embedding: queryVector,
          status: "published",
          embeddingStatus: "ready",
          embeddingVersion: EMBEDDING_VERSION,
          evidenceLevel: "legacy_unverified",
          reviewStatus: "needs_review",
        },
        {
          _id: "68c3cd2c192a765135686073",
          question: "Synthetic expired candidate",
          answer: "Must not rank.",
          embedding: queryVector,
          status: "published",
          embeddingStatus: "ready",
          embeddingVersion: EMBEDDING_VERSION,
          evidenceLevel: "source_backed",
          reviewStatus: "reviewed",
          reviewDueAt: new Date("2026-09-11T00:00:00.000Z"),
        },
        {
          _id: "68c3cd2c192a765135686074",
          question: "Synthetic current candidate",
          answer: "Increase load gradually.",
          embedding: eligibleVector,
          status: "published",
          embeddingStatus: "ready",
          embeddingVersion: EMBEDDING_VERSION,
          evidenceLevel: "source_backed",
          reviewStatus: "reviewed",
          reviewDueAt: new Date("2099-01-01T00:00:00.000Z"),
        },
      ]),
    });

    const results = await searchKnowledgeBase("current evidence query", {
      threshold: 0.75,
    });

    expect(results).toEqual([
      expect.objectContaining({
        _id: "68c3cd2c192a765135686074",
        question: "Synthetic current candidate",
      }),
    ]);
  });

  it("filters Atlas candidates by the active embedding version before ranking", async () => {
    process.env.KB_VECTOR_INDEX = "synthetic_index";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(successfulResponse()));
    vi.spyOn(KnowledgeEntry, "exists").mockResolvedValue({ _id: "synthetic" });
    const aggregateSpy = vi.spyOn(KnowledgeEntry, "aggregate").mockResolvedValue([]);
    vi.spyOn(KnowledgeEntry, "find").mockReturnValue({
      select: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([]),
    });

    await searchKnowledgeBase("versioned query");

    const pipeline = aggregateSpy.mock.calls[0][0];
    expect(pipeline[0].$vectorSearch.filter).toMatchObject({
      embeddingVersion: EMBEDDING_VERSION,
      $or: [
        { reviewDueAt: { $exists: false } },
        { reviewDueAt: null },
        { reviewDueAt: { $gt: expect.any(Date) } },
      ],
    });
    expect(pipeline.find((stage) => stage.$match)?.$match).toMatchObject({
      $or: [
        { reviewDueAt: { $exists: false } },
        { reviewDueAt: null },
        { reviewDueAt: { $gt: expect.any(Date) } },
      ],
    });
    expect(pipeline.find((stage) => stage.$match)?.$match).not.toHaveProperty(
      "similarity",
    );
  });

  it("post-filters an expired Atlas hit before returning current evidence", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-12T00:00:00.000Z"));
    process.env.KB_VECTOR_INDEX = "synthetic_index";
    process.env.KB_VARIANT_VECTOR_INDEX = "synthetic_variant_index";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(successfulResponse()));
    vi.spyOn(KnowledgeEntry, "exists")
      .mockResolvedValueOnce({ _id: "synthetic" })
      .mockResolvedValueOnce(null);
    vi.spyOn(KnowledgeEntry, "aggregate")
      .mockResolvedValueOnce([
        {
          _id: "68c3cd2c192a765135686075",
          question: "Synthetic expired Atlas hit",
          answer: "Must not return.",
          status: "published",
          embeddingStatus: "ready",
          embeddingVersion: EMBEDDING_VERSION,
          evidenceLevel: "source_backed",
          reviewStatus: "reviewed",
          reviewDueAt: new Date("2026-09-11T00:00:00.000Z"),
          similarity: 0.99,
        },
        {
          _id: "68c3cd2c192a765135686076",
          question: "Synthetic current Atlas hit",
          answer: "Increase load gradually.",
          status: "published",
          embeddingStatus: "ready",
          embeddingVersion: EMBEDDING_VERSION,
          evidenceLevel: "source_backed",
          reviewStatus: "reviewed",
          reviewDueAt: new Date("2027-01-01T00:00:00.000Z"),
          similarity: 0.9,
        },
      ])
      .mockResolvedValueOnce([]);

    const results = await searchKnowledgeBase("current Atlas evidence");

    expect(results).toEqual([
      expect.objectContaining({
        _id: "68c3cd2c192a765135686076",
        question: "Synthetic current Atlas hit",
      }),
    ]);
  });

  it("projects and preserves category plus evidence metadata for Atlas results", async () => {
    process.env.KB_VECTOR_INDEX = "synthetic_index";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(successfulResponse()));
    vi.spyOn(KnowledgeEntry, "exists").mockResolvedValue({ _id: "synthetic" });
    const aggregateSpy = vi.spyOn(KnowledgeEntry, "aggregate").mockResolvedValue([
      {
        _id: "68c3cd2c192a76513568606e",
        question: "HTCOACHING cung cấp gì?",
        answer: "Synthetic canonical internal answer.",
        category: "platform",
        tags: ["platform"],
        status: "published",
        embeddingStatus: "ready",
        embeddingVersion: EMBEDDING_VERSION,
        sources: [
          {
            type: "internal",
            title: "Synthetic platform policy",
            publisher: "HTCOACHING",
            evidenceTier: "canonical",
          },
        ],
        evidenceLevel: "canonical_internal",
        reviewStatus: "reviewed",
        freshnessClass: "stable",
        reviewDueAt: null,
        reviewedAt: new Date("2026-09-12T00:00:00.000Z"),
        revision: 2,
        similarity: 0.98,
      },
    ]);
    vi.spyOn(KnowledgeEntry, "find").mockReturnValue({
      select: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([]),
    });

    const [result] = await searchKnowledgeBase("HTCOACHING là gì?");

    expect(result).toMatchObject({
      category: "platform",
      evidenceLevel: "canonical_internal",
      reviewStatus: "reviewed",
      freshnessClass: "stable",
      revision: 2,
      sources: [
        expect.objectContaining({
          type: "internal",
          evidenceTier: "canonical",
        }),
      ],
    });
    const projectStage = aggregateSpy.mock.calls[0][0].find(
      (stage) => stage.$project,
    );
    expect(projectStage.$project).toMatchObject({
      category: 1,
      status: 1,
      embeddingStatus: 1,
      sources: 1,
      evidenceLevel: 1,
      reviewStatus: 1,
      freshnessClass: 1,
      reviewDueAt: 1,
      reviewedAt: 1,
      revision: 1,
    });
  });

  it.each(["service", "hlv", "platform"])(
    "pre-filters Atlas and excludes an inconsistent %s source-backed hit",
    async (category) => {
      process.env.KB_VECTOR_INDEX = "synthetic_index";
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(successfulResponse()));
      vi.spyOn(KnowledgeEntry, "exists")
        .mockResolvedValueOnce({ _id: "synthetic" })
        .mockResolvedValueOnce(null);
      const aggregateSpy = vi.spyOn(KnowledgeEntry, "aggregate").mockResolvedValue([
        {
          _id: "68c3cd2c192a765135686091",
          question: "Synthetic inconsistent internal entry",
          answer: "Must not be retrieved.",
          category,
          status: "published",
          embeddingStatus: "ready",
          embeddingVersion: EMBEDDING_VERSION,
          evidenceLevel: "source_backed",
          reviewStatus: "reviewed",
          similarity: 0.99,
        },
        {
          _id: "68c3cd2c192a765135686092",
          question: "Synthetic canonical internal entry",
          answer: "Increase load gradually.",
          category,
          status: "published",
          embeddingStatus: "ready",
          embeddingVersion: EMBEDDING_VERSION,
          evidenceLevel: "canonical_internal",
          reviewStatus: "reviewed",
          similarity: 0.9,
        },
        {
          _id: "68c3cd2c192a765135686095",
          question: "Synthetic invalid external canonical entry",
          answer: "Must not be retrieved.",
          category: "athlete",
          status: "published",
          embeddingStatus: "ready",
          embeddingVersion: EMBEDDING_VERSION,
          evidenceLevel: "canonical_internal",
          reviewStatus: "reviewed",
          similarity: 0.98,
        },
      ]);

      const results = await searchKnowledgeBase("Synthetic HTCOACHING service");
      const filter = aggregateSpy.mock.calls[0][0][0].$vectorSearch.filter;

      expect({
        filter: filter.$nor,
        ids: results.map((result) => result._id),
      }).toEqual({
        filter: [
          {
            category: { $in: ["service", "hlv", "platform"] },
            evidenceLevel: { $ne: "canonical_internal" },
          },
          {
            category: { $nin: ["service", "hlv", "platform"] },
            evidenceLevel: "canonical_internal",
          },
        ],
        ids: ["68c3cd2c192a765135686092"],
      });
    },
  );

  it.each(["service", "hlv", "platform"])(
    "pre-filters fallback and excludes an inconsistent %s source-backed entry",
    async (category) => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(successfulResponse()));
      vi.spyOn(KnowledgeEntry, "exists")
        .mockResolvedValueOnce({ _id: "synthetic" })
        .mockResolvedValueOnce(null);
      const findSpy = vi.spyOn(KnowledgeEntry, "find").mockReturnValue({
        select: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue([
          {
            _id: "68c3cd2c192a765135686093",
            question: "Synthetic inconsistent internal entry",
            answer: "Must not be retrieved.",
            category,
            embedding: VECTOR,
            status: "published",
            embeddingStatus: "ready",
            embeddingVersion: EMBEDDING_VERSION,
            evidenceLevel: "source_backed",
            reviewStatus: "reviewed",
          },
          {
            _id: "68c3cd2c192a765135686094",
            question: "Synthetic canonical internal entry",
            answer: "Increase load gradually.",
            category,
            embedding: VECTOR,
            status: "published",
            embeddingStatus: "ready",
            embeddingVersion: EMBEDDING_VERSION,
            evidenceLevel: "canonical_internal",
            reviewStatus: "reviewed",
          },
          {
            _id: "68c3cd2c192a765135686096",
            question: "Synthetic invalid external canonical entry",
            answer: "Must not be retrieved.",
            category: "athlete",
            embedding: VECTOR,
            status: "published",
            embeddingStatus: "ready",
            embeddingVersion: EMBEDDING_VERSION,
            evidenceLevel: "canonical_internal",
            reviewStatus: "reviewed",
          },
        ]),
      });

      const results = await searchKnowledgeBase("Synthetic HTCOACHING service");

      expect({
        filter: findSpy.mock.calls[0][0].$nor,
        ids: results.map((result) => result._id),
      }).toEqual({
        filter: [
          {
            category: { $in: ["service", "hlv", "platform"] },
            evidenceLevel: { $ne: "canonical_internal" },
          },
          {
            category: { $nin: ["service", "hlv", "platform"] },
            evidenceLevel: "canonical_internal",
          },
        ],
        ids: ["68c3cd2c192a765135686094"],
      });
    },
  );
});
