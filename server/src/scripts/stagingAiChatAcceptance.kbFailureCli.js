import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { parseRecoveryIntent, validateRecoveryConfig } from "./stagingAiChatAcceptance.recover.js";
import { buildCompletedKbFailureProof, REGISTERED_KB_FAILURE } from "./stagingAiChatAcceptance.kbFailure.js";

const reject = () => Object.assign(new Error("KB failure evidence is inconclusive"), {
  code: "STAGING_KB_FAILURE_PROOF_INVALID",
});
const assert = (value) => { if (!value) throw reject(); };
const readJson = async (filename) => JSON.parse(await fs.readFile(path.resolve(filename), "utf8"));

export const readRenderKbFailureLogs = async ({ env, intent, sourceReport, deployIdentity, fetchImpl = fetch }) => {
  const incident = REGISTERED_KB_FAILURE;
  assert(env.RENDER_STAGING_SERVICE_ID === incident.serviceId &&
    env.STAGING_AI_KB_FAILURE_REQUEST_ID === incident.httpRequestId &&
    String(env.RENDER_API_KEY || "").length >= 20 && intent.runId === incident.runId &&
    deployIdentity?.sha === incident.releaseSha && deployIdentity?.server?.sha === incident.releaseSha &&
    deployIdentity.server.provider === "render" && deployIdentity.server.deployId === incident.deployId);
  const getJson = async (url) => {
    const response = await fetchImpl(url, {
      method: "GET", redirect: "error", signal: AbortSignal.timeout(30_000),
      headers: { Authorization: `Bearer ${env.RENDER_API_KEY}`, Accept: "application/json" },
    });
    assert(response.status === 200 && response.headers.get("content-type")?.includes("application/json"));
    return response.json();
  };
  const base = `https://api.render.com/v1/services/${incident.serviceId}`;
  const [service, deploy] = await Promise.all([
    getJson(base), getJson(`${base}/deploys/${incident.deployId}`),
  ]);
  assert(service.id === incident.serviceId && service.type === "web_service" &&
    service.branch === "staging" && /^tea-[a-z0-9]+$/.test(service.ownerId || "") &&
    deploy.id === incident.deployId && deploy.commit?.id === incident.releaseSha &&
    Number.isFinite(Date.parse(deploy.finishedAt)) && Date.parse(deploy.finishedAt) <= Date.parse(intent.createdAt));
  const query = new URLSearchParams({ ownerId: service.ownerId, resource: incident.serviceId,
    startTime: intent.createdAt, endTime: sourceReport.completedAt, type: "app", direction: "forward", limit: "100" });
  // Enumerate every HTTP completion in the window, without a request-ID filter.
  // Provider completion inventory is separate; unrelated console output is not completion evidence.
  const inventories = await Promise.all(["http.request", "ai.deepseek_request_completed"].map((event) => {
    const eventQuery = new URLSearchParams(query);
    eventQuery.set("text", event);
    return getJson(`https://api.render.com/v1/logs?${eventQuery}`);
  }));
  assert(inventories.every((rows) => rows?.hasMore === false && Array.isArray(rows.logs)));
  return { hasMore: false, logs: inventories.flatMap((rows) => rows.logs) };
};

export const runKbFailureProofCli = async ({ env = process.env } = {}) => {
  const intent = parseRecoveryIntent(await readJson(env.STAGING_AI_ACCEPTANCE_RECOVERY_INTENT));
  assert(validateRecoveryConfig(env, intent).valid);
  const sourceReport = await readJson(env.STAGING_AI_SOURCE_REPORT);
  const deployIdentity = await readJson(env.STAGING_DEPLOY_IDENTITY_EVIDENCE);
  const logs = await readRenderKbFailureLogs({ env, intent, sourceReport, deployIdentity });
  await mongoose.connect(env.MONGO_URI, { autoIndex: false });
  try {
    assert(mongoose.connection.db.databaseName === "htcoaching_staging");
    const receipt = await mongoose.connection.db.collection("staging_ai_acceptance_claims")
      .findOne({ _id: REGISTERED_KB_FAILURE.jti }, { projection: {
        _id: 1, actorId: 1, runId: 1, releaseSha: 1, requestId: 1, recordType: 1,
        receiptVersion: 1, receiptState: 1, status: 1, action: 1, purpose: 1, mode: 1,
        conversationId: 1, outcome: 1, payloadDigest: 1, runtimeInstanceId: 1, admittedAt: 1, expiresAt: 1,
      } });
    const proof = buildCompletedKbFailureProof({ intent, receipt, sourceReport, logs,
      sourceWorkflowRunId: Number(env.STAGING_AI_SOURCE_WORKFLOW_RUN_ID),
      recoveryCodeSha: env.GITHUB_SHA, operatorActor: env.GITHUB_ACTOR,
      serviceId: env.RENDER_STAGING_SERVICE_ID, deployId: deployIdentity.server.deployId,
      httpRequestId: env.STAGING_AI_KB_FAILURE_REQUEST_ID,
    });
    const target = path.resolve(env.STAGING_AI_KB_FAILURE_EVIDENCE_OUTPUT);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, `${JSON.stringify(proof, null, 2)}\n`, { flag: "wx" });
    process.stdout.write("Verified registered completed read-only KB failure; no database writes.\n");
    return proof;
  } finally {
    await mongoose.disconnect();
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runKbFailureProofCli().catch(() => {
    process.stderr.write("KB failure proof verification failed (STAGING_KB_FAILURE_PROOF_INVALID).\n");
    process.exitCode = 1;
  });
}
