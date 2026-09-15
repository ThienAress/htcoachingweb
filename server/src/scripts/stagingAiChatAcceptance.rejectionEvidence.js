import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SHA = /^[a-f0-9]{40}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GITHUB_ACTOR = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
// V1 did not record request identity. This reviewed compatibility exception
// cannot certify another incident; broader recovery needs a new approval contract.
const AUDITED_LEGACY_INCIDENT = Object.freeze({
  releaseSha: "aa2d031d4420ba96d3e34e6fa87fba23e246755a",
  runId: "69095c11-7fc9-4047-9414-1b39a2d188e2",
  sourceWorkflowRunId: 34961418907,
  requestId: "1cba3e75-db0d-40dc-aa88-186ab6901fe9",
  serviceId: "srv-d9g8em61a83c73b4l61g",
  deployId: "dep-dakiao1594qs73e61jkg",
  observedAt: "2026-09-15T11:07:19.008Z",
});
const EVIDENCE_KEYS = [
  "schemaVersion", "kind", "proofMethod", "provider", "releaseSha", "recoveryCodeSha",
  "runId", "sourceWorkflowRunId", "operatorActor", "requestId", "event", "method", "route",
  "status", "observedAt", "providerServiceDigest", "providerDeployIdDigest",
  "providerLogIdDigest", "providerMessageDigest", "verified",
];
const isEntrypoint = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
const digest = (value) => createHash("sha256").update(String(value)).digest("hex");
const fail = (message) => Object.assign(new Error(message), {
  code: "STAGING_AI_FIXTURE_REJECTION_EVIDENCE_INVALID",
});
const exactKeys = (value, keys) => value && typeof value === "object" && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key));
const validTimestamp = (value) => typeof value === "string" && Number.isFinite(Date.parse(value));

export const validateFixtureRejectionEvidence = (value, intent) => {
  if (!exactKeys(value, EVIDENCE_KEYS) || value.schemaVersion !== 1 ||
      value.kind !== "staging-ai-fixture-rejection-evidence" ||
      value.proofMethod !== "operator_attested_render_application_log" || value.provider !== "render" ||
      value.releaseSha !== intent?.releaseSha || !SHA.test(value.recoveryCodeSha || "") ||
      value.runId !== intent?.runId || !Number.isSafeInteger(value.sourceWorkflowRunId) ||
      value.sourceWorkflowRunId < 1 || !GITHUB_ACTOR.test(value.operatorActor || "") ||
      !UUID.test(value.requestId || "") || value.event !== "http.request" || value.method !== "POST" ||
      value.route !== "/api/knowledge-base/" || value.status !== 400 || !validTimestamp(value.observedAt) ||
      [value.providerServiceDigest, value.providerDeployIdDigest, value.providerLogIdDigest,
        value.providerMessageDigest].some((item) => !/^[a-f0-9]{64}$/.test(item || "")) ||
      value.releaseSha !== AUDITED_LEGACY_INCIDENT.releaseSha ||
      value.runId !== AUDITED_LEGACY_INCIDENT.runId ||
      value.sourceWorkflowRunId !== AUDITED_LEGACY_INCIDENT.sourceWorkflowRunId ||
      value.requestId !== AUDITED_LEGACY_INCIDENT.requestId ||
      value.observedAt !== AUDITED_LEGACY_INCIDENT.observedAt ||
      value.providerServiceDigest !== digest(AUDITED_LEGACY_INCIDENT.serviceId) ||
      value.providerDeployIdDigest !== digest(AUDITED_LEGACY_INCIDENT.deployId) ||
      value.verified !== true) throw fail("Fixture rejection evidence does not match the closed AC-009 schema");
  return Object.freeze({ ...value });
};

const readJsonResponse = async (response, label) => {
  if (response?.status !== 200 || !String(response.headers?.get?.("content-type") || "")
    .toLowerCase().includes("application/json")) throw fail(`${label} response was not exact JSON 200`);
  try {
    return await response.json();
  } catch {
    throw fail(`${label} response was not valid JSON`);
  }
};

