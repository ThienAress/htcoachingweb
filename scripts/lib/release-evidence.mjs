const SHA_PATTERN = /^[0-9a-f]{40}$/;
const DEPLOY_ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{5,159}$/i;
const RUN_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/i;
const DIGEST_PATTERN = /^[0-9a-f]{64}$/;
const STAGING_AI_ASSERTIONS = Object.freeze([
  "exact staging identity",
  "live UI and Mongo provenance correspondence",
  "metrics snapshots conclusive without reset",
  "request cohort bound to one runtime",
  "reviewed published KB embedding",
]);
const STAGING_AI_LANES = Object.freeze([
  "live-kb-provider",
  "paced-conversation-isolation",
  "provider-failure-edit",
  "provider-failure-retry",
  "request-cohort-runtime-binding",
  "stop-recovery",
]);
const STAGING_AI_REQUEST_COHORT = Object.freeze({
  live_kb_provider: Object.freeze({ action: "ai_chat", mode: "observe_only", outcome: "completed" }),
  paced_conversation: Object.freeze({ action: "ai_chat", mode: "paced_response", outcome: "completed" }),
  stop: Object.freeze({ action: "ai_chat", mode: "paced_response", outcome: "aborted" }),
  provider_failure_retry: Object.freeze({ action: "ai_chat", mode: "provider_failure_before_llm", outcome: "failed" }),
  recovery_retry: Object.freeze({ action: "ai_chat", mode: "observe_only", outcome: "completed" }),
  provider_failure_edit: Object.freeze({ action: "ai_chat", mode: "provider_failure_before_llm", outcome: "failed" }),
  recovery_edit: Object.freeze({ action: "ai_chat", mode: "observe_only", outcome: "completed" }),
  kb_search_root: Object.freeze({ action: "kb_search", mode: "observe_only", outcome: "completed" }),
  kb_search_variant: Object.freeze({ action: "kb_search", mode: "observe_only", outcome: "completed" }),
});
const STAGING_AI_METRICS = Object.freeze([
  "kb.vector_combined_fallbacks",
  "kb.vector_fallbacks",
  "kb.vector_root_fallbacks",
  "kb.vector_variant_fallbacks",
  "provider.gemini_chat_failed",
]);
const STAGING_AI_CLEANUP_COLLECTIONS = Object.freeze([
  "aimemories",
  "aimemorypreferences",
  "aimoderationstates",
  "aitoolconfirmations",
  "chatconversations",
  "knowledgeQuestionDiscovery",
  "knowledgeentries",
  "serviceusagebuckets",
  "staging_ai_acceptance_claims",
  "users",
]);
const STAGING_AI_CATALOG_METRICS = Object.freeze([
  "beginnerBodyweightChest",
  "displacedFixtures",
  "exerciseCount",
  "foodCount",
  "freshPricedSafeMacroGroups",
  "freshPricedSafeMealFoods",
  "safeMacroGroups",
  "safeMealFoods",
]);
const REQUIRED_MACRO_GROUPS = Object.freeze(["carb", "fat", "protein"]);

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const plainObject = (value, name) => {
  assert(value && typeof value === "object" && !Array.isArray(value), `${name} must be an object`);
  return value;
};

const closedObject = (value, allowed, name) => {
  plainObject(value, name);
  for (const field of Object.keys(value)) {
    assert(allowed.includes(field), `${name} contains unsupported field: ${field}`);
  }
};

const canonicalTimestamp = (value, name) => {
  const date = new Date(value);
  assert(Number.isFinite(date.getTime()), `${name} must be an ISO timestamp`);
  assert(date.toISOString() === value, `${name} must use canonical ISO format`);
  return date;
};

const githubRunUrl = (value, name) => {
  const url = new URL(String(value || ""));
  assert(url.protocol === "https:", `${name} must use HTTPS`);
  assert(url.hostname === "github.com", `${name} must point to GitHub`);
  assert(
    /^\/ThienAress\/htcoachingweb\/actions\/runs\/\d+\/?$/.test(url.pathname),
    `${name} must point to this repository's Actions run`,
  );
};

