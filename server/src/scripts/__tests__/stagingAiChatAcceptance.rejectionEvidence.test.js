import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import {
  verifyRenderFixtureRejection,
} from "../stagingAiChatAcceptance.rejectionEvidence.js";

const SHA = "aa2d031d4420ba96d3e34e6fa87fba23e246755a";
const CODE_SHA = "b".repeat(40);
const RUN_ID = "69095c11-7fc9-4047-9414-1b39a2d188e2";
const REQUEST_ID = "1cba3e75-db0d-40dc-aa88-186ab6901fe9";
const SERVICE_ID = "srv-d9g8em61a83c73b4l61g";
const DEPLOY_ID = "dep-dakiao1594qs73e61jkg";
const intent = {
  schemaVersion: 1,
  kind: "staging-ai-chat-recovery-intent",
  releaseSha: SHA,
  runId: RUN_ID,
  marker: `htcoaching-acceptance:${RUN_ID}`,
  createdAt: "2026-09-15T11:07:14.376Z",
};
const deployIdentity = {
  schemaVersion: 1,
  checkedAt: "2026-09-15T11:06:06.289Z",
  sha: SHA,
  client: { provider: "netlify", deployId: "client", sha: SHA, state: "ready" },
  server: { provider: "render", deployId: DEPLOY_ID, sha: SHA, state: "live" },
};
const logMessage = JSON.stringify({
  timestamp: "2026-09-15T11:07:19.008Z",
  level: "info",
  service: "htcoaching-api",
  event: "http.request",
  requestId: REQUEST_ID,
  traceId: "6984831b057a5acbc7262ea91db652d7",
  method: "POST",
  route: "/api/knowledge-base/",
  status: 400,
  durationMs: 1009.28,
});
const response = (payload) => ({
  status: 200,
  headers: { get: (name) => name.toLowerCase() === "content-type" ? "application/json" : null },
  json: async () => payload,
});
const deploy = (overrides = {}) => ({ id: DEPLOY_ID, commit: { id: SHA },
  finishedAt: "2026-09-15T11:05:00.000Z", status: "deactivated", ...overrides });
const log = (overrides = {}) => ({ id: "log-exact", message: logMessage,
  timestamp: "2026-09-15T11:07:19.008Z",
  labels: [{ name: "resource", value: SERVICE_ID }, { name: "type", value: "app" }], ...overrides });
const options = (fetchImpl, overrides = {}) => ({ fetchImpl,
  token: "synthetic.render.test-only-sufficient-length", serviceId: SERVICE_ID,
  intent, deployIdentity, requestId: REQUEST_ID, recoveryCodeSha: CODE_SHA,
  sourceWorkflowRunId: 34961418907, operatorActor: "ThienAress", ...overrides });
const providerFetch = ({ incidentDeploy = deploy(), logs = [log()], hasMore = false } = {}) => vi.fn(async (url) => {
  if (url.includes(`/deploys/${DEPLOY_ID}`)) return response(incidentDeploy);
  if (url.includes("/v1/logs?")) return response({ logs, hasMore });
  return response({ id: SERVICE_ID, ownerId: "tea-owner", type: "web_service" });
});