const requestRenderJson = async ({ fetchImpl, token, url, label }) => readJsonResponse(await fetchImpl(url, {
  method: "GET",
  headers: {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
    "User-Agent": "htcoaching-staging-ai-recovery/1.0",
  },
  signal: AbortSignal.timeout(30_000),
}), label);

const labelMap = (labels) => {
  if (!Array.isArray(labels)) throw fail("Render log labels are malformed");
  const result = new Map();
  for (const item of labels) {
    if (!item || typeof item.name !== "string" || typeof item.value !== "string" ||
        result.has(item.name)) throw fail("Render log labels are malformed or duplicated");
    result.set(item.name, item.value);
  }
  return result;
};

export const verifyRenderFixtureRejection = async ({
  fetchImpl = fetch,
  token,
  serviceId,
  intent,
  deployIdentity,
  requestId,
  recoveryCodeSha,
  sourceWorkflowRunId,
  operatorActor,
}) => {
  if (typeof fetchImpl !== "function" || String(token || "").length < 20 ||
      !/^srv-[a-z0-9]+$/.test(serviceId || "") || !SHA.test(intent?.releaseSha || "") ||
      !UUID.test(intent?.runId || "") || intent?.marker !== `htcoaching-acceptance:${intent.runId}` ||
      !validTimestamp(intent?.createdAt) || !UUID.test(requestId || "") || !SHA.test(recoveryCodeSha || "") ||
      !Number.isSafeInteger(sourceWorkflowRunId) || sourceWorkflowRunId < 1 ||
      !GITHUB_ACTOR.test(operatorActor || "")) throw fail("Fixture rejection verifier inputs are invalid");
  if (intent.releaseSha !== AUDITED_LEGACY_INCIDENT.releaseSha ||
      intent.runId !== AUDITED_LEGACY_INCIDENT.runId ||
      sourceWorkflowRunId !== AUDITED_LEGACY_INCIDENT.sourceWorkflowRunId ||
      requestId !== AUDITED_LEGACY_INCIDENT.requestId ||
      serviceId !== AUDITED_LEGACY_INCIDENT.serviceId ||
      deployIdentity?.server?.deployId !== AUDITED_LEGACY_INCIDENT.deployId) {
    throw fail("Recovery is not the one audited legacy incident");
  }
  if (deployIdentity?.schemaVersion !== 1 || deployIdentity.sha !== intent.releaseSha ||
      deployIdentity.server?.provider !== "render" || deployIdentity.server.sha !== intent.releaseSha ||
      deployIdentity.server.state !== "live" || !/^dep-[a-z0-9]+$/.test(deployIdentity.server.deployId || "")) {
    throw fail("Incident deploy identity does not match the recovery intent");
  }

  const service = await requestRenderJson({
    fetchImpl,
    token,
    url: `https://api.render.com/v1/services/${encodeURIComponent(serviceId)}`,
    label: "Render service",
  });
  if (service?.id !== serviceId || service.type !== "web_service" ||
      !/^tea-[a-z0-9]+$/.test(service.ownerId || "")) throw fail("Render service identity is invalid");

  const deploy = await requestRenderJson({
    fetchImpl, token,
    url: `https://api.render.com/v1/services/${encodeURIComponent(serviceId)}/deploys/${encodeURIComponent(deployIdentity.server.deployId)}`,
    label: "Render incident deploy",
  });
  // The historical deploy may be deactivated after the hotfix. This API binds
  // service/commit/chronology, not the full serving interval: operator attestation remains required.
  if (deploy?.id !== deployIdentity.server.deployId || deploy.commit?.id !== intent.releaseSha ||
      !validTimestamp(deploy.finishedAt) || Date.parse(deploy.finishedAt) > Date.parse(intent.createdAt)) {
    throw fail("Render incident deploy identity or chronology is invalid");
  }

  const startedAt = Date.parse(intent.createdAt);
  const endedAt = startedAt + 60_000;
  const query = new URLSearchParams({
    ownerId: service.ownerId,
    startTime: new Date(startedAt).toISOString(),
    endTime: new Date(endedAt).toISOString(),
    direction: "forward",
    resource: serviceId,
    type: "app",
    text: requestId,
    limit: "100",
  });
  const payload = await requestRenderJson({
    fetchImpl,
    token,
    url: `https://api.render.com/v1/logs?${query}`,
    label: "Render logs",
  });
  if (!payload || !Array.isArray(payload.logs) || payload.hasMore !== false) {
    throw fail("Render log result is incomplete or paginated");
  }
  const matches = payload.logs.map((log) => {
    if (!log || typeof log.id !== "string" || typeof log.message !== "string" ||
        !validTimestamp(log.timestamp)) throw fail("Render log record is malformed");
    const labels = labelMap(log.labels);
    if (labels.get("resource") !== serviceId || labels.get("type") !== "app") {
      throw fail("Render log resource or type is not exact");
    }
    let message;
    try {
      message = JSON.parse(log.message);
    } catch {
      throw fail("Render application log is not valid JSON");
    }
    const observedAt = Date.parse(message?.timestamp);
    if (message?.service !== "htcoaching-api" || message.event !== "http.request" || message.requestId !== requestId ||
        message.method !== "POST" || message.route !== "/api/knowledge-base/" ||
        message.status !== 400 || !Number.isFinite(message.durationMs) || message.durationMs < 0 ||
        message.durationMs > 60_000 || !Number.isFinite(observedAt) || observedAt < startedAt ||
        observedAt > endedAt || Math.abs(observedAt - Date.parse(log.timestamp)) > 1_000) {
      throw fail("Render log did not match the exact terminal rejection");
    }
    return { log, message };
  });
  if (matches.length !== 1) throw fail("Render logs did not contain exactly one matching terminal rejection");
  const [{ log, message }] = matches;
  return validateFixtureRejectionEvidence({
    schemaVersion: 1,
    kind: "staging-ai-fixture-rejection-evidence",
    proofMethod: "operator_attested_render_application_log",
    provider: "render",
    releaseSha: intent.releaseSha,
    recoveryCodeSha,
    runId: intent.runId,
    sourceWorkflowRunId,
    operatorActor,
    requestId,
    event: "http.request",
    method: "POST",
    route: "/api/knowledge-base/",
    status: 400,
    observedAt: new Date(message.timestamp).toISOString(),
    providerServiceDigest: digest(serviceId),
    providerDeployIdDigest: digest(deployIdentity.server.deployId),
    providerLogIdDigest: digest(log.id),
    providerMessageDigest: digest(log.message),
    verified: true,
  }, intent);
};