const sha = (value, name) => {
  assert(SHA_PATTERN.test(String(value || "")), `${name} must be an exact 40-character Git SHA`);
};

const deploy = (value, name) => {
  assert(DEPLOY_ID_PATTERN.test(String(value || "")), `${name} is invalid`);
};

const validateDeployIdentity = (value, name) => {
  closedObject(value, ["deployId", "sha"], name);
  deploy(value.deployId, `${name}.deployId`);
  sha(value.sha, `${name}.sha`);
};

const validateCleanup = (cleanup, name) => {
  closedObject(cleanup, ["verified", "residue"], name);
  assert(typeof cleanup.verified === "boolean", `${name}.verified must be boolean`);
  assert(
    Number.isSafeInteger(cleanup.residue) && cleanup.residue >= 0,
    `${name}.residue is invalid`,
  );
};

const exactStringList = (value, expected, name) => {
  assert(Array.isArray(value), `${name} must be an array`);
  assert(
    value.every((item) => typeof item === "string") &&
      new Set(value).size === value.length &&
      [...value].sort().join("\n") === expected.join("\n"),
    `${name} does not contain the required values`,
  );
};

const validateCatalogReadiness = (value, name) => {
  closedObject(value, ["ready", "gaps", "metrics"], name);
  assert(value.ready === true, `${name} is not ready`);
  assert(
    Array.isArray(value.gaps) && value.gaps.length === 0,
    `${name}.gaps must be empty`,
  );
  closedObject(value.metrics, STAGING_AI_CATALOG_METRICS, `${name}.metrics`);
  exactStringList(
    Object.keys(value.metrics),
    STAGING_AI_CATALOG_METRICS,
    `${name}.metrics`,
  );
  for (const key of [
    "beginnerBodyweightChest",
    "displacedFixtures",
    "exerciseCount",
    "foodCount",
    "freshPricedSafeMealFoods",
    "safeMealFoods",
  ]) {
    assert(
      Number.isSafeInteger(value.metrics[key]) && value.metrics[key] >= 0,
      `${name}.metrics.${key} is invalid`,
    );
  }
  assert(value.metrics.displacedFixtures === 0,
    `${name} contains displaced exercise fixtures`);
  assert(value.metrics.beginnerBodyweightChest >= 5,
    `${name} has insufficient beginner bodyweight chest coverage`);
  assert(value.metrics.safeMealFoods >= 3,
    `${name} has insufficient safe meal coverage`);
  assert(value.metrics.freshPricedSafeMealFoods >= 3,
    `${name} has insufficient fresh price coverage`);
  assert(value.metrics.exerciseCount >= value.metrics.beginnerBodyweightChest,
    `${name}.metrics exercise counts are inconsistent`);
  assert(value.metrics.foodCount >= value.metrics.safeMealFoods,
    `${name}.metrics food counts are inconsistent`);
  exactStringList(
    value.metrics.safeMacroGroups,
    REQUIRED_MACRO_GROUPS,
    `${name}.metrics.safeMacroGroups`,
  );
  exactStringList(
    value.metrics.freshPricedSafeMacroGroups,
    REQUIRED_MACRO_GROUPS,
    `${name}.metrics.freshPricedSafeMacroGroups`,
  );
  return value;
};

const validateMetricsSnapshot = (value, name, { generatedAt, releaseSha, runtimeFingerprint }) => {
  closedObject(value, ["generatedAt", "releaseSha", "runtimeFingerprint", "counters"], name);
  assert(value.generatedAt === generatedAt, `${name}.generatedAt does not match runtime binding`);
  assert(value.releaseSha === releaseSha, `${name}.releaseSha does not match runtime binding`);
  assert(value.runtimeFingerprint === runtimeFingerprint,
    `${name}.runtimeFingerprint does not match runtime binding`);
  closedObject(value.counters, STAGING_AI_METRICS, `${name}.counters`);
  exactStringList(Object.keys(value.counters), STAGING_AI_METRICS, `${name}.counters`);
  for (const [metric, count] of Object.entries(value.counters)) {
    assert(Number.isSafeInteger(count) && count >= 0,
      `${name} metric ${metric} is invalid`);
  }
  return value.counters;
};

