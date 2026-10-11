const incident = {
  releaseSha: "88b5d3078ca6abadcead29e079bd6a677f1aae09",
  runId: "9c7c1ab5-f0a1-43fa-b1ea-d3aa73326dbc",
  sourceWorkflowRunId: 37758558812,
  jti: "2e4b64d0-bc8a-4bc8-8f31-91d5c7eb54ca",
  actorId: "6ac7661faf520cc224129e8f",
  capabilityRequestId: "09cd2948-8c7f-421c-841b-758b93990eb6",
  httpRequestId: "9d43dd56-557f-4eb1-98c0-426f77730cd0",
  serviceId: "srv-d9g8em61a83c73b4l61g",
  deployId: "dep-db3ma0favr4c73acli70",
};
export const proofInputs = () => {
  const receipt = {
    _id: incident.jti, actorId: incident.actorId, runId: incident.runId,
    releaseSha: incident.releaseSha, requestId: incident.capabilityRequestId,
    recordType: "capability", receiptVersion: 2, receiptState: "admitted", status: "claimed",
    action: "kb_search", purpose: "kb_search_root", mode: "observe_only", conversationId: null,
    payloadDigest: "b".repeat(64), runtimeInstanceId: "58f40b72-41ae-4a4b-a3e2-643fa5fc5a26",
    admittedAt: new Date("2026-10-08T09:45:18.728Z"), expiresAt: new Date("2026-10-08T09:45:47.000Z"),
  };
  const makeLog = (id, message) => ({ id, timestamp: message.timestamp, message: JSON.stringify(message),
    labels: [{ name: "resource", value: incident.serviceId }, { name: "type", value: "app" }] });
  const logs = {
    hasMore: false,
    logs: [
      makeLog("http-log", { event: "http.request", service: "htcoaching-api",
        requestId: incident.httpRequestId, timestamp: "2026-10-08T09:45:34.031Z",
        method: "GET", route: "/api/knowledge-base/search", status: 503, durationMs: 15754.95 }),
      makeLog("provider-log", { event: "ai.deepseek_request_completed", service: "htcoaching-api",
        requestId: incident.httpRequestId, timestamp: "2026-10-08T09:45:34.030Z",
        surface: "kb_selection", success: false, providerErrorCode: "DEEPSEEK_TIMEOUT" }),
    ],
  };
  return {
    intent: { releaseSha: incident.releaseSha, runId: incident.runId, createdAt: "2026-10-08T09:44:58.159Z" },
    sourceWorkflowRunId: incident.sourceWorkflowRunId, receipt, logs,
    recoveryCodeSha: "c".repeat(40), operatorActor: "ThienAress",
    sourceReport: { status: "failed", releaseSha: incident.releaseSha, runId: incident.runId,
      completedAt: "2026-10-08T09:47:12.452Z", lanes: [],
      syntheticIds: { adminUserId: incident.actorId, capabilityJtis: [incident.jti] } },
    serviceId: incident.serviceId, deployId: incident.deployId,
    httpRequestId: incident.httpRequestId,
  };
};
