import { prepareExternalKnowledgeQuery } from "../knowledgePrivacy.js";
import { selectWebEvidence } from "../webEvidence.js";
import { synthesizeWebEvidence } from "../webGroundingSynthesis.js";
import { safeLog } from "../../../utils/safeLogger.js";

const ENDPOINT = "https://api.search.brave.com/res/v1/llm/context";
const MAX_RESPONSE_BYTES = 192 * 1024;
const buildSearchQuery = (query) => /\bWHO\b|World Health Organization|Tổ chức Y tế Thế giới/iu.test(query)
  ? `site:who.int ${query}`.slice(0, 600)
  : query;
const unavailable = (code, providerRequestMade, outcome = "provider_error", failureStage = undefined) => ({
  text: "Mình chưa thể xác minh câu hỏi này bằng nguồn web đáng tin cậy lúc này. Bạn thử lại sau nhé.",
  uiCard: null,
  meta: { evidenceAvailable: false, sourceCount: 0, sources: [], searchOutcome: outcome,
    diagnosticCode: code, ...(failureStage ? { failureStage } : {}), providerRequestMade,
    searchProvider: "brave" },
});

async function boundedJson(response) {
  const length = Number(response.headers.get("content-length"));
  if (length > MAX_RESPONSE_BYTES || !response.body) throw new Error("response_limit");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) throw new Error("response_limit");
      text += decoder.decode(part.value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text);
  } finally {
    await reader.cancel().catch(() => {});
  }
}

export async function braveSearchKnowledge({ query }, context = {}) {
  const prepared = prepareExternalKnowledgeQuery(query, {
    allowedPublicPersonNames: context.allowedPublicPersonNames,
  });
  if (!prepared.eligible) return unavailable("privacy_blocked", false, "not_called");
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key || /\s/.test(key)) return unavailable("search_not_configured", false, "not_called");
  if (prepared.query.length > 600 || prepared.query.split(/\s+/).length > 75) {
    return unavailable("query_limit", false, "not_called");
  }
  if (context.signal?.aborted) throw context.signal.reason || new Error("aborted");
  const signal = context.signal
    ? AbortSignal.any([context.signal, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000);
  const started = performance.now();
  let requested = false;
  let outcome = "provider_error";
  let code = "network_error";
  let status = null;
  let sourceCount = 0;
  let failureStage = null;
  try {
    requested = true;
    const response = await fetch(ENDPOINT, {
      method: "POST", redirect: "error", signal,
      headers: { "X-Subscription-Token": key, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ q: buildSearchQuery(prepared.query), count: 6, maximum_number_of_urls: 6,
        maximum_number_of_tokens: 4096, maximum_number_of_tokens_per_url: 1536,
        maximum_number_of_snippets: 12, maximum_number_of_snippets_per_url: 4,
        context_threshold_mode: "strict", safesearch: "strict", enable_local: false }),
    });
    status = response.status;
    if (!response.ok) {
      code = [401, 403].includes(status) ? "permission_denied" : status === 429 ? "rate_limited" : "http_error";
      await response.body?.cancel().catch(() => {});
      return unavailable(code, true);
    }
    code = "invalid_response";
    const evidence = selectWebEvidence(await boundedJson(response), prepared.query);
    if (!evidence.length) {
      failureStage = "retrieval";
      code = "no_supported_source";
      outcome = "no_supported_source";
      return unavailable(code, true, outcome, "retrieval");
    }
    code = "synthesis_failed";
    const answer = await synthesizeWebEvidence(prepared.query, evidence, {
      signal: context.signal, deadlineAt: context.deadlineAt,
    });
    if (!answer.text || !answer.sources.length) {
      failureStage = "synthesis";
      code = "no_supported_source";
      outcome = "no_supported_source";
      return unavailable(code, true, outcome, "synthesis");
    }
    outcome = "grounded";
    code = "grounded";
    sourceCount = answer.sources.length;
    return { text: answer.text,
      uiCard: { cardType: "webSources", data: { topic: prepared.query.slice(0, 160),
        searchedAt: new Date().toISOString(), sources: answer.sources } },
      meta: { evidenceAvailable: true, sourceCount, sources: answer.sources,
        searchOutcome: outcome, diagnosticCode: code, providerRequestMade: true, searchProvider: "brave" },
    };
  } catch (error) {
    if (context.signal?.aborted) {
      code = "aborted";
      throw error;
    }
    if (signal.aborted) code = "timeout";
    return unavailable(code, requested);
  } finally {
    if (requested) safeLog.info("ai.brave_search_completed", {
      durationMs: Math.round(performance.now() - started), searchOutcome: outcome,
      diagnosticCode: code, httpStatus: status, sourceCount, retryCount: 0,
      failureStage,
    });
  }
}
