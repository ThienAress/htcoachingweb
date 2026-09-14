// searchKnowledge.tool.js — Google Search Grounding sub-agent
// Tách riêng khỏi function calling để tránh conflict Gemini API
// Dùng generateContent (non-streaming) vì kết quả được inject vào conversation

import { prepareExternalKnowledgeQuery } from "../knowledgePrivacy.js";
import {
  recordGeminiRequest,
  recordGeminiResult,
} from "../../../observability/providerUsageMetrics.js";
import { safeLog } from "../../../utils/safeLogger.js";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
// Ưu tiên GEMINI_SEARCH_MODEL từ Doppler, fallback gemini-2.5-flash (hỗ trợ Google Search grounding)
const SEARCH_MODEL = process.env.GEMINI_SEARCH_MODEL || "gemini-2.5-flash";

const MAX_GROUNDING_SOURCES = 3;
const MAX_GROUNDING_SUPPORTS = 12;
const MAX_GROUNDING_URL_CHARACTERS = 2048;
const MAX_GROUNDING_TITLE_CHARACTERS = 160;
const MAX_GROUNDED_SEGMENT_CHARACTERS = 4000;
const unavailableEvidence = (text) => ({
  text,
  uiCard: null,
  meta: { evidenceAvailable: false, sourceCount: 0, sources: [] },
});

const escapeMarkdownLabel = (value) =>
  String(value || "")
    .slice(0, MAX_GROUNDING_TITLE_CHARACTERS)
    .replace(/[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069]/g, " ")
    .replace(/([\\[\]])/g, "\\$1")
    .replace(/[\r\n]+/g, " ")
    .trim();

const normalizeGroundingSource = (chunk) => {
  const source = chunk?.web;
  if (!source?.uri || String(source.uri).length > MAX_GROUNDING_URL_CHARACTERS) {
    return null;
  }
  try {
    const url = new URL(String(source.uri));
    if (url.protocol !== "https:" || url.username || url.password) return null;
    url.hash = "";
    const hostname = escapeMarkdownLabel(url.hostname);
    const suppliedTitle = escapeMarkdownLabel(source.title);
    // Provider metadata is untrusted: keep its useful title, but always show
    // the actual destination host so a forged publisher cannot impersonate it.
    const title = suppliedTitle && suppliedTitle !== hostname
      ? `${suppliedTitle} (${hostname})`
      : hostname;
    return title ? { title, uri: url.href } : null;
  } catch {
    return null;
  }
};

export const normalizeGroundingSources = (chunks) => {
  if (!Array.isArray(chunks)) return [];
  const seen = new Set();
  const sources = [];
  for (const chunk of chunks) {
    const source = normalizeGroundingSource(chunk);
    if (!source || seen.has(source.uri)) continue;
    seen.add(source.uri);
    sources.push(source);
    if (sources.length === MAX_GROUNDING_SOURCES) break;
  }
  return sources;
};

const normalizeSupportedSegment = (segment, candidateText) => {
  const supplied = String(segment?.text || "").trim();
  if (supplied && candidateText.includes(supplied)) {
    return supplied.slice(0, MAX_GROUNDED_SEGMENT_CHARACTERS);
  }
  const start = Number(segment?.startIndex);
  const end = Number(segment?.endIndex);
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end <= start ||
    end > candidateText.length
  ) {
    return "";
  }
  return candidateText.slice(start, end).trim().slice(
    0,
    MAX_GROUNDED_SEGMENT_CHARACTERS,
  );
};

// Grounding hỗ trợ claim, không chứng thực link do model tự viết trong claim.
// Chỉ các URI lấy từ groundingChunks mới được dựng thành Markdown link.
const neutralizeSegmentLinks = (value) =>
  String(value || "")
    .replace(/^[ \t]{0,3}\[[^\]\r\n]+\]:[ \t]*\S[^\r\n]*$/gm, "")
    .replace(/!?\[([^\]\r\n]+)\]\((?:<[^<>\r\n]*>|[^)\r\n]*)\)/g, "$1")
    .replace(/!?\[([^\]\r\n]+)\]\[[^\]\r\n]*\]/g, "$1")
    .replace(/<(?:https?:\/\/|ftp:\/\/|www\.)[^>\r\n]*>/gi, "")
    .replace(/\b(?:https?:\/\/|ftp:\/\/|www\.)[^\s<>\[\])]+/gi, (url) =>
      url.match(/[.,;:!?]+$/)?.[0] || "",
    )
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "")
    .replace(/[\\\[\]<>]/g, "\\$&")
    .trim();