const validateMetricsSnapshots = (value, name, runtimeBinding) => {
  closedObject(value, ["before", "after"], name);
  const before = validateMetricsSnapshot(value.before, `${name}.before`, {
    generatedAt: runtimeBinding.metricsBeforeAt,
    releaseSha: runtimeBinding.releaseSha,
    runtimeFingerprint: runtimeBinding.runtimeFingerprint,
  });
  const after = validateMetricsSnapshot(value.after, `${name}.after`, {
    generatedAt: runtimeBinding.metricsAfterAt,
    releaseSha: runtimeBinding.releaseSha,
    runtimeFingerprint: runtimeBinding.runtimeFingerprint,
  });
  return Object.fromEntries(STAGING_AI_METRICS.map((metric) => {
    assert(after[metric] >= before[metric],
      `${name} metric ${metric} decreased`);
    return [metric, after[metric] - before[metric]];
  }));
};

const assertHealthyMetricsDelta = (delta, name) => {
  for (const [metric, count] of Object.entries(delta)) {
    if (metric.startsWith("kb.vector_")) {
      assert(count === 0, `${name} metric ${metric} used fallback`);
    }
  }
};

const passedEvidenceNames = (value, expected, name, allowedFields) => {
  assert(Array.isArray(value), `${name} must be an array`);
  const names = value.map((item, index) => {
    closedObject(item, allowedFields, `${name}[${index}]`);
    assert(item.passed === true, `${name}[${index}] did not pass`);
    assert(typeof item.name === "string", `${name}[${index}].name is invalid`);
    return item.name;
  });
  exactStringList(names, expected, name);
  return names.sort();
};

