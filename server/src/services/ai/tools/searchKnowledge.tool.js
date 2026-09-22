// searchKnowledge.tool.js — Google Search Grounding sub-agent
// Tách riêng khỏi function calling để tránh conflict Gemini API
// Dùng generateContent (non-streaming) vì kết quả được inject vào conversation

import { prepareExternalKnowledgeQuery } from "../knowledgePrivacy.js";
import {
  recordGeminiRequest,
  recordGeminiResult,
  recordGeminiSearchGroundingDisposition,
} from "../../../observability/providerUsageMetrics.js";
import { safeLog } from "../../../utils/safeLogger.js";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_SEARCH_MODEL = "gemini-2.5-flash";
const SAFE_MODEL_IDENTIFIER = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/i;
const resolveSearchModel = () =>
  String(process.env.GEMINI_SEARCH_MODEL || DEFAULT_SEARCH_MODEL).trim() ||
  DEFAULT_SEARCH_MODEL;

const MAX_GROUNDING_SOURCES = 3;
const MAX_GROUNDING_SUPPORTS = 12;
const MAX_GROUNDING_URL_CHARACTERS = 2048;
const MAX_GROUNDING_TITLE_CHARACTERS = 160;
const MAX_GROUNDED_SEGMENT_CHARACTERS = 4000;
const MAX_CARD_TOPIC_CHARACTERS = 160;
const unavailableEvidence = (
  text,
  searchOutcome,
  diagnostics = null,
) => ({
  text,
  uiCard: null,
  meta: {
    evidenceAvailable: false,
    sourceCount: 0,
    sources: [],
    searchOutcome,
    ...(diagnostics
      ? {
          diagnosticCode: diagnostics.code,
          providerRequestMade: diagnostics.providerRequestMade,
        }
      : {}),
  },
});

const classifyHttpFailure = (status) => {
  if ([400, 404].includes(status)) return "request_rejected";
  if ([401, 403].includes(status)) return "permission_denied";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "upstream_error";
  return "http_error";
};

const recordSearchFailureLog = ({ code, model, status }) => {
  const modelLabel = String(model || DEFAULT_SEARCH_MODEL);
  safeLog.warn(
    "ai.search_grounding_unavailable",
    "Search grounding unavailable",
    {
      diagnosticCode: code,
      model:
        modelLabel.length <= 100 && SAFE_MODEL_IDENTIFIER.test(modelLabel)
          ? modelLabel
          : "invalid_model_identifier",
      ...(Number.isInteger(status) ? { status } : {}),
    },
  );
};

const normalizeCardTopic = (value) =>
  String(value || "")
    .replace(/[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_CARD_TOPIC_CHARACTERS) || "Nguồn cho câu trả lời";

const buildWebSourcesCard = ({ topic, sources }) =>
  sources.length > 0
    ? {
        cardType: "webSources",
        data: {
          topic: normalizeCardTopic(topic),
          searchedAt: new Date().toISOString(),
          sources,
        },
      }
    : null;

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
 * @returns {{ text: string, uiCard: object|null, meta: { evidenceAvailable: boolean, sourceCount: number, sources: Array<{title: string, uri: string}> } }}
 */
export async function searchKnowledge({ query }, context = {}) {
  const preparedQuery = prepareExternalKnowledgeQuery(query, {
    allowedPublicPersonNames: context.allowedPublicPersonNames,
  });
  if (!preparedQuery.eligible) {
    recordGeminiSearchGroundingDisposition("privacy_blocked");
    return unavailableEvidence(
      "Mình không thể gửi dữ liệu cá nhân hoặc thông tin sức khỏe riêng lên web để tra cứu. Bạn có thể hỏi lại theo hướng thông tin chung, không kèm dữ liệu riêng.",
      "not_called",
      { code: "privacy_blocked", providerRequestMade: false },
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    recordGeminiSearchGroundingDisposition("not_configured");
    recordSearchFailureLog({
      code: "not_configured",
      model: resolveSearchModel(),
    });
    return unavailableEvidence(
      "Hiện không thể xác minh thông tin bằng nguồn web. Vui lòng thử lại sau.",
      "provider_error",
      { code: "not_configured", providerRequestMade: false },
    );
  }

  const searchModel = resolveSearchModel();

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

  const url =
    `${GEMINI_BASE_URL}/models/${encodeURIComponent(searchModel)}` +
    `:generateContent?key=${apiKey}`;
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
      const diagnosticCode = classifyHttpFailure(response.status);
      recordGeminiSearchGroundingDisposition(diagnosticCode);
      recordSearchFailureLog({
        code: diagnosticCode,
        model: searchModel,
        status: response.status,
      });
      if (diagnosticCode === "request_rejected") {
        return unavailableEvidence(
          "Hiện không thể xác minh thông tin bằng nguồn web với model tìm kiếm này.",
          "provider_error",
          { code: diagnosticCode, providerRequestMade: true },
        );
      }
      if (diagnosticCode === "rate_limited") {
        return unavailableEvidence(
          "Hiện không thể xác minh thông tin vì tra cứu web đang tạm giới hạn.",
          "provider_error",
          { code: diagnosticCode, providerRequestMade: true },
        );
      }
      return unavailableEvidence(
        "Hiện không thể xác minh thông tin bằng nguồn web. Vui lòng thử lại sau.",
        "provider_error",
        { code: diagnosticCode, providerRequestMade: true },
      );
    }

    let data;
    try {
      data = await response.json();
    } catch {
      recordGeminiResult("search_grounding", { success: false });
      providerOutcomeRecorded = true;
      recordGeminiSearchGroundingDisposition("invalid_response");
      recordSearchFailureLog({
        code: "invalid_response",
        model: searchModel,
        status: response.status,
      });
      return unavailableEvidence(
        "Hiện không thể xác minh thông tin vì dịch vụ tra cứu trả dữ liệu không hợp lệ.",
        "provider_error",
        { code: "invalid_response", providerRequestMade: true },
      );
    }
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
    const diagnosticCode = sources.length > 0
      ? "grounded"
      : "no_supported_source";
    recordGeminiSearchGroundingDisposition(diagnosticCode);
    return {
      text: result,
      uiCard: buildWebSourcesCard({
        topic: preparedQuery.query,
        sources,
      }),
      meta: {
        evidenceAvailable: sources.length > 0,
        sourceCount: sources.length,
        sources,
        searchOutcome: sources.length > 0
          ? "grounded"
          : "no_supported_source",
        diagnosticCode,
        providerRequestMade: true,
      },
    };
  } catch (error) {
    if (!providerOutcomeRecorded) {
      recordGeminiResult("search_grounding", { success: false });
      providerOutcomeRecorded = true;
    }
    if (context.signal?.aborted) {
      recordGeminiSearchGroundingDisposition("aborted");
      recordSearchFailureLog({ code: "aborted", model: searchModel });
      throw error;
    }
    recordGeminiSearchGroundingDisposition("network_error");
    recordSearchFailureLog({ code: "network_error", model: searchModel });
    return unavailableEvidence(
      "Hiện không thể xác minh thông tin do kết nối tra cứu web bị lỗi.",
      "provider_error",
      { code: "network_error", providerRequestMade: true },
    );
  }
}
