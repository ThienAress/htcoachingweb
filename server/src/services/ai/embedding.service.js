// Embedding Service — Vector search cho Knowledge Base
// Dùng Gemini gemini-embedding-2 (GA, multimodal, MRL supported)

const EMBEDDING_MODEL = "gemini-embedding-2";
const EMBEDDING_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const EMBEDDING_DIMENSION = 768;

/**
 * Tạo embedding vector từ text
 * @param {string} text - Text cần embed
 * @returns {number[]} Vector 768 chiều
 */
export async function generateEmbedding(text) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY chưa được cấu hình");

  // Chuẩn hóa text: trim, lowercase, bỏ ký tự thừa
  const cleanText = text.trim().toLowerCase().replace(/\s+/g, " ");
  if (!cleanText) throw new Error("Text rỗng, không thể tạo embedding");

  const url = `${EMBEDDING_BASE_URL}/models/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: `models/${EMBEDDING_MODEL}`,
      content: { parts: [{ text: cleanText }] },
      outputDimensionality: EMBEDDING_DIMENSION,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Embedding API error [${response.status}]: ${err?.error?.message || "Unknown"}`);
  }

  const data = await response.json();
  const values = data?.embedding?.values;

  if (!values || !Array.isArray(values) || values.length === 0) {
    throw new Error(`Embedding trả về không hợp lệ: got ${values?.length || 0}D`);
  }

  return values;
}

/**
 * Tính cosine similarity giữa 2 vectors
 * @param {number[]} vecA
 * @param {number[]} vecB
 * @returns {number} Similarity từ -1 đến 1 (càng gần 1 = càng giống)
 */
export function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

/**
 * Search Knowledge Base bằng vector similarity
 * @param {string} query - Câu hỏi của user
 * @param {{ limit?: number, threshold?: number, category?: string }} options
 * @returns {Array<{ question, answer, category, similarity, _id }>}
 */
export async function searchKnowledgeBase(query, options = {}) {
  const { limit = 3, threshold = 0.75, category } = options;

  // Lazy import để tránh circular dependency
  const { default: KnowledgeEntry } = await import("../../models/KnowledgeEntry.js");

  // Lấy tất cả entries published kèm embedding + variants
  const filter = { status: "published" };
  if (category) filter.category = category;

  const entries = await KnowledgeEntry.find(filter)
    .select("+embedding +variants question answer category tags _id")
    .lean();

  if (entries.length === 0) return [];

  // Embed query
  let queryVector;
  try {
    queryVector = await generateEmbedding(query);
  } catch (err) {
    console.error("KB search embedding error:", err.message);
    return [];
  }

  // Tính similarity cho từng entry (main + variants → lấy max)
  const scored = entries
    .filter((e) => e.embedding && e.embedding.length > 0)
    .map((e) => {
      // Similarity với main question
      let bestSim = cosineSimilarity(queryVector, e.embedding);
      let matchedQuestion = e.question;

      // Check variants (nếu có)
      if (e.variants?.length > 0) {
        for (const v of e.variants) {
          if (v.embedding?.length > 0) {
            const sim = cosineSimilarity(queryVector, v.embedding);
            if (sim > bestSim) {
              bestSim = sim;
              matchedQuestion = v.text;
            }
          }
        }
      }

      return {
        _id: e._id,
        question: e.question,
        matchedQuestion, // Câu hỏi match cao nhất (có thể là variant)
        answer: e.answer,
        category: e.category,
        tags: e.tags,
        similarity: bestSim,
        variantCount: e.variants?.length || 0,
      };
    })
    .filter((e) => e.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return scored;
}