const validateRuntimeBinding = (value, {
  expectedSha,
  startedAt,
  completedAt,
  expectedJtis,
} = {}) => {
  closedObject(value, [
    "proof", "releaseSha", "runtimeFingerprint", "metricsBeforeAt",
    "metricsAfterAt", "attempts",
  ], "staging AI runtimeBinding");
  assert(value.proof === "request_cohort", "staging AI runtimeBinding proof is invalid");
  sha(value.releaseSha, "staging AI runtimeBinding releaseSha");
  if (expectedSha) {
    assert(value.releaseSha === expectedSha, "staging AI runtimeBinding SHA mismatch");
  }
  assert(DIGEST_PATTERN.test(String(value.runtimeFingerprint || "")),
    "staging AI runtimeBinding runtime fingerprint is invalid");
  const before = canonicalTimestamp(value.metricsBeforeAt,
    "staging AI runtimeBinding.metricsBeforeAt");
  const after = canonicalTimestamp(value.metricsAfterAt,
    "staging AI runtimeBinding.metricsAfterAt");
  assert(before <= after, "staging AI runtimeBinding metrics window is invalid");
  if (startedAt) {
    assert(before >= startedAt, "staging AI runtimeBinding starts before acceptance");
  }
  if (completedAt) {
    assert(after <= completedAt, "staging AI runtimeBinding ends after acceptance");
  }
  assert(Array.isArray(value.attempts) &&
    value.attempts.length === Object.keys(STAGING_AI_REQUEST_COHORT).length,
  "staging AI runtimeBinding attempts are incomplete");
  const purposes = [];
  const jtis = [];
  const requestIds = [];
  const attemptTimes = new Map();
  for (const [index, attempt] of value.attempts.entries()) {
    const name = `staging AI runtimeBinding.attempts[${index}]`;
    closedObject(attempt, [
      "purpose", "action", "mode", "outcome", "jti", "requestId",
      "releaseSha", "runtimeFingerprint", "admittedAt", "settledAt",
      "receiptState",
    ], name);
    const contract = STAGING_AI_REQUEST_COHORT[attempt.purpose];
    assert(contract, `${name}.purpose is invalid`);
    assert(attempt.action === contract.action && attempt.mode === contract.mode &&
      attempt.outcome === contract.outcome,
    `${name} purpose/action/mode/outcome contract is invalid`);
    assert(RUN_ID_PATTERN.test(String(attempt.jti || "")), `${name}.jti is invalid`);
    assert(RUN_ID_PATTERN.test(String(attempt.requestId || "")), `${name}.requestId is invalid`);
    assert(attempt.releaseSha === value.releaseSha, `${name}.releaseSha mismatch`);
    assert(attempt.runtimeFingerprint === value.runtimeFingerprint,
      `${name} runtime fingerprint mismatch`);
    assert(attempt.receiptState === "settled", `${name} receipt is not settled`);
    const admittedAt = canonicalTimestamp(attempt.admittedAt, `${name}.admittedAt`);
    const settledAt = canonicalTimestamp(attempt.settledAt, `${name}.settledAt`);
    assert(admittedAt >= before && settledAt >= admittedAt && settledAt <= after,
      `${name} timestamps fall outside the metrics window`);
    attemptTimes.set(attempt.purpose, { admittedAt, settledAt });
    purposes.push(attempt.purpose);
    jtis.push(attempt.jti);
    requestIds.push(attempt.requestId);
  }
  exactStringList(purposes, Object.keys(STAGING_AI_REQUEST_COHORT).sort(),
    "staging AI runtimeBinding purposes");
  assert(new Set(jtis).size === jtis.length,
    "staging AI runtimeBinding contains duplicate capability ids");
  assert(new Set(requestIds).size === requestIds.length,
    "staging AI runtimeBinding contains duplicate request ids");
  if (expectedJtis) {
    assert([...jtis].sort().join("\n") === [...expectedJtis].sort().join("\n"),
      "staging AI runtimeBinding capability inventory mismatch");
  }
  for (const [failurePurpose, recoveryPurpose] of [
    ["provider_failure_retry", "recovery_retry"],
    ["provider_failure_edit", "recovery_edit"],
  ]) {
    assert(
      attemptTimes.get(failurePurpose).settledAt <=
        attemptTimes.get(recoveryPurpose).admittedAt,
      `staging AI ${recoveryPurpose} recovery chronology starts before its failure settled`,
    );
  }
  return {
    proof: value.proof,
    releaseSha: value.releaseSha,
    runtimeFingerprint: value.runtimeFingerprint,
    metricsBeforeAt: value.metricsBeforeAt,
    metricsAfterAt: value.metricsAfterAt,
    attempts: [...value.attempts].sort((left, right) =>
      left.purpose.localeCompare(right.purpose)),
  };
};

