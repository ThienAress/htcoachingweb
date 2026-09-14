// Embedding + bounded vector search for the verified Knowledge Base.
import {
  incrementMetric,
  observeMetric,
} from "../../observability/metrics.js";
import { safeLog } from "../../utils/safeLogger.js";
import {
  recordGeminiRequest,
  recordGeminiResult,
} from "../../observability/providerUsageMetrics.js";
import { withKnowledgeEvidenceDefaults } from "../../utils/knowledgeBase.js";
import {
  buildKnowledgeRetrievalFilter,
  rankKnowledgeCandidates,
} from "./retrievalRuntime.js";
import {
  EMBEDDING_DIMENSION,
  EMBEDDING_MODEL,
  EMBEDDING_PROFILE_ID,
  EMBEDDING_VERSION,
  getEmbeddingProfile,
} from "./embeddingProfile.js";
export {
  EMBEDDING_DIMENSION,
  EMBEDDING_MODEL,
  EMBEDDING_PROFILE_ID,
  EMBEDDING_VERSION,
  LEGACY_EMBEDDING_PROFILE_ID,
  LEGACY_EMBEDDING_VERSION,
  QUESTION_ANSWERING_EMBEDDING_PROFILE_ID,
} from "./embeddingProfile.js";

const EMBEDDING_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const EMBEDDING_TIMEOUT_MS = Number(process.env.EMBEDDING_TIMEOUT_MS) || 15000;
const MAX_FALLBACK_ENTRIES = Number(process.env.KB_MAX_SCAN_ENTRIES) || 500;
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 100;
const embeddingCache = new Map();
const embeddingInFlight = new Map();

function normalizeEmbeddingText(text) {
  return String(text || "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function prepareEmbeddingInput(
  text,
  { inputType = "document", profileId = EMBEDDING_PROFILE_ID } = {},
) {
  const profile = getEmbeddingProfile(profileId);
  if (!profile) throw new Error(`Embedding profile không được hỗ trợ: ${profileId}`);
  if (!new Set(["query", "document"]).has(inputType)) {
    throw new Error(`Embedding input type không được hỗ trợ: ${inputType}`);
  }
  const cleanText = normalizeEmbeddingText(text);
  if (!cleanText) throw new Error("Text rỗng, không thể tạo embedding");
  if (cleanText.length > 1000) {
    throw new Error("Text embedding vượt quá 1000 ký tự");
  }

  let preparedText = cleanText;
  if (profile.format === "question_answering") {
    preparedText =
      inputType === "query"
        ? `task: question answering | query: ${cleanText}`
        : `title: none | text: ${cleanText}`;
  }
  return {
    inputType,
    profileId,
    text: preparedText,
    version: profile.version,
  };
}

function createLinkedSignal(externalSignal, timeoutMs) {
  const controller = new AbortController();
  const abortFromExternal = () => controller.abort(externalSignal?.reason);
  const timeout = setTimeout(
    () => controller.abort(new Error("Embedding request timed out")),
    timeoutMs,
  );

  if (externalSignal?.aborted) abortFromExternal();
  else externalSignal?.addEventListener("abort", abortFromExternal, { once: true });

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeout);
      externalSignal?.removeEventListener("abort", abortFromExternal);
    },
  };
}

function getCachedEmbedding(key) {
  const cached = embeddingCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    embeddingCache.delete(key);
    return null;
  }
  return cached.vector;
}

