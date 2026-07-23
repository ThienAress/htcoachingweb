// Embedding + bounded vector search for the verified Knowledge Base.
import {
  incrementMetric,
  observeMetric,
} from "../../observability/metrics.js";
import { safeLog } from "../../utils/safeLogger.js";

export const EMBEDDING_MODEL = "gemini-embedding-2";
export const EMBEDDING_DIMENSION = 768;
export const EMBEDDING_VERSION = `${EMBEDDING_MODEL}:${EMBEDDING_DIMENSION}`;

const EMBEDDING_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const EMBEDDING_TIMEOUT_MS = Number(process.env.EMBEDDING_TIMEOUT_MS) || 15000;
const MAX_FALLBACK_ENTRIES = Number(process.env.KB_MAX_SCAN_ENTRIES) || 500;
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 100;
const embeddingCache = new Map();

function normalizeEmbeddingText(text) {
  return String(text || "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
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

export async function generateEmbedding(text, options = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Embedding provider chưa được cấu hình");

  const cleanText = normalizeEmbeddingText(text);
  if (!cleanText) throw new Error("Text rỗng, không thể tạo embedding");
  if (cleanText.length > 1000) {
    throw new Error("Text embedding vượt quá 1000 ký tự");
  }

  const cached = getCachedEmbedding(cleanText);
  if (cached) return cached;

  const linked = createLinkedSignal(
    options.signal,
    Math.min(
      Math.max(Number(options.timeoutMs) || EMBEDDING_TIMEOUT_MS, 3000),
      60000,
    ),
  );
  const url = `${EMBEDDING_BASE_URL}/models/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: `models/${EMBEDDING_MODEL}`,
        content: { parts: [{ text: cleanText }] },
        outputDimensionality: EMBEDDING_DIMENSION,
      }),
      signal: linked.signal,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      safeLog.warn("kb.embedding_provider_error", "Provider returned error", {
        status: response.status,
      });
      throw new Error(`Embedding provider trả HTTP ${response.status}`);
    }

    const data = await response.json();
    const values = data?.embedding?.values;
    if (
      !Array.isArray(values) ||
      values.length !== EMBEDDING_DIMENSION ||
      values.some((value) => !Number.isFinite(value))
    ) {
      throw new Error("Embedding provider trả vector không hợp lệ");
    }

    setCachedEmbedding(cleanText, values);
    return values;
  } catch (error) {
    if (!options.signal?.aborted) {
      incrementMetric("kb.embedding_failures");
    }
    if (linked.signal.aborted && !options.signal?.aborted) {
      throw new Error("Embedding provider phản hồi quá thời gian");
    }
    throw error;
  } finally {
    linked.cleanup();
  }
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

async function atlasVectorSearch(KnowledgeEntry, queryVector, options) {
  const indexName = process.env.KB_VECTOR_INDEX;
  if (!indexName || !/^[a-z0-9_-]+$/i.test(indexName)) return null;

  const filter = {
    status: "published",
    embeddingStatus: "ready",
  };
  if (options.category) filter.category = options.category;

  return KnowledgeEntry.aggregate([
    {
      $vectorSearch: {
        index: indexName,
        path: "embedding",
        queryVector,
        numCandidates: Math.min(Math.max(options.limit * 20, 50), 200),
        limit: options.limit,
        filter,
      },
    },
    {
      $project: {
        question: 1,
        answer: 1,
        category: 1,
        tags: 1,
        variantCount: 1,
        similarity: { $meta: "vectorSearchScore" },
      },
    },
    { $match: { similarity: { $gte: options.threshold } } },
  ]);
}

async function boundedFallbackSearch(KnowledgeEntry, queryVector, options) {
  const filter = { status: "published", embeddingStatus: "ready" };
  if (options.category) filter.category = options.category;

  const entries = await KnowledgeEntry.find(filter)
    .select("+embedding +variants question answer category tags variantCount _id")
    .sort({ usageCount: -1, updatedAt: -1 })
    .limit(Math.min(Math.max(MAX_FALLBACK_ENTRIES, 50), 2000))
    .lean();

  return entries
    .filter((entry) => entry.embedding?.length === EMBEDDING_DIMENSION)
    .map((entry) => {
      let similarity = cosineSimilarity(queryVector, entry.embedding);
      let matchedQuestion = entry.question;
      for (const variant of entry.variants || []) {
        if (variant.embedding?.length !== EMBEDDING_DIMENSION) continue;
        const variantSimilarity = cosineSimilarity(queryVector, variant.embedding);
        if (variantSimilarity > similarity) {
          similarity = variantSimilarity;
          matchedQuestion = variant.text;
        }
      }

      return {
        _id: entry._id,
        question: entry.question,
        matchedQuestion,
        answer: entry.answer,
        category: entry.category,
        tags: entry.tags,
        similarity,
        variantCount: entry.variantCount || 0,
      };
    })
    .filter((entry) => entry.similarity >= options.threshold)
    .sort((left, right) => right.similarity - left.similarity)
    .slice(0, options.limit);
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
  };
  const { default: KnowledgeEntry } = await import("../../models/KnowledgeEntry.js");
  const hasEntries = await KnowledgeEntry.exists({
    status: "published",
    embeddingStatus: "ready",
    ...(boundedOptions.category && { category: boundedOptions.category }),
  });
  if (!hasEntries) return [];

  let queryVector;
  try {
    queryVector = await generateEmbedding(cleanQuery, { signal: options.signal });
  } catch (error) {
    safeLog.error("kb.query_embedding_failed", error);
    return [];
  }

  try {
    const atlasResults = await atlasVectorSearch(
      KnowledgeEntry,
      queryVector,
      boundedOptions,
    );
    if (atlasResults) {
      return atlasResults.map((entry) => ({
        ...entry,
        matchedQuestion: entry.question,
      }));
    }
  } catch (error) {
    safeLog.error("kb.vector_search_fallback", error);
  }

  incrementMetric("kb.vector_fallbacks");
  return boundedFallbackSearch(KnowledgeEntry, queryVector, boundedOptions);
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
}
