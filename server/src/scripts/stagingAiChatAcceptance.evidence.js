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

const safeLane = (lane) => ({
  name: String(lane?.name || "unknown").slice(0, 80),
  passed: lane?.passed === true,
  ...(lane?.injection ? { injection: String(lane.injection).slice(0, 120) } : {}),
  ...(lane?.observedTopology
    ? { observedTopology: String(lane.observedTopology).slice(0, 160) }
    : {}),
});

export const selectMetrics = (value = {}) =>
  Object.fromEntries(
    Object.entries(value).filter(
      ([key, count]) => ALLOWED_METRICS.has(key) && Number.isFinite(count),
    ),
  );

export const buildSafeEvidence = (input) => ({
  schemaVersion: 1,
  kind: "staging-ai-chat-acceptance",
  releaseSha: input.releaseSha,
  runId: input.runId,
  status: input.status === "passed" ? "passed" : "failed",
  startedAt: input.startedAt,
  completedAt: input.completedAt,
  syntheticIds: {
    userId: input.syntheticIds?.userId || null,
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
  cleanup: input.cleanup || null,
  ...(input.error ? { error: { code: safeErrorCode(input.error) } } : {}),
});

export const metricDelta = (before, after) => {
  if (
    typeof before?.runtimeInstanceId !== "string" ||
    !before.runtimeInstanceId ||
    after?.runtimeInstanceId !== before.runtimeInstanceId ||
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