function setCachedEmbedding(key, vector) {
  if (embeddingCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = embeddingCache.keys().next().value;
    embeddingCache.delete(oldestKey);
  }
  embeddingCache.set(key, {
    vector,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

function createAbortError(reason) {
  const error = new Error(reason?.message || "Embedding request aborted");
  error.name = "AbortError";
  return error;
}

function waitForEmbedding(promise, { signal, timeoutMs } = {}) {
  if (signal?.aborted) return Promise.reject(createAbortError(signal.reason));
  if (!signal && !timeoutMs) return promise;

  return new Promise((resolve, reject) => {
    let settled = false;
    let timeout = null;
    const cleanup = () => {
      if (timeout) clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    };
    const settle = (handler) => (value) => {
      if (settled) return;
      settled = true;
      cleanup();
      handler(value);
    };
    const abort = () => {
      settle(reject)(createAbortError(signal.reason));
    };

    signal?.addEventListener("abort", abort, { once: true });
    if (timeoutMs) {
      timeout = setTimeout(
        () => settle(reject)(new Error("Embedding request timed out")),
        timeoutMs,
      );
    }
    promise.then(settle(resolve), settle(reject));
  });
}

async function requestEmbedding(preparedText, cacheKey) {
  // The provider deadline is independent from any one caller. This lets callers
  // stop waiting without cancelling an identical request shared by others.
  const providerTimeoutMs = Math.min(
    Math.max(EMBEDDING_TIMEOUT_MS, 3000),
    60000,
  );
  const linked = createLinkedSignal(undefined, providerTimeoutMs);
  const apiKey = process.env.GEMINI_API_KEY;
  const url = `${EMBEDDING_BASE_URL}/models/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`;
  let usage = {};

  try {
    recordGeminiRequest("embedding");
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: `models/${EMBEDDING_MODEL}`,
        content: { parts: [{ text: preparedText }] },
        outputDimensionality: EMBEDDING_DIMENSION,
      }),
      signal: linked.signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      usage = errorData?.usageMetadata || {};
      safeLog.warn("kb.embedding_provider_error", "Provider returned error", {
        status: response.status,
      });
      throw new Error(`Embedding provider trả HTTP ${response.status}`);
    }

    const data = await response.json();
    usage = data?.usageMetadata || {};
    const values = data?.embedding?.values;
    if (
      !Array.isArray(values) ||
      values.length !== EMBEDDING_DIMENSION ||
      values.some((value) => !Number.isFinite(value))
    ) {
      throw new Error("Embedding provider trả vector không hợp lệ");
    }

    setCachedEmbedding(cacheKey, values);
    recordGeminiResult("embedding", { success: true, usage });
    return values;
  } catch (error) {
    recordGeminiResult("embedding", { success: false, usage });
    incrementMetric("kb.embedding_failures");
    if (linked.signal.aborted) {
      throw new Error("Embedding provider phản hồi quá thời gian");
    }
    throw error;
  } finally {
    linked.cleanup();
  }
}

export async function generateEmbedding(text, options = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Embedding provider chưa được cấu hình");

  const prepared = prepareEmbeddingInput(text, {
    inputType: options.inputType || "document",
    profileId: options.profileId || EMBEDDING_PROFILE_ID,
  });
  const cacheKey = JSON.stringify([prepared.version, prepared.text]);

  const cached = getCachedEmbedding(cacheKey);
  if (cached) return cached;

  const callerTimeoutMs = options.timeoutMs
    ? Math.min(Math.max(Number(options.timeoutMs) || 3000, 3000), 60000)
    : null;
  let pending = embeddingInFlight.get(cacheKey);
  if (!pending) {
    pending = requestEmbedding(prepared.text, cacheKey);
    embeddingInFlight.set(cacheKey, pending);
    pending.then(
      () => {
        if (embeddingInFlight.get(cacheKey) === pending) {
          embeddingInFlight.delete(cacheKey);
        }
      },
      () => {
        if (embeddingInFlight.get(cacheKey) === pending) {
          embeddingInFlight.delete(cacheKey);
        }
      },
    );
  }

  return waitForEmbedding(pending, {
    signal: options.signal,
    timeoutMs: callerTimeoutMs,
  });
}

