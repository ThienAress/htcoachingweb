const SHA = /^[a-f0-9]{40}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const OID = /^[a-f0-9]{24}$/i;
const SAFE_CODE = /^[A-Z0-9_]{1,100}$/;
const HEX64 = /^[a-f0-9]{64}$/;
const CLEANUP_COLLECTIONS = ["staging_ai_acceptance_claims", "knowledgeentries", "chatconversations",
  "serviceusagebuckets", "aimemories", "aimemorypreferences", "aitoolconfirmations",
  "aimoderationstates", "users"];
const PROVIDER_KEYS = [
  "provider.gemini_chat_requests", "provider.gemini_chat_succeeded",
  "provider.gemini_chat_failed", "provider.gemini_chat_unavailable",
  "provider.gemini_chat_rate_limited", "provider.gemini_chat_not_required",
];

export const providerDelta = (before, after, releaseSha) => {
  if (before?.runtimeReleaseSha !== releaseSha || after?.runtimeReleaseSha !== releaseSha ||
      !SHA.test(releaseSha || "") || !UUID.test(before?.runtimeInstanceId || "") ||
      after?.runtimeInstanceId !== before.runtimeInstanceId ||
      !Number.isFinite(before?.uptimeSeconds) || !Number.isFinite(after?.uptimeSeconds) ||
      after.uptimeSeconds < before.uptimeSeconds) {
    const error = new Error("Staging metrics runtime identity changed");
    error.code = "STAGING_AI_RELIABILITY_RUNTIME_DRIFT";
    throw error;
  }
  return Object.fromEntries(PROVIDER_KEYS.map((key) => {
    const first = before.counters?.[key];
    const last = after.counters?.[key];
    if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last) || last < first) {
      const error = new Error("Staging provider counters are inconclusive");
      error.code = "STAGING_AI_RELIABILITY_METRICS_INVALID";
      throw error;
    }
    return [key, last - first];
  }));
};

export const buildSafeReliabilityEvidence = (state) => ({
  schemaVersion: 1,
  kind: "staging-ai-reliability-acceptance",
  releaseSha: SHA.test(state.releaseSha || "") ? state.releaseSha : null,
  runId: UUID.test(state.runId || "") ? state.runId : null,
  status: state.status === "passed" ? "passed" : "failed",
  startedAt: state.startedAt,
  completedAt: state.completedAt,
  runtimeFingerprint: HEX64.test(state.runtimeFingerprint || "") ? state.runtimeFingerprint : null,
  syntheticIds: {
    userId: OID.test(state.userId || "") ? state.userId : null,
    adminUserId: OID.test(state.adminUserId || "") ? state.adminUserId : null,
  },
  prompts: (state.prompts || []).map((item) => ({
    number: Number.isInteger(item.number) && item.number >= 1 && item.number <= 11 ? item.number : null,
    scenarioId: /^[-a-z0-9]{1,100}$/.test(item.scenarioId || "") ? item.scenarioId : null,
    requestId: UUID.test(item.requestId || "") ? item.requestId : null,
    conversationId: OID.test(item.conversationId || "") ? item.conversationId : null,
    contextSource: ["synthetic_300_kcal_plan", "prior_live_turn", "new_conversation"].includes(item.contextSource)
      ? item.contextSource : null,
    routeDomain: ["fitness", "general", "adjacent", "ht_service"].includes(item.routeDomain) ? item.routeDomain : null,
    evidenceMode: ["internal_kb", "model_prior", "web_required"].includes(item.evidenceMode) ? item.evidenceMode : null,
    webSearchOutcome: ["not_called", "provider_error", "no_supported_source", "grounded"].includes(item.webSearchOutcome) ? item.webSearchOutcome : null,
    tools: (item.tools || []).filter((tool) => /^[-a-z0-9_]{1,100}$/.test(tool.name || "") &&
      ["success", "error", "validation_failed", "timed_out", "confirmation_required"].includes(tool.status))
      .map((tool) => ({ name: tool.name, status: tool.status })),
    modelClass: ["gemini_configured", "static_or_other"].includes(item.modelClass) ? item.modelClass : null,
    providerWindowDelta: Object.fromEntries(PROVIDER_KEYS.map((key) => [key, Number.isSafeInteger(item.providerWindowDelta?.[key]) ? item.providerWindowDelta[key] : null])),
    latencyMs: Number.isSafeInteger(item.latencyMs) && item.latencyMs >= 0 ? item.latencyMs : null,
    semanticPassed: item.semanticPassed === true,
    persisted: item.persisted === true,
  })),
  cleanup: state.cleanup && {
    verified: state.cleanup.verified === true,
    residue: Number.isSafeInteger(state.cleanup.residue) ? state.cleanup.residue : null,
    collections: Object.fromEntries(CLEANUP_COLLECTIONS.map((name) => [name,
      Number.isSafeInteger(state.cleanup.collections?.[name]) ? state.cleanup.collections[name] : null])),
  },
  ...(state.error ? { error: {
    code: SAFE_CODE.test(state.error.code || "") ? state.error.code : "STAGING_AI_RELIABILITY_FAILED",
  } } : {}),
});