export const validateStagingAiAcceptanceEvidence = (evidence, { expectedSha } = {}) => {
  closedObject(evidence, [
    "schemaVersion", "kind", "releaseSha", "runId", "status", "startedAt",
    "completedAt", "syntheticIds", "sourceUrl", "assertions", "lanes",
    "traceMetadata", "metricsDelta", "metricsSnapshots", "runtimeBinding",
    "catalogReadiness", "cleanup",
  ], "Staging AI acceptance evidence");
  assert(evidence.schemaVersion === 3, "Unsupported staging AI acceptance schemaVersion");
  assert(evidence.kind === "staging-ai-chat-acceptance", "Staging AI acceptance kind is invalid");
  sha(evidence.releaseSha, "staging AI acceptance releaseSha");
  if (expectedSha) {
    assert(evidence.releaseSha === expectedSha, "Staging AI acceptance SHA does not match expected SHA");
  }
  assert(evidence.status === "passed", "Staging AI acceptance did not pass");
  assert(RUN_ID_PATTERN.test(String(evidence.runId || "")), "Staging AI acceptance runId is invalid");
  const startedAt = canonicalTimestamp(evidence.startedAt, "staging AI acceptance startedAt");
  const completedAt = canonicalTimestamp(evidence.completedAt, "staging AI acceptance completedAt");
  assert(completedAt >= startedAt, "Staging AI acceptance timestamps are out of order");

  closedObject(
    evidence.syntheticIds,
    ["userId", "adminUserId", "kbEntryId", "capabilityJtis"],
    "staging AI acceptance syntheticIds",
  );
  assert(OBJECT_ID_PATTERN.test(evidence.syntheticIds.userId), "Synthetic user id is invalid");
  assert(OBJECT_ID_PATTERN.test(evidence.syntheticIds.adminUserId), "Synthetic admin user id is invalid");
  assert(OBJECT_ID_PATTERN.test(evidence.syntheticIds.kbEntryId), "Synthetic KB entry id is invalid");
  assert(
    Array.isArray(evidence.syntheticIds.capabilityJtis) &&
      evidence.syntheticIds.capabilityJtis.length === 9 &&
      new Set(evidence.syntheticIds.capabilityJtis).size === 9 &&
      evidence.syntheticIds.capabilityJtis.every((value) => RUN_ID_PATTERN.test(String(value))),
    "Synthetic capability ids are invalid",
  );
  assert(
    evidence.sourceUrl === "https://www.who.int/news-room/fact-sheets/detail/physical-activity",
    "Staging AI acceptance source is invalid",
  );
  const assertions = passedEvidenceNames(
    evidence.assertions,
    STAGING_AI_ASSERTIONS,
    "Staging AI acceptance assertions",
    ["name", "passed"],
  );
  const lanes = passedEvidenceNames(
    evidence.lanes,
    STAGING_AI_LANES,
    "Staging AI acceptance required lanes",
    ["name", "passed", "injection"],
  );

  const trace = evidence.traceMetadata;
  closedObject(trace, [
    "browser", "headless", "locale", "trace", "video", "screenshot", "har",
    "storageState", "responseMocking",
  ], "staging AI acceptance traceMetadata");
  assert(
    trace.browser === "chromium" && trace.headless === true && trace.locale === "vi-VN" &&
      ["trace", "video", "screenshot", "har", "storageState", "responseMocking"]
        .every((field) => trace[field] === false),
    "Staging AI acceptance browser evidence is unsafe or mocked",
  );

  const runtimeBinding = validateRuntimeBinding(evidence.runtimeBinding, {
    expectedSha: evidence.releaseSha,
    startedAt,
    completedAt,
    expectedJtis: evidence.syntheticIds.capabilityJtis,
  });
  validateCatalogReadiness(
    evidence.catalogReadiness,
    "staging AI acceptance catalogReadiness",
  );
  const recomputedMetricsDelta = validateMetricsSnapshots(evidence.metricsSnapshots,
    "staging AI acceptance metricsSnapshots", runtimeBinding);
  closedObject(evidence.metricsDelta, STAGING_AI_METRICS, "staging AI acceptance metricsDelta");
  exactStringList(Object.keys(evidence.metricsDelta), STAGING_AI_METRICS,
    "Staging AI acceptance metrics");
  for (const [name, value] of Object.entries(evidence.metricsDelta)) {
    assert(Number.isFinite(value) && value >= 0, `Staging AI acceptance metric ${name} is invalid`);
    assert(value === recomputedMetricsDelta[name],
      `Staging AI acceptance metric ${name} does not match snapshots`);
  }
  assertHealthyMetricsDelta(recomputedMetricsDelta, "Staging AI acceptance");

  closedObject(evidence.cleanup, ["verified", "residue", "collections"],
    "staging AI acceptance cleanup");
  assert(evidence.cleanup.verified === true && evidence.cleanup.residue === 0,
    "Staging AI acceptance cleanup is unverified");
  plainObject(evidence.cleanup.collections, "staging AI acceptance cleanup.collections");
  exactStringList(
    Object.keys(evidence.cleanup.collections),
    STAGING_AI_CLEANUP_COLLECTIONS,
    "Staging AI acceptance cleanup collections",
  );
  for (const [name, count] of Object.entries(evidence.cleanup.collections)) {
    assert(count === 0, `Staging AI acceptance cleanup left residue in ${name}`);
  }

  return {
    status: evidence.status,
    releaseSha: evidence.releaseSha,
    runId: evidence.runId,
    startedAt: evidence.startedAt,
    completedAt: evidence.completedAt,
    assertions,
    lanes,
    responseMocking: trace.responseMocking,
    metricsSnapshots: evidence.metricsSnapshots,
    runtimeBinding,
    cleanup: { verified: true, residue: 0 },
  };
};