export function cosineSimilarity(vecA, vecB) {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length !== vecB.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < vecA.length; index += 1) {
    dotProduct += vecA[index] * vecB[index];
    normA += vecA[index] * vecA[index];
    normB += vecB[index] * vecB[index];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

const normalizeVectorSearchScore = (cosine) =>
  Math.min(Math.max((Number(cosine) + 1) / 2, 0), 1);

const readAtlasIndexName = (variantsOnly) => {
  const indexName = variantsOnly
    ? process.env.KB_VARIANT_VECTOR_INDEX
    : process.env.KB_VECTOR_INDEX;
  const normalized = String(indexName || "").trim();
  return /^[a-z0-9_-]+$/i.test(normalized) ? normalized : null;
};

const buildCurrentReviewFilter = (now) => ({
  $or: [
    { reviewDueAt: { $exists: false } },
    { reviewDueAt: null },
    { reviewDueAt: { $gt: now } },
  ],
});

async function atlasVectorSearch(KnowledgeEntry, queryVector, options) {
  const indexName = readAtlasIndexName(options.variantsOnly);
  if (!indexName) return null;

  const filter = {
    ...buildKnowledgeRetrievalFilter({
      embeddingVersion: options.embeddingVersion,
      category: options.category,
    }),
    ...buildCurrentReviewFilter(options.now),
  };

  const vectorPath = options.variantsOnly ? "variants.embedding" : "embedding";
  const vectorSearch = {
    index: indexName,
    path: vectorPath,
    queryVector,
    numCandidates: Math.min(Math.max(options.limit * 20, 50), 200),
    limit: Math.min(Math.max(options.limit * 4, options.limit), 40),
    ...(options.variantsOnly
      ? { parentFilter: filter, nestedOptions: { scoreMode: "max" } }
      : { filter }),
  };
  const entries = await KnowledgeEntry.aggregate([
    {
      $vectorSearch: vectorSearch,
    },
    {
      $project: {
        question: 1,
        answer: 1,
        category: 1,
        tags: 1,
        status: 1,
        embeddingStatus: 1,
        variantCount: 1,
        embeddingVersion: 1,
        sources: 1,
        evidenceLevel: 1,
        reviewStatus: 1,
        freshnessClass: 1,
        reviewDueAt: 1,
        reviewedAt: 1,
        revision: 1,
        ...(options.variantsOnly && { variants: 1 }),
        similarity: { $meta: "vectorSearchScore" },
      },
    },
    {
      $match: {
        ...buildCurrentReviewFilter(options.now),
      },
    },
  ]);

  return entries.map((entry) => {
    if (!options.variantsOnly) return { ...entry, matchSource: "primary" };
    let matchedQuestion = entry.question;
    let bestVariantScore = -1;
    for (const variant of entry.variants || []) {
      if (variant.embedding?.length !== EMBEDDING_DIMENSION) continue;
      const score = cosineSimilarity(queryVector, variant.embedding);
      if (score > bestVariantScore) {
        bestVariantScore = score;
        matchedQuestion = variant.text;
      }
    }
    const boundedEntry = { ...entry };
    delete boundedEntry.variants;
    return { ...boundedEntry, matchedQuestion, matchSource: "variant" };
  });
}

async function boundedFallbackSearch(KnowledgeEntry, queryVector, options) {
  const filter = {
    ...buildKnowledgeRetrievalFilter({
      embeddingVersion: options.embeddingVersion,
      category: options.category,
      requireVariants: options.variantsOnly,
    }),
    ...buildCurrentReviewFilter(options.now),
  };

  const entries = await KnowledgeEntry.find(filter)
    .select(
      "+embedding +variants question answer category tags status embeddingStatus variantCount embeddingVersion sources evidenceLevel reviewStatus freshnessClass reviewDueAt reviewedAt revision _id",
    )
    .sort({ usageCount: -1, updatedAt: -1 })
    .limit(Math.min(Math.max(MAX_FALLBACK_ENTRIES, 50), 2000))
    .lean();

  const candidates = entries
    .filter((entry) =>
      options.variantsOnly
        ? entry.variants?.some(
            (variant) => variant.embedding?.length === EMBEDDING_DIMENSION,
          )
        : entry.embedding?.length === EMBEDDING_DIMENSION,
    )
    .map((entry) => {
      let rawCosineSimilarity = options.variantsOnly
        ? -1
        : cosineSimilarity(queryVector, entry.embedding);
      let matchedQuestion = entry.question;
      let matchSource = options.variantsOnly ? "variant" : "primary";
      if (!options.primaryOnly) {
        for (const variant of entry.variants || []) {
          if (variant.embedding?.length !== EMBEDDING_DIMENSION) continue;
          const variantSimilarity = cosineSimilarity(queryVector, variant.embedding);
          if (variantSimilarity > rawCosineSimilarity) {
            rawCosineSimilarity = variantSimilarity;
            matchedQuestion = variant.text;
            matchSource = "variant";
          }
        }
      }

      const similarity = normalizeVectorSearchScore(rawCosineSimilarity);

      return withKnowledgeEvidenceDefaults({
        _id: entry._id,
        question: entry.question,
        matchedQuestion,
        answer: entry.answer,
        category: entry.category,
        tags: entry.tags,
        status: entry.status,
        embeddingStatus: entry.embeddingStatus,
        embeddingVersion: entry.embeddingVersion,
        similarity,
        matchSource,
        variantCount: entry.variantCount || 0,
        sources: entry.sources,
        evidenceLevel: entry.evidenceLevel,
        reviewStatus: entry.reviewStatus,
        freshnessClass: entry.freshnessClass,
        reviewDueAt: entry.reviewDueAt,
        reviewedAt: entry.reviewedAt,
        revision: entry.revision,
      });
    });
  return rankKnowledgeCandidates(candidates, options);
}

async function searchKnowledgeBaseInternal(query, options = {}) {
  const cleanQuery = String(query || "").trim();
  if (!cleanQuery || cleanQuery.length > 500) return [];

  const rawThreshold = Number(options.threshold);
  const boundedOptions = {
    limit: Math.min(Math.max(Number(options.limit) || 3, 1), 10),
    threshold: Number.isFinite(rawThreshold)
      ? Math.min(Math.max(rawThreshold, 0), 1)
      : 0.75,
    category: options.category,
    embeddingVersion: EMBEDDING_VERSION,
    now: new Date(),
  };
  const { default: KnowledgeEntry } = await import("../../models/KnowledgeEntry.js");
  const hasEntries = await KnowledgeEntry.exists(
    {
      ...buildKnowledgeRetrievalFilter({
        embeddingVersion: boundedOptions.embeddingVersion,
        category: boundedOptions.category,
      }),
      ...buildCurrentReviewFilter(boundedOptions.now),
    },
  );
  if (!hasEntries) return [];

  let queryVector;
  try {
    queryVector = await generateEmbedding(cleanQuery, {
      inputType: "query",
      signal: options.signal,
    });
  } catch (error) {
    safeLog.error("kb.query_embedding_failed", error);
    return [];
  }

  const hasRootAtlasIndex = Boolean(readAtlasIndexName(false));
  const hasVariantAtlasIndex = Boolean(readAtlasIndexName(true));
  if (!hasRootAtlasIndex && !hasVariantAtlasIndex) {
    incrementMetric("kb.vector_fallbacks");
    return boundedFallbackSearch(KnowledgeEntry, queryVector, boundedOptions);
  }

  let atlasResults;
  if (hasRootAtlasIndex) {
    try {
      atlasResults = await atlasVectorSearch(
        KnowledgeEntry,
        queryVector,
        { ...boundedOptions, variantsOnly: false },
      );
    } catch (error) {
      safeLog.error("kb.vector_search_fallback", error);
    }
  }

  let normalizedAtlas;
  if (!Array.isArray(atlasResults) || atlasResults.length === 0) {
    incrementMetric("kb.vector_fallbacks");
    normalizedAtlas = await boundedFallbackSearch(
      KnowledgeEntry,
      queryVector,
      { ...boundedOptions, primaryOnly: true },
    );
  } else {
    normalizedAtlas = atlasResults.map((entry) =>
      withKnowledgeEvidenceDefaults({
        ...entry,
        matchedQuestion: entry.question,
        matchSource: "primary",
      }),
    );
  }

  const hasVariantEntries = await KnowledgeEntry.exists({
    ...buildKnowledgeRetrievalFilter({
      embeddingVersion: boundedOptions.embeddingVersion,
      category: boundedOptions.category,
      requireVariants: true,
    }),
    ...buildCurrentReviewFilter(boundedOptions.now),
  });
  if (!hasVariantEntries) {
    return rankKnowledgeCandidates(normalizedAtlas, boundedOptions);
  }

  let variantResults;
  if (hasVariantAtlasIndex) {
    try {
      variantResults = await atlasVectorSearch(
        KnowledgeEntry,
        queryVector,
        { ...boundedOptions, variantsOnly: true },
      );
    } catch {
      // A nested-index incompatibility must not discard valid root Atlas hits.
      // The bounded fallback metric below remains the operational signal.
      variantResults = null;
    }
  }
  if (!Array.isArray(variantResults) || variantResults.length === 0) {
    incrementMetric("kb.vector_fallbacks");
    variantResults = await boundedFallbackSearch(KnowledgeEntry, queryVector, {
      ...boundedOptions,
      variantsOnly: true,
    });
  }

  return rankKnowledgeCandidates(
    [
      ...normalizedAtlas,
      ...variantResults.map((entry) => withKnowledgeEvidenceDefaults(entry)),
    ],
    boundedOptions,
  );
}

export async function searchKnowledgeBase(query, options = {}) {
  const startedAt = performance.now();
  try {
    const results = await searchKnowledgeBaseInternal(query, options);
    if (results.length === 0) incrementMetric("kb.search_no_hits");
    return results;
  } finally {
    observeMetric(
      "kb.search_latency_ms",
      Number((performance.now() - startedAt).toFixed(2)),
    );
  }
}

export function clearEmbeddingCacheForTests() {
  embeddingCache.clear();
  embeddingInFlight.clear();
}
