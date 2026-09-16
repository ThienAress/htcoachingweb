import { describe, expect, it, vi } from "vitest";

import {
  applyConversationFeedbackReview,
  buildKnowledgeSuggestionDraft,
  buildKnowledgeEntryPayload,
  createKnowledgeSearchRuntime,
  filterConversationPairs,
  clampKnowledgePage,
  createLatestRequestRuntime,
  getKnowledgeSearchParams,
  getKnowledgeQueryViewState,
  getSuggestionSourcePair,
} from "../knowledgeBaseAdmin";

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

describe("Knowledge Base admin presentation", () => {
  it("builds the evidence payload without server-owned review fields", () => {
    const payload = buildKnowledgeEntryPayload({
      question: "  Creatine có tác dụng gì?  ",
      answer: "  Hỗ trợ hiệu suất vận động cường độ cao.  ",
      category: "supplement",
      tags: "creatine, hiệu suất",
      variants: [" Creatine để làm gì? ", ""],
      status: "published",
      evidenceLevel: "source_backed",
      freshnessClass: "periodic",
      reviewDueAt: "2027-03-01",
      reviewStatus: "reviewed",
      sources: [
        {
          type: "research",
          title: "  Position stand  ",
          publisher: "  ISSN  ",
          url: "  https://example.test/creatine  ",
          evidenceTier: "primary",
        },
        {
          type: "official",
          title: "",
          publisher: "",
          url: "",
          evidenceTier: "canonical",
        },
      ],
    });

    expect(payload).toEqual({
      question: "Creatine có tác dụng gì?",
      answer: "Hỗ trợ hiệu suất vận động cường độ cao.",
      category: "supplement",
      tags: ["creatine", "hiệu suất"],
      variants: ["Creatine để làm gì?"],
      status: "published",
      evidenceLevel: "source_backed",
      freshnessClass: "periodic",
      reviewDueAt: "2027-03-01",
      sources: [
        {
          type: "research",
          title: "Position stand",
          publisher: "ISSN",
          url: "https://example.test/creatine",
          evidenceTier: "primary",
        },
      ],
    });
  });

  it("normalizes source dates to date-only payload values and omits invalid dates", () => {
    const payload = buildKnowledgeEntryPayload({
      question: "Creatine có tác dụng gì?",
      answer: "Hỗ trợ hiệu suất vận động cường độ cao.",
      sources: [
        {
          type: "research",
          title: "Position stand",
          publisher: "ISSN",
          url: "https://example.test/creatine",
          evidenceTier: "primary",
          publishedAt: "2025-08-10T18:30:00.000Z",
          retrievedAt: "không-hợp-lệ",
        },
        {
          type: "official",
          title: "Trang hướng dẫn",
          publisher: "WHO",
          url: "https://example.test/guide",
          evidenceTier: "canonical",
          retrievedAt: "2026-09-12",
        },
      ],
    });

    expect(payload.sources).toEqual([
      {
        type: "research",
        title: "Position stand",
        publisher: "ISSN",
        url: "https://example.test/creatine",
        evidenceTier: "primary",
        publishedAt: "2025-08-10",
      },
      {
        type: "official",
        title: "Trang hướng dẫn",
        publisher: "WHO",
        url: "https://example.test/guide",
        evidenceTier: "canonical",
        retrievedAt: "2026-09-12",
      },
    ]);
  });

  it("uses production retrieval settings unless exploration is explicit", () => {
    expect([
      getKnowledgeSearchParams("squat đúng kỹ thuật"),
      getKnowledgeSearchParams("squat đúng kỹ thuật", "exploratory"),
    ]).toEqual([
      { q: "squat đúng kỹ thuật", limit: 3, threshold: 0.75 },
      { q: "squat đúng kỹ thuật", limit: 5, threshold: 0.6 },
    ]);
  });

  it("publishes only the latest response when searches resolve out of order", async () => {
    const firstResponse = deferred();
    const secondResponse = deferred();
    const search = vi
      .fn()
      .mockReturnValueOnce(firstResponse.promise)
      .mockReturnValueOnce(secondResponse.promise);
    const onSuccess = vi.fn();
    const runtime = createKnowledgeSearchRuntime({ search, onSuccess });

    const firstRun = runtime.run({ query: "squat", mode: "production" });
    const firstSignal = search.mock.calls[0][1];
    const secondRun = runtime.run({ query: "deadlift", mode: "exploratory" });

    secondResponse.resolve({ data: { data: [{ _id: "new-result" }] } });
    await secondRun;
    firstResponse.resolve({ data: { data: [{ _id: "stale-result" }] } });
    await firstRun;

    expect({
      firstWasAborted: firstSignal.aborted,
      published: onSuccess.mock.calls.map(([result]) => result),
    }).toEqual({
      firstWasAborted: true,
      published: [
        {
          query: "deadlift",
          mode: "exploratory",
          results: [{ _id: "new-result" }],
        },
      ],
    });
  });

  it("invalidates an in-flight response after the query or mode changes", async () => {
    const response = deferred();
    const search = vi.fn().mockReturnValue(response.promise);
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const runtime = createKnowledgeSearchRuntime({ search, onSuccess, onError });

    const run = runtime.run({ query: "ronaldo", mode: "production" });
    const signal = search.mock.calls[0][1];
    runtime.invalidate();
    response.resolve({ data: { data: [{ _id: "stale-result" }] } });
    await run;

    expect({
      aborted: signal.aborted,
      successCalls: onSuccess.mock.calls.length,
      errorCalls: onError.mock.calls.length,
    }).toEqual({ aborted: true, successCalls: 0, errorCalls: 0 });
  });

  it("aborts stale admin detail requests and accepts only the latest response", () => {
    const runtime = createLatestRequestRuntime();
    const first = runtime.begin();
    const second = runtime.begin();

    expect({
      firstAborted: first.signal.aborted,
      firstCurrent: runtime.isCurrent(first),
      secondCurrent: runtime.isCurrent(second),
    }).toEqual({
      firstAborted: true,
      firstCurrent: false,
      secondCurrent: true,
    });

    runtime.invalidate();
    expect({
      secondAborted: second.signal.aborted,
      secondCurrent: runtime.isCurrent(second),
    }).toEqual({ secondAborted: true, secondCurrent: false });
  });

  it("keeps nested conversation provenance from an AI suggestion", () => {
    expect(
      getSuggestionSourcePair({
        source: {
          conversationId: "conversation-1",
          questionIndex: 2,
          answerIndex: 3,
          questionMessageId: "question-1",
          answerMessageId: "answer-1",
          questionHash: "a".repeat(64),
          answerHash: "b".repeat(64),
        },
      }),
    ).toEqual({
      conversationId: "conversation-1",
      questionIndex: 2,
      answerIndex: 3,
      questionMessageId: "question-1",
      answerMessageId: "answer-1",
      questionHash: "a".repeat(64),
      answerHash: "b".repeat(64),
    });
  });

  it("rejects a source pair that is only bound by mutable array indices", () => {
    expect(
      getSuggestionSourcePair({
        conversationId: "conversation-1",
        questionIndex: 2,
        answerIndex: 3,
      }),
    ).toBeNull();
  });

  it("refuses to open an AI suggestion draft without immutable provenance", () => {
    expect(
      buildKnowledgeSuggestionDraft({
        question: "Cách squat đúng?",
        answer: "Giữ cột sống trung lập.",
        category: "training",
        source: {
          conversationId: "conversation-1",
          questionIndex: 2,
          answerIndex: 3,
        },
      }),
    ).toBeNull();
  });

  it("builds an AI suggestion draft only when its immutable provenance is complete", () => {
    expect(
      buildKnowledgeSuggestionDraft({
        question: "Cách squat đúng?",
        answer: "Giữ cột sống trung lập.",
        category: "training",
        source: {
          conversationId: "conversation-1",
          questionIndex: 2,
          answerIndex: 3,
          questionMessageId: "question-1",
          answerMessageId: "answer-1",
          questionHash: "a".repeat(64),
          answerHash: "b".repeat(64),
        },
      }),
    ).toMatchObject({
      form: {
        question: "Cách squat đúng?",
        answer: "Giữ cột sống trung lập.",
        category: "training",
        status: "draft",
      },
      sourcePair: {
        conversationId: "conversation-1",
        questionMessageId: "question-1",
        answerMessageId: "answer-1",
      },
    });
  });

  it("filters downvoted pairs by their canonical review status", () => {
    const pairs = [
      { answerMessageId: "a", answerFeedback: "down", feedbackReview: { status: "pending" } },
      { answerMessageId: "b", answerFeedback: "down", feedbackReview: { status: "resolved" } },
      { answerMessageId: "c", answerFeedback: "up", feedbackReview: null },
    ];

    expect(
      filterConversationPairs(pairs, {
        feedback: "down",
        feedbackReviewStatus: "pending",
      }).map((pair) => pair.answerMessageId),
    ).toEqual(["a"]);
  });

  it("treats a legacy downvote without review metadata as pending", () => {
    expect(
      filterConversationPairs(
        [{ answerMessageId: "legacy", answerFeedback: "down", feedbackReview: { status: "none" } }],
        { feedbackReviewStatus: "pending" },
      ).map((pair) => pair.answerMessageId),
    ).toEqual(["legacy"]);
  });

  it("applies feedback review only to the conversation that initiated it", () => {
    const detail = {
      _id: "conversation-b",
      qaPairs: [{ answerMessageId: "answer-b", feedbackReview: null }],
    };

    expect(
      applyConversationFeedbackReview(detail, {
        conversationId: "conversation-a",
        messageId: "answer-a",
        feedbackReview: { status: "resolved" },
      }),
    ).toBe(detail);
    expect(
      applyConversationFeedbackReview(detail, {
        conversationId: "conversation-b",
        messageId: "answer-b",
        feedbackReview: { status: "resolved" },
      }),
    ).toEqual({
      _id: "conversation-b",
      qaPairs: [
        {
          answerMessageId: "answer-b",
          feedbackReview: { status: "resolved" },
        },
      ],
    });
  });

  it.each([
    [{ isLoading: true, isError: false, hasData: false }, "loading"],
    [{ isLoading: false, isError: true, hasData: false }, "error"],
    [{ isLoading: false, isError: false, hasData: false }, "empty"],
    [{ isLoading: false, isError: false, hasData: true }, "ready"],
    [{ isLoading: false, isError: true, hasData: true }, "ready"],
  ])("keeps loading, error, empty, and ready query states distinct", (input, expected) => {
    expect(getKnowledgeQueryViewState(input)).toBe(expected);
  });

  it("clamps a pending review page after a mutation shrinks the result set", () => {
    expect([
      clampKnowledgePage(3, 2),
      clampKnowledgePage(0, 2),
      clampKnowledgePage(2, 4),
    ]).toEqual([2, 1, 2]);
  });
});
