export const KNOWLEDGE_SEARCH_MODES = {
  production: { limit: 3, threshold: 0.75 },
  exploratory: { limit: 5, threshold: 0.6 },
};

export const createEmptyKnowledgeSource = () => ({
  type: "official",
  title: "",
  publisher: "",
  url: "",
  publishedAt: "",
  retrievedAt: "",
  evidenceTier: "primary",
});

const cleanList = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const cleanSources = (sources) =>
  (Array.isArray(sources) ? sources : [])
    .map((source) => {
      const cleaned = {
        type: source?.type || "official",
        title: String(source?.title || "").trim(),
        publisher: String(source?.publisher || "").trim(),
        url: String(source?.url || "").trim(),
        evidenceTier: source?.evidenceTier || "legacy_unknown",
      };
      const publishedAt = toDateInputValue(
        String(source?.publishedAt || "").trim(),
      );
      const retrievedAt = toDateInputValue(
        String(source?.retrievedAt || "").trim(),
      );
      if (publishedAt) cleaned.publishedAt = publishedAt;
      if (retrievedAt) cleaned.retrievedAt = retrievedAt;
      return cleaned;
    })
    .filter((source) => source.title || source.publisher || source.url);

export function buildKnowledgeEntryPayload(form) {
  return {
    question: String(form?.question || "").trim(),
    answer: String(form?.answer || "").trim(),
    category: form?.category || "general",
    tags: cleanList(form?.tags),
    variants: (Array.isArray(form?.variants) ? form.variants : [])
      .map((variant) => String(variant || "").trim())
      .filter(Boolean),
    status: form?.status || "draft",
    evidenceLevel: form?.evidenceLevel || "legacy_unverified",
    freshnessClass: form?.freshnessClass || "stable",
    reviewDueAt: form?.reviewDueAt || null,
    sources: cleanSources(form?.sources),
  };
}

const normalizeKnowledgeSearchMode = (mode) =>
  mode === "exploratory" ? "exploratory" : "production";

export function getKnowledgeSearchParams(query, mode = "production") {
  const settings = KNOWLEDGE_SEARCH_MODES[normalizeKnowledgeSearchMode(mode)];
  return { q: String(query || "").trim(), ...settings };
}

export function createKnowledgeSearchRuntime({
  search,
  onStart,
  onSuccess,
  onError,
  onSettled,
} = {}) {
  if (typeof search !== "function") {
    throw new TypeError("Knowledge search runtime requires a search function");
  }

  let nextRequestId = 0;
  let activeRequest = null;

  const invalidate = ({ notify = true } = {}) => {
    if (!activeRequest) return;

    const request = activeRequest;
    activeRequest = null;
    request.controller.abort();
    if (notify) {
      onSettled?.({ query: request.query, mode: request.mode, status: "cancelled" });
    }
  };

  const run = async ({ query, mode = "production" } = {}) => {
    const normalizedMode = normalizeKnowledgeSearchMode(mode);
    const params = getKnowledgeSearchParams(query, normalizedMode);
    if (!params.q) return { status: "ignored" };

    invalidate();
    const request = {
      id: ++nextRequestId,
      query: params.q,
      mode: normalizedMode,
      controller: new AbortController(),
    };
    activeRequest = request;
    onStart?.({ query: request.query, mode: request.mode });

    let status = "stale";
    try {
      const response = await search(params, request.controller.signal);
      if (activeRequest?.id !== request.id || request.controller.signal.aborted) {
        return { status };
      }

      const result = {
        query: request.query,
        mode: request.mode,
        results: Array.isArray(response?.data?.data) ? response.data.data : [],
      };
      status = "success";
      onSuccess?.(result);
      return { status, ...result };
    } catch (error) {
      if (activeRequest?.id !== request.id || request.controller.signal.aborted) {
        return { status };
      }

      status = "error";
      onError?.(error, { query: request.query, mode: request.mode });
      return { status, error };
    } finally {
      if (activeRequest?.id === request.id) {
        activeRequest = null;
        onSettled?.({ query: request.query, mode: request.mode, status });
      }
    }
  };

  return {
    run,
    invalidate,
    cancel() {
      invalidate({ notify: false });
    },
  };
}

