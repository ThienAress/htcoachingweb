const ALLOWED_METRICS = new Set([
  "kb.vector_fallbacks",
  "kb.vector_root_fallbacks",
  "kb.vector_variant_fallbacks",
  "kb.vector_combined_fallbacks",
  "provider.gemini_chat_failed",
]);

const safeErrorCode = (error) =>
  /^[A-Z0-9_]{1,100}$/.test(String(error?.code || ""))
    ? String(error.code)
    : "STAGING_AI_ACCEPTANCE_FAILED";

const safeEvidenceError = (error) => {
  const code = safeErrorCode(error);
  const operationError = code === "STAGING_ACCEPTANCE_CLEANUP_FAILED" &&
    Array.isArray(error?.errors)
    ? error.errors[0]
    : null;
  const operationCode = operationError ? safeErrorCode(operationError) : null;
  return {
    code,
    ...(operationCode && operationCode !== "STAGING_AI_ACCEPTANCE_FAILED"
      ? { operationCode }
      : {}),
  };
};

const safeLane = (lane) => ({
  name: String(lane?.name || "unknown").slice(0, 80),
  passed: lane?.passed === true,
  ...(lane?.injection ? { injection: String(lane.injection).slice(0, 120) } : {}),
});

const ISO = (value) => typeof value === "string" && Number.isFinite(new Date(value).getTime())
  ? new Date(value).toISOString()
  : null;
const HEX_64 = /^[a-f0-9]{64}$/;
const SHA = /^[a-f0-9]{40}$/;
const ATTEMPT_KEYS = ["purpose", "action", "mode", "outcome", "jti", "requestId", "releaseSha", "runtimeFingerprint", "admittedAt", "settledAt", "receiptState"];
const safeAttempt = (item = {}) => {
  const result = Object.fromEntries(ATTEMPT_KEYS.map((key) => [key, item[key] ?? null]));
  result.admittedAt = ISO(result.admittedAt);
  result.settledAt = ISO(result.settledAt);
  return result;
};
const safeRuntimeBinding = (binding) => binding && typeof binding === "object" ? {
  proof: binding.proof === "request_cohort" ? binding.proof : "invalid",
  releaseSha: SHA.test(binding.releaseSha || "") ? binding.releaseSha : null,
  runtimeFingerprint: HEX_64.test(binding.runtimeFingerprint || "") ? binding.runtimeFingerprint : null,
  metricsBeforeAt: ISO(binding.metricsBeforeAt),
  metricsAfterAt: ISO(binding.metricsAfterAt),
  attempts: Array.isArray(binding.attempts) ? binding.attempts.map(safeAttempt) : [],
} : null;

export const selectMetrics = (value = {}) =>
  Object.fromEntries(
    Object.entries(value).filter(
      ([key, count]) => ALLOWED_METRICS.has(key) && Number.isFinite(count),
    ),
  );

const safeMetricsSnapshot = (value = {}) => ({
  generatedAt: ISO(value.generatedAt),
  releaseSha: SHA.test(value.releaseSha || "") ? value.releaseSha : null,
  runtimeFingerprint: HEX_64.test(value.runtimeFingerprint || "")
    ? value.runtimeFingerprint
    : null,
  counters: selectMetrics(value.counters),
});

const safeMetricsSnapshots = (value) => ({
  before: safeMetricsSnapshot(value?.before),
  after: safeMetricsSnapshot(value?.after),
});

export const buildSafeEvidence = (input) => ({
  schemaVersion: 2,
  kind: "staging-ai-chat-acceptance",
  releaseSha: input.releaseSha,
  runId: input.runId,
  status: input.status === "passed" ? "passed" : "failed",
  startedAt: input.startedAt,
  completedAt: input.completedAt,
  syntheticIds: {
    userId: input.syntheticIds?.userId || null,
    adminUserId: input.syntheticIds?.adminUserId || null,
    kbEntryId: input.syntheticIds?.kbEntryId || null,
    capabilityJtis: [...(input.syntheticIds?.capabilityJtis || [])],
  },
  sourceUrl: input.sourceUrl,
  assertions: (input.assertions || []).map((item) => ({
    name: String(item?.name || "unknown").slice(0, 100),
    passed: item?.passed === true,
  })),
  lanes: (input.lanes || []).map(safeLane),
  traceMetadata: {
    browser: "chromium",
    headless: true,
    locale: "vi-VN",
    trace: false,
    video: false,
    screenshot: false,
    har: false,
    storageState: false,
    responseMocking: false,
  },
  metricsDelta: selectMetrics(input.metricsDelta),
  metricsSnapshots: safeMetricsSnapshots(input.metricsSnapshots),
  runtimeBinding: safeRuntimeBinding(input.runtimeBinding),
  cleanup: input.cleanup || null,
  ...(input.error ? { error: safeEvidenceError(input.error) } : {}),
});

export const metricDelta = (before, after) => {
  if (
    typeof before?.runtimeInstanceId !== "string" ||
    !before.runtimeInstanceId ||
    typeof before?.runtimeReleaseSha !== "string" ||
    !SHA.test(before.runtimeReleaseSha) ||
    after?.runtimeInstanceId !== before.runtimeInstanceId ||
    after?.runtimeReleaseSha !== before.runtimeReleaseSha ||
    !Number.isFinite(before?.uptimeSeconds) ||
    !Number.isFinite(after?.uptimeSeconds) ||
    after.uptimeSeconds < before.uptimeSeconds
  ) {
    const error = new Error("Metrics snapshots do not prove a stable runtime instance");
    error.code = "STAGING_AI_METRICS_INCONCLUSIVE";
    throw error;
  }
  const result = {};
  for (const key of ALLOWED_METRICS) {
    const first = before?.counters?.[key];
    const last = after?.counters?.[key];
    if (!Number.isFinite(first) || !Number.isFinite(last) || last < first) {
      const error = new Error(`Metrics snapshot is inconclusive for ${key}`);
      error.code = "STAGING_AI_METRICS_INCONCLUSIVE";
      throw error;
    }
    result[key] = last - first;
  }
  return result;
};

export const assertHealthyVectorTopology = (delta) => {
  for (const key of [
    "kb.vector_fallbacks",
    "kb.vector_root_fallbacks",
    "kb.vector_variant_fallbacks",
    "kb.vector_combined_fallbacks",
  ]) {
    if (delta?.[key] !== 0) {
      const error = new Error(`Healthy staging vector topology used ${key}`);
      error.code = "STAGING_AI_VECTOR_TOPOLOGY_BLOCKED";
      throw error;
    }
  }
};