describe("AC-009 Render fixture rejection evidence", () => {
  it("binds one exact application finish log to the incident intent and deploy", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(response({ id: SERVICE_ID, ownerId: "tea-owner", type: "web_service" }))
      .mockResolvedValueOnce(response(deploy()))
      .mockResolvedValueOnce(response({
        hasMore: false,
        nextStartTime: "2026-09-15T11:07:20.000Z",
        nextEndTime: "2026-09-15T11:08:14.376Z",
        logs: [{
          id: "log-exact",
          message: logMessage,
          timestamp: "2026-09-15T11:07:19.008Z",
          labels: [
            { name: "resource", value: SERVICE_ID },
            { name: "type", value: "app" },
          ],
        }],
      }));
    const evidence = await verifyRenderFixtureRejection({
      fetchImpl,
      token: "synthetic.render.test-only-sufficient-length",
      serviceId: SERVICE_ID,
      intent,
      deployIdentity,
      requestId: REQUEST_ID,
      recoveryCodeSha: CODE_SHA,
      sourceWorkflowRunId: 34961418907,
      operatorActor: "ThienAress",
    });
    expect(evidence).toEqual({
      schemaVersion: 1,
      kind: "staging-ai-fixture-rejection-evidence",
      proofMethod: "operator_attested_render_application_log",
      provider: "render",
      releaseSha: SHA,
      recoveryCodeSha: CODE_SHA,
      runId: RUN_ID,
      sourceWorkflowRunId: 34961418907,
      operatorActor: "ThienAress",
      requestId: REQUEST_ID,
      event: "http.request",
      method: "POST",
      route: "/api/knowledge-base/",
      status: 400,
      observedAt: "2026-09-15T11:07:19.008Z",
      providerServiceDigest: createHash("sha256").update(SERVICE_ID).digest("hex"),
      providerDeployIdDigest: createHash("sha256").update(DEPLOY_ID).digest("hex"),
      providerLogIdDigest: createHash("sha256").update("log-exact").digest("hex"),
      providerMessageDigest: createHash("sha256").update(logMessage).digest("hex"),
      verified: true,
    });
    expect(fetchImpl.mock.calls[1][0]).toContain(`/services/${SERVICE_ID}/deploys/${DEPLOY_ID}`);
    expect(fetchImpl.mock.calls[2][0]).toContain(`text=${REQUEST_ID}`);
  });

  it.each([
    ["wrong status", { status: 409 }],
    ["wrong method", { method: "GET" }],
    ["wrong route", { route: "/api/knowledge-base/search" }],
    ["wrong request", { requestId: "650e8400-e29b-41d4-a716-446655440000" }],
  ])("rejects %s without emitting evidence", async (_name, override) => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(response({ id: SERVICE_ID, ownerId: "tea-owner", type: "web_service" }))
      .mockResolvedValueOnce(response(deploy()))
      .mockResolvedValueOnce(response({
        hasMore: false,
        logs: [{ id: "log-mismatch", message: JSON.stringify({ ...JSON.parse(logMessage), ...override }),
          timestamp: "2026-09-15T11:07:19.008Z", labels: [{ name: "resource", value: SERVICE_ID }, { name: "type", value: "app" }] }],
      }));
    await expect(verifyRenderFixtureRejection({
      fetchImpl,
      token: "synthetic.render.test-only-sufficient-length",
      serviceId: SERVICE_ID,
      intent,
      deployIdentity,
      requestId: REQUEST_ID,
      recoveryCodeSha: CODE_SHA,
      sourceWorkflowRunId: 34961418907,
      operatorActor: "ThienAress",
    })).rejects.toMatchObject({ code: "STAGING_AI_FIXTURE_REJECTION_EVIDENCE_INVALID" });
  });

  it.each([
    ["different deploy ID", { id: "dep-wrong" }],
    ["different incident SHA", { commit: { id: "a".repeat(40) } }],
    ["deployment completed after intent", { finishedAt: "2026-09-15T11:07:15.000Z" }],
    ["missing completion time", { finishedAt: null }],
  ])("rejects %s from the exact deploy API", async (_name, override) => {
    await expect(verifyRenderFixtureRejection(options(providerFetch({ incidentDeploy: deploy(override) }))))
      .rejects.toMatchObject({ code: "STAGING_AI_FIXTURE_REJECTION_EVIDENCE_INVALID" });
  });

  it.each([
    ["duplicate resource label", [log({ labels: [...log().labels, { name: "resource", value: SERVICE_ID }] })]],
    ["conflicting type label", [log({ labels: [...log().labels, { name: "type", value: "request" }] })]],
    ["malformed labels beside a valid log", [log(), log({ labels: [null] })]],
    ["malformed JSON beside a valid log", [log(), log({ message: `${REQUEST_ID} broken JSON` })]],
    ["nonterminal record beside a valid log", [log(), log({ message: JSON.stringify({ ...JSON.parse(logMessage), status: 500 }) })]],
    ["two exact terminal logs", [log(), log({ id: "log-second" })]],
    ["wrong application service", [log({ message: JSON.stringify({ ...JSON.parse(logMessage), service: "other-app" }) })]],
  ])("fails closed for %s", async (_name, logs) => {
    await expect(verifyRenderFixtureRejection(options(providerFetch({ logs }))))
      .rejects.toMatchObject({ code: "STAGING_AI_FIXTURE_REJECTION_EVIDENCE_INVALID" });
  });

  it("rejects an incomplete paginated log result", async () => {
    await expect(verifyRenderFixtureRejection(options(providerFetch({ hasMore: true }))))
      .rejects.toMatchObject({ code: "STAGING_AI_FIXTURE_REJECTION_EVIDENCE_INVALID" });
  });

  it.each([
    { sourceWorkflowRunId: 34961418908 },
    { requestId: "650e8400-e29b-41d4-a716-446655440000" },
    { intent: { ...intent, releaseSha: "a".repeat(40) }, deployIdentity: { ...deployIdentity, sha: "a".repeat(40), server: { ...deployIdentity.server, sha: "a".repeat(40) } } },
  ])("refuses to generalize the one audited legacy incident", async (override) => {
    const fetchImpl = providerFetch();
    await expect(verifyRenderFixtureRejection(options(fetchImpl, override)))
      .rejects.toMatchObject({ code: "STAGING_AI_FIXTURE_REJECTION_EVIDENCE_INVALID" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("does not expose provider JSON parse canaries", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ status: 200,
      headers: { get: () => "application/json" }, json: async () => { throw new Error("must-not-leak"); } });
    await expect(verifyRenderFixtureRejection(options(fetchImpl)))
      .rejects.toMatchObject({ code: "STAGING_AI_FIXTURE_REJECTION_EVIDENCE_INVALID", message: "Render service response was not valid JSON" });
  });
});
