import { createHash } from "node:crypto";

export const REGISTERED_KB_FAILURE = Object.freeze({
  releaseSha: "88b5d3078ca6abadcead29e079bd6a677f1aae09",
  runId: "9c7c1ab5-f0a1-43fa-b1ea-d3aa73326dbc",
  sourceWorkflowRunId: 37758558812,
  jti: "2e4b64d0-bc8a-4bc8-8f31-91d5c7eb54ca",
  actorId: "6ac7661faf520cc224129e8f",
  capabilityRequestId: "09cd2948-8c7f-421c-841b-758b93990eb6",
  httpRequestId: "9d43dd56-557f-4eb1-98c0-426f77730cd0",
  serviceId: "srv-d9g8em61a83c73b4l61g",
  deployId: "dep-db3ma0favr4c73acli70",
  admittedAt: "2026-10-08T09:45:18.728Z",
  expiresAt: "2026-10-08T09:45:47.000Z",
  httpCompletedAt: "2026-10-08T09:45:34.031Z",
  providerCompletedAt: "2026-10-08T09:45:34.030Z",
});
const KEYS = [
  "schemaVersion", "kind", "proofMethod", "recoveryCodeSha", "operatorActor", "releaseSha", "runId",
  "sourceWorkflowRunId", "jti", "actorId", "capabilityRequestId", "httpRequestId", "serviceId", "deployId",
  "admittedAt", "expiresAt", "httpCompletedAt", "providerCompletedAt", "payloadDigest", "runtimeInstanceId",
  "httpStartedAt", "httpLogDigest", "providerLogDigest", "inventoryDigest", "verified",
];
const SHA = /^[a-f0-9]{40}$/u;
const DIGEST = /^[a-f0-9]{64}$/u;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u;
const fail = () => Object.assign(new Error("Completed KB failure proof is invalid or inconclusive"), {
  code: "STAGING_KB_FAILURE_PROOF_INVALID",
});
const assert = (condition) => { if (!condition) throw fail(); };
const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
};
export const kbFailureProofDigest = (value) => createHash("sha256")
  .update(JSON.stringify(canonical(value))).digest("hex");
const iso = (value) => {
  const date = new Date(value);
  assert(Number.isFinite(date.getTime()));
  return date.toISOString();
};

export const validateCompletedKbFailureProof = (value, intent) => {
  assert(value && typeof value === "object" && !Array.isArray(value));
  assert(Object.keys(value).length === KEYS.length && Object.keys(value).every((key) => KEYS.includes(key)));
  assert(value.schemaVersion === 1 && value.kind === "staging-kb-failure-recovery-proof" &&
    value.proofMethod === "operator_attested_render_completed_readonly_kb" && value.verified === true);
  assert(Object.entries(REGISTERED_KB_FAILURE).every(([key, expected]) => value[key] === expected));
  assert(value.releaseSha === intent?.releaseSha && value.runId === intent?.runId);
  assert(SHA.test(value.recoveryCodeSha || "") &&
    /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/u.test(value.operatorActor || ""));
  assert(UUID.test(value.runtimeInstanceId || "") && DIGEST.test(value.payloadDigest || ""));
  assert([value.httpLogDigest, value.providerLogDigest, value.inventoryDigest].every((item) => DIGEST.test(item)));
  const start = Date.parse(value.httpStartedAt);
  const admitted = Date.parse(value.admittedAt);
  const completed = Date.parse(value.httpCompletedAt);
  assert(Number.isFinite(start) && iso(value.httpStartedAt) === value.httpStartedAt &&
    start >= Date.parse(intent.createdAt) && start <= admitted && admitted < completed &&
    completed - start > 0 && completed - start <= 60_000);
  return Object.freeze({ ...value });
};