export function createLatestRequestRuntime() {
  let sequence = 0;
  let controller = null;

  const invalidate = () => {
    sequence += 1;
    controller?.abort();
    controller = null;
  };

  return {
    begin() {
      invalidate();
      controller = new AbortController();
      return { sequence, signal: controller.signal };
    },
    isCurrent(request) {
      return Boolean(
        request &&
        request.sequence === sequence &&
        !request.signal.aborted,
      );
    },
    settle(request) {
      if (request?.sequence === sequence) controller = null;
    },
    invalidate,
  };
}

export function getKnowledgeQueryViewState({
  isLoading = false,
  isError = false,
  hasData = false,
} = {}) {
  if (isLoading && !hasData) return "loading";
  if (isError && !hasData) return "error";
  return hasData ? "ready" : "empty";
}

export function clampKnowledgePage(currentPage, totalPages) {
  const current = Number.isSafeInteger(currentPage) ? currentPage : 1;
  const total = Number.isSafeInteger(totalPages) ? totalPages : 1;
  return Math.min(Math.max(current, 1), Math.max(total, 1));
}

export function getSuggestionSourcePair(suggestion) {
  const source = suggestion?.source || suggestion;
  if (
    !source?.conversationId ||
    !Number.isInteger(source.questionIndex) ||
    !Number.isInteger(source.answerIndex) ||
    !source.questionMessageId ||
    !source.answerMessageId ||
    !/^[a-f0-9]{64}$/.test(String(source.questionHash || "")) ||
    !/^[a-f0-9]{64}$/.test(String(source.answerHash || ""))
  ) {
    return null;
  }
  return {
    conversationId: source.conversationId,
    questionIndex: source.questionIndex,
    answerIndex: source.answerIndex,
    questionMessageId: source.questionMessageId,
    answerMessageId: source.answerMessageId,
    questionHash: source.questionHash,
    answerHash: source.answerHash,
  };
}

export function buildKnowledgeSuggestionDraft(suggestion) {
  const sourcePair = getSuggestionSourcePair(suggestion);
  if (!sourcePair) return null;

  return {
    form: {
      question: String(suggestion?.question || ""),
      answer: String(suggestion?.answer || ""),
      category: suggestion?.category || "general",
      tags: "",
      variants: [""],
      status: "draft",
      evidenceLevel: "legacy_unverified",
      freshnessClass: "stable",
      reviewDueAt: "",
      sources: [],
    },
    sourcePair,
  };
}

export function getPairFeedback(pair) {
  return pair?.answerFeedback ?? pair?.feedback ?? null;
}

export function getPairReviewStatus(pair) {
  const status = pair?.feedbackReview?.status;
  if (status && status !== "none") return status;
  return getPairFeedback(pair) === "down" ? "pending" : null;
}

export function filterConversationPairs(pairs, filters = {}) {
  return (Array.isArray(pairs) ? pairs : []).filter((pair) => {
    if (filters.feedback && getPairFeedback(pair) !== filters.feedback) {
      return false;
    }
    if (
      filters.feedbackReviewStatus &&
      getPairReviewStatus(pair) !== filters.feedbackReviewStatus
    ) {
      return false;
    }
    return true;
  });
}

export function applyConversationFeedbackReview(
  detail,
  { conversationId, messageId, feedbackReview } = {},
) {
  if (String(detail?._id || "") !== String(conversationId || "")) {
    return detail;
  }
  return {
    ...detail,
    qaPairs: (detail.qaPairs || []).map((item) =>
      item.answerMessageId === messageId
        ? { ...item, feedbackReview }
        : item,
    ),
  };
}

export function toDateInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}