const buildGroundedEvidence = (candidate, candidateText) => {
  const chunks = Array.isArray(candidate?.groundingMetadata?.groundingChunks)
    ? candidate.groundingMetadata.groundingChunks
    : [];
  const supports = Array.isArray(candidate?.groundingMetadata?.groundingSupports)
    ? candidate.groundingMetadata.groundingSupports.slice(0, MAX_GROUNDING_SUPPORTS)
    : [];
  const selectedSources = [];
  const selectedSourceUris = new Set();
  const selectedSegments = [];
  const selectedSegmentTexts = new Set();

  for (const support of supports) {
    const segmentText = normalizeSupportedSegment(
      support?.segment,
      candidateText,
    );
    if (!segmentText || selectedSegmentTexts.has(segmentText)) continue;
    const safeSegmentText = neutralizeSegmentLinks(segmentText);
    if (!safeSegmentText) continue;

    const supportSources = [];
    for (const rawIndex of Array.isArray(support?.groundingChunkIndices)
      ? support.groundingChunkIndices
      : []) {
      const index = Number(rawIndex);
      if (!Number.isInteger(index) || index < 0 || index >= chunks.length) {
        continue;
      }
      const source = normalizeGroundingSource(chunks[index]);
      if (!source) continue;
      const knownSource = selectedSources.find(
        (candidateSource) => candidateSource.uri === source.uri,
      );
      if (knownSource) {
        supportSources.push(knownSource);
        continue;
      }
      if (selectedSources.length >= MAX_GROUNDING_SOURCES) continue;
      selectedSources.push(source);
      selectedSourceUris.add(source.uri);
      supportSources.push(source);
    }
    if (supportSources.length === 0) continue;
    selectedSegmentTexts.add(segmentText);
    selectedSegments.push({ text: safeSegmentText, sources: supportSources });
  }

  const text = selectedSegments
    .map(({ text: supportedText, sources }) => {
      const links = sources
        .filter((source) => selectedSourceUris.has(source.uri))
        .map((source) => `[${source.title}](<${source.uri}>)`)
        .join(" · ");
      return links
        ? `${supportedText}\n\n📎 *Nguồn: ${links}*`
        : supportedText;
    })
    .join("\n\n");

  return { text, sources: selectedSources };
};

/**
 * Tra cứu thông tin thực tế bằng Google Search Grounding
 * @param {{ query: string }} params
 * @param {{ signal?: AbortSignal }} context
 * @returns {{ text: string, uiCard: null, meta: { evidenceAvailable: boolean, sourceCount: number, sources: Array<{title: string, uri: string}> } }}
 */
export async function searchKnowledge({ query }, context = {}) {
  const preparedQuery = prepareExternalKnowledgeQuery(query, {
    allowedPublicPersonNames: context.allowedPublicPersonNames,
  });
  if (!preparedQuery.eligible) {
    return unavailableEvidence(
      "Mình không thể gửi dữ liệu cá nhân hoặc thông tin sức khỏe riêng lên web để tra cứu. Bạn có thể hỏi lại theo hướng thông tin chung, không kèm dữ liệu riêng.",
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return unavailableEvidence(
      "Hiện không thể xác minh thông tin bằng nguồn web. Vui lòng thử lại sau.",
    );
  }

  const body = {
    contents: [{ role: "user", parts: [{ text: preparedQuery.query }] }],
    tools: [{ googleSearch: {} }],
    systemInstruction: {
      parts: [{
        text: "Bạn thu thập bằng chứng web công khai cho mọi chủ đề an toàn. Trả lời ngắn gọn bằng Tiếng Việt, chỉ nêu dữ kiện được nguồn hỗ trợ và không suy đoán. Ưu tiên nguồn chính thức, nguồn sơ cấp hoặc tổ chức chuyên môn phù hợp với chủ đề.",
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
        return unavailableEvidence(
          "Hiện không thể xác minh thông tin bằng nguồn web với model tìm kiếm này.",
        );
      }
      // Quota exceeded / rate limit
      if (response.status === 429) {
        safeLog.warn("ai.search_rate_limited", "Search provider rate limited");
        return unavailableEvidence(
          "Hiện không thể xác minh thông tin vì tra cứu web đang tạm giới hạn.",
        );
      }
      safeLog.warn("ai.search_provider_error", "Search provider returned error", {
        status: response.status,
      });
      return unavailableEvidence(
        "Hiện không thể xác minh thông tin bằng nguồn web. Vui lòng thử lại sau.",
      );
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];

    // Chỉ phần text có groundingSupports trỏ tới HTTPS chunk hợp lệ mới được
    // xem là evidence. Có URL nhưng không có claim-support mapping phải fail closed.
    const candidateText = candidate?.content?.parts
      ?.filter((p) => p.text)
      ?.map((p) => p.text)
      ?.join("") || "Không tìm thấy thông tin phù hợp.";
    const groundedEvidence = buildGroundedEvidence(candidate, candidateText);
    const sources = groundedEvidence.sources;
    let result = groundedEvidence.text;
    if (sources.length === 0) {
      result = "Hiện chưa tìm thấy nguồn web phù hợp để xác minh thông tin này.";
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
      },
    };
  } catch (error) {
    if (context.signal?.aborted) throw error;
    if (!providerOutcomeRecorded) {
      recordGeminiResult("search_grounding", { success: false });
    }
    return unavailableEvidence(
      "Hiện không thể xác minh thông tin do kết nối tra cứu web bị lỗi.",
    );
  }
}