const validateVerificationPoint = (point, name) => {
  closedObject(point, [
    "deployCheckedAt", "clientDeployId", "serverDeployId",
  ], name);
  canonicalTimestamp(point.deployCheckedAt, `${name}.deployCheckedAt`);
  deploy(point.clientDeployId, `${name}.clientDeployId`);
  deploy(point.serverDeployId, `${name}.serverDeployId`);
};

export const validateReleaseCandidate = (manifest) => {
  closedObject(manifest, ["schemaVersion", "kind", "release", "ci", "staging", "recovery", "rollback"], "Release candidate");
  assert(manifest.schemaVersion === 3, "Unsupported release candidate schemaVersion");
  assert(manifest.kind === "release-candidate", "Release candidate kind is invalid");

  closedObject(manifest.release, ["sha", "branch", "createdAt"], "release");
  sha(manifest.release.sha, "release.sha");
  assert(["staging", "main"].includes(manifest.release.branch), "release.branch is invalid");
  canonicalTimestamp(manifest.release.createdAt, "release.createdAt");

  closedObject(manifest.ci, ["status", "sha", "runUrl"], "ci");
  assert(["passed", "failed"].includes(manifest.ci.status), "ci.status is invalid");
  sha(manifest.ci.sha, "ci.sha");
  githubRunUrl(manifest.ci.runUrl, "ci.runUrl");

  closedObject(
    manifest.staging,
    ["client", "server", "acceptance", "aiAcceptance", "verificationWindow"],
    "staging",
  );
  validateDeployIdentity(manifest.staging.client, "staging.client");
  validateDeployIdentity(manifest.staging.server, "staging.server");
  const acceptance = manifest.staging.acceptance;
  closedObject(acceptance, ["status", "runId", "runUrl", "artifactName", "database", "cleanup"], "staging.acceptance");
  assert(["passed", "failed"].includes(acceptance.status), "staging.acceptance.status is invalid");
  assert(RUN_ID_PATTERN.test(String(acceptance.runId || "")), "staging.acceptance.runId is invalid");
  githubRunUrl(acceptance.runUrl, "staging.acceptance.runUrl");
  assert(DEPLOY_ID_PATTERN.test(String(acceptance.artifactName || "")), "staging.acceptance.artifactName is invalid");
  assert(acceptance.database === "htcoaching_staging", "staging acceptance database must be htcoaching_staging");
  validateCleanup(acceptance.cleanup, "staging.acceptance.cleanup");

  const aiAcceptance = manifest.staging.aiAcceptance;
  closedObject(aiAcceptance, [
    "status", "releaseSha", "runId", "runUrl", "artifactName", "startedAt",
    "completedAt", "assertions", "lanes", "responseMocking", "metricsSnapshots", "cleanup",
    "runtimeBinding",
  ], "staging.aiAcceptance");
  assert(["passed", "failed"].includes(aiAcceptance.status), "staging.aiAcceptance.status is invalid");
  sha(aiAcceptance.releaseSha, "staging.aiAcceptance.releaseSha");
  assert(RUN_ID_PATTERN.test(String(aiAcceptance.runId || "")), "staging.aiAcceptance.runId is invalid");
  githubRunUrl(aiAcceptance.runUrl, "staging.aiAcceptance.runUrl");
  assert(DEPLOY_ID_PATTERN.test(String(aiAcceptance.artifactName || "")),
    "staging.aiAcceptance.artifactName is invalid");
  const aiStartedAt = canonicalTimestamp(aiAcceptance.startedAt, "staging.aiAcceptance.startedAt");
  const aiCompletedAt = canonicalTimestamp(aiAcceptance.completedAt, "staging.aiAcceptance.completedAt");
  assert(aiCompletedAt >= aiStartedAt, "staging.aiAcceptance timestamps are out of order");
  exactStringList(aiAcceptance.assertions, STAGING_AI_ASSERTIONS, "staging.aiAcceptance.assertions");
  exactStringList(aiAcceptance.lanes, STAGING_AI_LANES, "staging.aiAcceptance.lanes");
  assert(typeof aiAcceptance.responseMocking === "boolean",
    "staging.aiAcceptance.responseMocking must be boolean");
  const runtimeBinding = validateRuntimeBinding(aiAcceptance.runtimeBinding, {
    expectedSha: aiAcceptance.releaseSha,
    startedAt: aiStartedAt,
    completedAt: aiCompletedAt,
  });
  const candidateMetricsDelta = validateMetricsSnapshots(aiAcceptance.metricsSnapshots,
    "staging.aiAcceptance.metricsSnapshots", runtimeBinding);
  assertHealthyMetricsDelta(candidateMetricsDelta, "staging.aiAcceptance");
  validateCleanup(aiAcceptance.cleanup, "staging.aiAcceptance.cleanup");

  closedObject(manifest.staging.verificationWindow, ["before", "after"],
    "staging.verificationWindow");
  validateVerificationPoint(manifest.staging.verificationWindow.before,
    "staging.verificationWindow.before");
  validateVerificationPoint(manifest.staging.verificationWindow.after,
    "staging.verificationWindow.after");

  closedObject(manifest.recovery, ["backupId", "releaseReady", "disasterRecoveryReady", "continuousRecoveryAvailable", "evidence"], "recovery");
  assert(/^production-[a-z0-9-]{8,100}$/i.test(manifest.recovery.backupId), "recovery.backupId is invalid");
  for (const field of ["releaseReady", "disasterRecoveryReady", "continuousRecoveryAvailable"]) {
    assert(typeof manifest.recovery[field] === "boolean", `recovery.${field} must be boolean`);
  }
  assert(/^docs\/operations\/production\/[a-z0-9./-]+\.md$/i.test(manifest.recovery.evidence), "recovery.evidence is invalid");

  closedObject(manifest.rollback, ["clientDeployId", "serverDeployId"], "rollback");
  deploy(manifest.rollback.clientDeployId, "rollback.clientDeployId");
  deploy(manifest.rollback.serverDeployId, "rollback.serverDeployId");
  return manifest;
};