export const buildCompletedKbFailureProof = ({
  intent, receipt, sourceReport, sourceWorkflowRunId, recoveryCodeSha, operatorActor,
  serviceId, deployId, httpRequestId, logs,
}) => {
  const registered = REGISTERED_KB_FAILURE;
  assert(sourceWorkflowRunId === registered.sourceWorkflowRunId && serviceId === registered.serviceId &&
    deployId === registered.deployId && httpRequestId === registered.httpRequestId);
  assert(sourceReport?.status === "failed" && sourceReport.releaseSha === intent?.releaseSha &&
    sourceReport.runId === intent?.runId && Array.isArray(sourceReport.lanes) && sourceReport.lanes.length === 0 &&
    sourceReport.syntheticIds?.adminUserId === registered.actorId &&
    sourceReport.syntheticIds?.capabilityJtis?.length === 1 &&
    sourceReport.syntheticIds.capabilityJtis[0] === registered.jti);
  assert(receipt?._id === registered.jti && receipt.actorId === registered.actorId &&
    receipt.runId === intent.runId && receipt.releaseSha === intent.releaseSha &&
    receipt.requestId === registered.capabilityRequestId && receipt.recordType === "capability" &&
    receipt.receiptVersion === 2 && receipt.receiptState === "admitted" && receipt.status === "claimed" &&
    receipt.action === "kb_search" && receipt.purpose === "kb_search_root" && receipt.mode === "observe_only" &&
    receipt.conversationId === null && receipt.outcome == null);
  assert(logs?.hasMore === false && Array.isArray(logs.logs) && logs.logs.length > 0 && logs.logs.length < 100);
  const seen = new Set();
  const messages = logs.logs.map((log) => {
    assert(typeof log?.id === "string" && !seen.has(log.id) && typeof log.message === "string");
    seen.add(log.id);
    assert(Array.isArray(log.labels));
    const labels = new Map();
    for (const label of log.labels) {
      assert(typeof label?.name === "string" && typeof label.value === "string" && !labels.has(label.name));
      labels.set(label.name, label.value);
    }
    assert(labels.get("resource") === serviceId && labels.get("type") === "app");
    let message;
    try { message = JSON.parse(log.message); } catch { throw fail(); }
    assert(message && message.service === "htcoaching-api" && typeof message.event === "string");
    const completed = Date.parse(message.timestamp);
    assert(Number.isFinite(completed) && Math.abs(completed - Date.parse(log.timestamp)) <= 1_000 &&
      completed >= Date.parse(intent.createdAt) && completed <= Date.parse(sourceReport.completedAt));
    if (message.event === "http.request") {
      assert(typeof message.route === "string" && typeof message.method === "string" &&
        UUID.test(message.requestId || "") && Number.isFinite(message.durationMs) && message.durationMs >= 0);
    }
    return { log, message, completed };
  });
  const matches = messages.filter(({ message }) => message.event === "http.request" &&
    message.method === "GET" && message.route === "/api/knowledge-base/search" &&
    message.requestId === httpRequestId);
  assert(matches.length === 1);
  const http = matches[0];
  assert(http.message.status === 503 && http.message.durationMs <= 60_000);
  const admitted = Date.parse(iso(receipt.admittedAt));
  const start = http.completed - http.message.durationMs;
  assert(start <= admitted && admitted < http.completed);
  const overlaps = messages.filter(({ message, completed }) => message.event === "http.request" &&
    message.route === "/api/knowledge-base/search" &&
    completed - message.durationMs <= http.completed && completed >= start);
  assert(overlaps.length === 1);
  const provider = messages.filter(({ message }) => message.event === "ai.deepseek_request_completed" &&
    message.requestId === httpRequestId);
  assert(provider.length === 1 && provider[0].message.surface === "kb_selection" &&
    provider[0].message.success === false && provider[0].message.providerErrorCode === "DEEPSEEK_TIMEOUT" &&
    provider[0].completed >= admitted && provider[0].completed <= http.completed);
  return validateCompletedKbFailureProof({
    schemaVersion: 1, kind: "staging-kb-failure-recovery-proof",
    proofMethod: "operator_attested_render_completed_readonly_kb",
    ...registered, recoveryCodeSha, operatorActor,
    admittedAt: iso(receipt.admittedAt), expiresAt: iso(receipt.expiresAt),
    httpCompletedAt: iso(http.message.timestamp), providerCompletedAt: iso(provider[0].message.timestamp),
    payloadDigest: receipt.payloadDigest, runtimeInstanceId: receipt.runtimeInstanceId,
    httpStartedAt: new Date(start).toISOString(),
    httpLogDigest: kbFailureProofDigest({ id: http.log.id, message: http.log.message }),
    providerLogDigest: kbFailureProofDigest({ id: provider[0].log.id, message: provider[0].log.message }),
    inventoryDigest: kbFailureProofDigest(messages.map(({ log }) => log.id)), verified: true,
  }, intent);
};
