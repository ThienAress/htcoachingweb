// searchKnowledge.tool.js — Google Search Grounding sub-agent
// Tách riêng khỏi function calling để tránh conflict Gemini API
// Dùng generateContent (non-streaming) vì kết quả được inject vào conversation

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
// Ưu tiên GEMINI_SEARCH_MODEL từ Doppler, fallback gemini-2.5-flash (hỗ trợ Google Search grounding)
const SEARCH_MODEL = process.env.GEMINI_SEARCH_MODEL || "gemini-2.5-flash";
import { safeLog } from "../../../utils/safeLogger.js";
import {
  recordGeminiRequest,
  recordGeminiResult,
} from "../../../observability/providerUsageMetrics.js";

const MAX_GROUNDING_SOURCES = 3;
const MAX_GROUNDING_URL_CHARACTERS = 2048;
const MAX_GROUNDING_TITLE_CHARACTERS = 160;
const unavailable = (text, searchOutcome) => ({
  text,
  uiCard: null,
  meta: {
    evidenceAvailable: false,
    sourceCount: 0,
    sources: [],
    searchOutcome,
  },
});

const escapeMarkdownLabel = (value) =>
  String(value || "")
    .slice(0, MAX_GROUNDING_TITLE_CHARACTERS)
    .replace(/[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069]/g, " ")
    .replace(/([\\[\]])/g, "\\$1")
    .replace(/[\r\n]+/g, " ")
    .trim();

export const normalizeGroundingSources = (chunks) => {
  if (!Array.isArray(chunks)) return [];
  const seen = new Set();
  const sources = [];

  for (const chunk of chunks) {
    const source = chunk?.web;
    if (!source?.uri || String(source.uri).length > MAX_GROUNDING_URL_CHARACTERS) {
      continue;
    }
    try {
      const url = new URL(String(source.uri));
      if (url.protocol !== "https:" || url.username || url.password) continue;
      url.hash = "";
      const href = url.href;
      if (seen.has(href)) continue;
      seen.add(href);
      const title = escapeMarkdownLabel(source.title) || escapeMarkdownLabel(url.hostname);
      if (!title) continue;
      sources.push({ title, uri: href });
      if (sources.length === MAX_GROUNDING_SOURCES) break;
    } catch {
      // Provider URLs are untrusted data; malformed entries are ignored.
    }
  }
  return sources;
};

/**
 * Tra cứu thông tin thực tế bằng Google Search Grounding
 * @param {{ query: string }} params
 * @param {{ signal?: AbortSignal }} context
 * @returns {{ text: string, uiCard: null }}
 */
export async function searchKnowledge({ query }, context = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return unavailable("Không thể tìm kiếm: chưa cấu hình GEMINI_API_KEY.", "provider_error");
  }

  const body = {
    contents: [{ role: "user", parts: [{ text: query }] }],
    tools: [{ googleSearch: {} }],
    systemInstruction: {
      parts: [{
        text: "Bạn là trợ lý tra cứu thông tin fitness. Trả lời ngắn gọn, chính xác bằng Tiếng Việt. Tập trung đúng vào thông tin được hỏi, không lan man.",
      }],
    },
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 600,
    },
  };

  const url = `${GEMINI_BASE_URL}/models/${SEARCH_MODEL}:generateContent?key=${apiKey}`;
  let providerOutcomeRecorded = false;

  try {
    recordGeminiRequest("search_grounding");
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: context.signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      recordGeminiResult("search_grounding", {
        success: false,
        usage: errorData?.usageMetadata,
      });
      providerOutcomeRecorded = true;
      // Nếu model không hỗ trợ grounding → fallback message
      if (response.status === 400) {
        return unavailable("Tìm kiếm không khả dụng với model hiện tại.", "no_supported_source");
      }
      // Quota exceeded / rate limit
      if (response.status === 429) {
        safeLog.warn("ai.search_rate_limited", "Search provider rate limited");
        return unavailable("Chức năng tìm kiếm đang tạm giới hạn. Bạn thử lại sau nhé.", "provider_error");
      }
      safeLog.warn("ai.search_provider_error", "Search provider returned error", {
        status: response.status,
      });
      return unavailable("Không thể tìm kiếm lúc này. Bạn thử lại sau nhé.", "provider_error");
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];

    // Lấy text từ response parts
    const text = candidate?.content?.parts
      ?.filter((p) => p.text)
      ?.map((p) => p.text)
      ?.join("") || "Không tìm thấy thông tin phù hợp.";

    // Lấy nguồn (URLs) từ grounding metadata — tối đa 3 nguồn
    const sources = normalizeGroundingSources(
      candidate?.groundingMetadata?.groundingChunks,
    );

    let result = text;
    if (sources.length === 0) {
      result = "Hiện chưa tìm thấy nguồn hỗ trợ đủ rõ để xác minh thông tin này.";
    } else {
      const sourceLinks = sources
        .map((s) => `[${s.title}](<${s.uri}>)`)
        .join(" · ");
      result += `\n\n📎 *Nguồn: ${sourceLinks}*`;
    }

    recordGeminiResult("search_grounding", {
      success: true,
      usage: data.usageMetadata,
    });
    providerOutcomeRecorded = true;
    return {
      text: result,
      uiCard: null,
      meta: {
        evidenceAvailable: sources.length > 0,
        sourceCount: sources.length,
        sources,
        searchOutcome: sources.length > 0 ? "grounded" : "no_supported_source",
      },
    };
  } catch {
    if (!providerOutcomeRecorded) {
      recordGeminiResult("search_grounding", { success: false });
    }
    return unavailable("Lỗi kết nối khi tìm kiếm. Vui lòng thử lại.", "provider_error");
  }
}
