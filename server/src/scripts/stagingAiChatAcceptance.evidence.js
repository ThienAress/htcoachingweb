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

const CATALOG_GAPS = new Set([
  "exercise_displaced_fixture_present",
  "exercise_beginner_bodyweight_chest_insufficient",
  "food_reviewed_allergen_coverage_insufficient",
  "food_safe_macro_groups_incomplete",
  "food_fresh_price_coverage_insufficient",
  "food_fresh_price_macro_groups_incomplete",
  "catalog_readiness_payload_invalid",
]);
const CATALOG_COUNT_KEYS = [
  "exerciseCount",
  "displacedFixtures",
  "beginnerBodyweightChest",
  "foodCount",
  "safeMealFoods",
  "freshPricedSafeMealFoods",
];
const CATALOG_DIAGNOSTIC_COUNT_KEYS = [
  "ingredientVerifiedSafeMealFoods",
  "crossContactVerifiedSafeMealFoods",
];
const MACRO_GROUPS = new Set(["protein", "carb", "fat"]);
const CATALOG_METRIC_KEYS = new Set([
  ...CATALOG_COUNT_KEYS,
  ...CATALOG_DIAGNOSTIC_COUNT_KEYS,
  "safeMacroGroups",
  "freshPricedSafeMacroGroups",
]);
const safeCount = (value) => Number.isSafeInteger(value) && value >= 0
  ? value
  : null;
const safeMacroGroups = (value) => Array.isArray(value)
  ? [...new Set(value.filter((item) => MACRO_GROUPS.has(item)))].sort()
  : [];
const safeCatalogReadiness = (value) => {
  if (!value || typeof value !== "object") return null;
  const rawGaps = Array.isArray(value.gaps) ? value.gaps : [];
  const metrics = value.metrics && typeof value.metrics === "object" &&
    !Array.isArray(value.metrics)
    ? value.metrics
    : {};
  const counts = Object.fromEntries(
    CATALOG_COUNT_KEYS.map((key) => [key, safeCount(metrics[key])]),
  );
  const hasDiagnosticCounts = CATALOG_DIAGNOSTIC_COUNT_KEYS.some((key) =>
    Object.hasOwn(metrics, key));
  const diagnosticCounts = Object.fromEntries(
    CATALOG_DIAGNOSTIC_COUNT_KEYS.map((key) => [key, safeCount(metrics[key])]),
  );
  const invalidDiagnosticCounts = hasDiagnosticCounts && (
    CATALOG_DIAGNOSTIC_COUNT_KEYS.some((key) => !Object.hasOwn(metrics, key)) ||
    Object.values(diagnosticCounts).some((count) => count === null) ||
    diagnosticCounts.ingredientVerifiedSafeMealFoods !== counts.safeMealFoods ||
    diagnosticCounts.crossContactVerifiedSafeMealFoods >
      diagnosticCounts.ingredientVerifiedSafeMealFoods
  );
  const invalidMacroGroups = (groups) =>
    !Array.isArray(groups) ||
    new Set(groups).size !== groups.length ||
    groups.some((item) => !MACRO_GROUPS.has(item));
  const invalidPayload = !Array.isArray(value.gaps) ||
    rawGaps.some((gap) => !CATALOG_GAPS.has(gap)) ||
    !value.metrics || typeof value.metrics !== "object" ||
    Array.isArray(value.metrics) ||
    Object.keys(metrics).some((key) => !CATALOG_METRIC_KEYS.has(key)) ||
    Object.values(counts).some((count) => count === null) ||
    invalidDiagnosticCounts ||
    invalidMacroGroups(metrics.safeMacroGroups) ||
    invalidMacroGroups(metrics.freshPricedSafeMacroGroups);
  const gaps = [...new Set(rawGaps.filter((gap) => CATALOG_GAPS.has(gap)))];
  if (invalidPayload) gaps.push("catalog_readiness_payload_invalid");
  return {
    ready: value.ready === true && gaps.length === 0,
    gaps,
    metrics: {
      ...counts,
      safeMacroGroups: safeMacroGroups(metrics.safeMacroGroups),
      freshPricedSafeMacroGroups: safeMacroGroups(
        metrics.freshPricedSafeMacroGroups,
      ),
    },
  };
};

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
  schemaVersion: 3,
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
  catalogReadiness: safeCatalogReadiness(input.catalogReadiness),
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