const readJsonFile = async (filename) => JSON.parse(await fs.readFile(path.resolve(filename), "utf8"));
const writeEvidence = async (filename, evidence) => {
  const target = path.resolve(filename);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx" });
};

export const runFixtureRejectionEvidenceCli = async ({ env = process.env } = {}) => {
  const intent = await readJsonFile(env.STAGING_AI_ACCEPTANCE_RECOVERY_INTENT);
  const deployIdentity = await readJsonFile(env.STAGING_DEPLOY_IDENTITY_EVIDENCE);
  if (env.RELEASE_SHA !== intent.releaseSha) throw fail("Workflow release SHA does not match the recovery intent");
  const evidence = await verifyRenderFixtureRejection({
    token: env.RENDER_API_KEY,
    serviceId: env.RENDER_STAGING_SERVICE_ID,
    intent,
    deployIdentity,
    requestId: env.STAGING_AI_FIXTURE_REJECTION_REQUEST_ID,
    recoveryCodeSha: env.GITHUB_SHA,
    sourceWorkflowRunId: Number(env.STAGING_AI_SOURCE_WORKFLOW_RUN_ID),
    operatorActor: env.GITHUB_ACTOR,
  });
  await writeEvidence(env.STAGING_AI_FIXTURE_REJECTION_EVIDENCE_OUTPUT, evidence);
  process.stdout.write("Verified one exact Render application rejection for legacy AC-009 recovery.\n");
  return evidence;
};

if (isEntrypoint) {
  runFixtureRejectionEvidenceCli().catch((error) => {
    process.stderr.write(`Staging AI fixture rejection verification failed (${error.code || "STAGING_AI_FIXTURE_REJECTION_EVIDENCE_INVALID"}).\n`);
    process.exitCode = 1;
  });
}
