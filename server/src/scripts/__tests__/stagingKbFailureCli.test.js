import { describe, expect, it } from "vitest";
import { readRenderKbFailureLogs } from "../stagingAiChatAcceptance.kbFailureCli.js";
import { proofInputs } from "./stagingKbFailure.fixture.js";

const inputs = () => {
  const fixture = proofInputs();
  const urls = [];
  return {
    urls,
    options: { intent: fixture.intent, sourceReport: fixture.sourceReport,
      env: { RENDER_STAGING_SERVICE_ID: fixture.serviceId,
        STAGING_AI_KB_FAILURE_REQUEST_ID: fixture.httpRequestId, RENDER_API_KEY: "synthetic-".repeat(5) },
      deployIdentity: { sha: fixture.intent.releaseSha,
        server: { sha: fixture.intent.releaseSha, provider: "render", deployId: fixture.deployId } },
      fetchImpl: async (url) => {
        urls.push(new URL(url));
        const payload = url.includes("/logs?")
          ? { hasMore: false, logs: fixture.logs.logs.filter(row => row.message.includes(new URL(url).searchParams.get("text"))) }
          : url.includes("/deploys/")
            ? { id: fixture.deployId, commit: { id: fixture.intent.releaseSha }, finishedAt: "2026-10-08T09:43:00Z" }
            : { id: fixture.serviceId, type: "web_service", branch: "staging", ownerId: "tea-synthetic" };
        return new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } });
      } },
  };
};

describe("Render KB failure inventories", () => {
  it("enumerates all HTTP events and provider completions without selecting a request ID", async () => {
    const { options, urls } = inputs();
    const inventory = await readRenderKbFailureLogs(options);
    expect(inventory.logs).toHaveLength(2);
    const queries = urls.filter(url => url.pathname === "/v1/logs");
    expect(queries.map(url => url.searchParams.get("text"))).toEqual(["http.request", "ai.deepseek_request_completed"]);
    expect(queries.every(url => !url.toString().includes(options.env.STAGING_AI_KB_FAILURE_REQUEST_ID))).toBe(true);
  });

  it("refuses incomplete pagination instead of using a partial inventory", async () => {
    const { options } = inputs();
    const original = options.fetchImpl;
    options.fetchImpl = async (url) => url.includes("/logs?")
      ? new Response(JSON.stringify({ hasMore: true, logs: [] }),
        { headers: { "Content-Type": "application/json" } })
      : original(url);
    await expect(readRenderKbFailureLogs(options)).rejects.toMatchObject({ code: "STAGING_KB_FAILURE_PROOF_INVALID" });
  });

  it("refuses another service without network access", async () => {
    const { options, urls } = inputs();
    options.env.RENDER_STAGING_SERVICE_ID = "srv-production";
    await expect(readRenderKbFailureLogs(options)).rejects.toMatchObject({ code: "STAGING_KB_FAILURE_PROOF_INVALID" });
    expect(urls).toHaveLength(0);
  });
});