export const evaluateReleaseCandidate = (manifest) => {
  validateReleaseCandidate(manifest);
  const expectedSha = manifest.release.sha;
  const blockers = [];
  if (manifest.ci.status !== "passed") blockers.push("CI_NOT_PASSED");
  if (manifest.ci.sha !== expectedSha) blockers.push("CI_SHA_MISMATCH");
  if (manifest.staging.client.sha !== expectedSha) blockers.push("STAGING_CLIENT_SHA_MISMATCH");
  if (manifest.staging.server.sha !== expectedSha) blockers.push("STAGING_SERVER_SHA_MISMATCH");
  if (manifest.staging.acceptance.status !== "passed") blockers.push("STAGING_ACCEPTANCE_NOT_PASSED");
  if (!manifest.staging.acceptance.cleanup.verified || manifest.staging.acceptance.cleanup.residue !== 0) {
    blockers.push("STAGING_CLEANUP_UNVERIFIED");
  }
  const ai = manifest.staging.aiAcceptance;
  if (ai.status !== "passed") blockers.push("STAGING_AI_ACCEPTANCE_NOT_PASSED");
  if (ai.releaseSha !== expectedSha) blockers.push("STAGING_AI_SHA_MISMATCH");
  if (!ai.cleanup.verified || ai.cleanup.residue !== 0) {
    blockers.push("STAGING_AI_CLEANUP_UNVERIFIED");
  }
  if (ai.responseMocking) blockers.push("STAGING_AI_RESPONSE_MOCKED");
  if (ai.runUrl !== manifest.staging.acceptance.runUrl ||
      ai.artifactName !== manifest.staging.acceptance.artifactName) {
    blockers.push("STAGING_ACCEPTANCE_RUN_MISMATCH");
  }
  const before = manifest.staging.verificationWindow.before;
  const after = manifest.staging.verificationWindow.after;
  if (before.clientDeployId !== manifest.staging.client.deployId) {
    blockers.push("STAGING_PRE_AI_CLIENT_DEPLOY_MISMATCH");
  }
  if (before.serverDeployId !== manifest.staging.server.deployId) {
    blockers.push("STAGING_PRE_AI_SERVER_DEPLOY_MISMATCH");
  }
  if (after.clientDeployId !== manifest.staging.client.deployId) {
    blockers.push("STAGING_POST_AI_CLIENT_DEPLOY_MISMATCH");
  }
  if (after.serverDeployId !== manifest.staging.server.deployId) {
    blockers.push("STAGING_POST_AI_SERVER_DEPLOY_MISMATCH");
  }
  const aiStartedAt = new Date(ai.startedAt);
  const aiCompletedAt = new Date(ai.completedAt);
  if (
    new Date(before.deployCheckedAt) > aiStartedAt ||
    new Date(after.deployCheckedAt) < aiCompletedAt
  ) {
    blockers.push("STAGING_AI_VERIFICATION_WINDOW_INVALID");
  }
  if (!manifest.recovery.releaseReady) blockers.push("RECOVERY_RELEASE_NOT_READY");
  if (!manifest.recovery.disasterRecoveryReady) blockers.push("OFF_DEVICE_RECOVERY_NOT_READY");
  return {
    ready: blockers.length === 0,
    sha: expectedSha,
    backupId: manifest.recovery.backupId,
    blockers,
    warnings: manifest.recovery.continuousRecoveryAvailable
      ? []
      : ["CONTINUOUS_RECOVERY_UNAVAILABLE"],
  };
};

export const validatePostDeployEvidence = (evidence) => {
  closedObject(evidence, ["schemaVersion", "kind", "candidateSha", "production", "observation"], "Production observation");
  assert(evidence.schemaVersion === 1, "Unsupported production observation schemaVersion");
  assert(evidence.kind === "production-observation", "Production observation kind is invalid");
  sha(evidence.candidateSha, "candidateSha");
  closedObject(evidence.production, ["client", "server"], "production");
  validateDeployIdentity(evidence.production.client, "production.client");
  validateDeployIdentity(evidence.production.server, "production.server");
  closedObject(evidence.observation, ["startedAt", "endedAt", "monitorRunUrl", "status", "decision"], "observation");
  canonicalTimestamp(evidence.observation.startedAt, "observation.startedAt");
  canonicalTimestamp(evidence.observation.endedAt, "observation.endedAt");
  githubRunUrl(evidence.observation.monitorRunUrl, "observation.monitorRunUrl");
  assert(["passed", "failed"].includes(evidence.observation.status), "observation.status is invalid");
  assert(["keep", "rollback"].includes(evidence.observation.decision), "observation.decision is invalid");
  return evidence;
};

export const evaluatePostDeployEvidence = (evidence, candidate) => {
  validatePostDeployEvidence(evidence);
  validateReleaseCandidate(candidate);
  const blockers = [];
  const expectedSha = candidate.release.sha;
  if (evidence.candidateSha !== expectedSha) blockers.push("CANDIDATE_SHA_MISMATCH");
  if (evidence.production.client.sha !== expectedSha) blockers.push("PRODUCTION_CLIENT_SHA_MISMATCH");
  if (evidence.production.server.sha !== expectedSha) blockers.push("PRODUCTION_SERVER_SHA_MISMATCH");
  const startedAt = new Date(evidence.observation.startedAt);
  const endedAt = new Date(evidence.observation.endedAt);
  const observationMinutes = Number(((endedAt - startedAt) / 60_000).toFixed(2));
  if (observationMinutes < 30) blockers.push("OBSERVATION_WINDOW_TOO_SHORT");
  if (evidence.observation.status !== "passed") blockers.push("PRODUCTION_MONITOR_NOT_PASSED");
  if (evidence.observation.decision !== "keep") blockers.push("RELEASE_NOT_KEPT");
  return { ready: blockers.length === 0, sha: expectedSha, observationMinutes, blockers };
};
