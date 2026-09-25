import { afterEach, describe, expect, test, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { reliabilityPlan } from "../stagingAiReliabilityAcceptance.plan.js";
import { readChatSse } from "../stagingAiReliabilityAcceptance.http.js";
import { buildSafeReliabilityEvidence } from "../stagingAiReliabilityAcceptance.evidence.js";
import { assertReliabilityConfig, assertReliabilityRuntimeRoute, reliabilityCardsEqual, runStagingAiReliabilityAcceptance } from "../stagingAiReliabilityAcceptance.js";

const SHA = "a".repeat(40);
const OID = "a".repeat(24);
const folders = [];
afterEach(async () => {
  await Promise.all(folders.splice(0).map((folder) => fs.rm(folder, { recursive: true, force: true })));
});

const stagingEnv = async () => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), "reliability-acceptance-test-"));
  folders.push(folder);
  return {
    APP_ENV: "staging",
    MONGO_URI: "mongodb://localhost:27017/htcoaching_staging",
    CLIENT_URL: "https://staging--htcoachingweb.netlify.app",
    PUBLIC_API_ORIGIN: "https://htcoachingweb-staging.onrender.com",
    ALLOWED_ORIGINS: "https://staging--htcoachingweb.netlify.app",
    BACKGROUND_JOBS_ENABLED: "false",
    EMAIL_DELIVERY_MODE: "disabled",
    F1_RETENTION_ENFORCE: "false",
    CONFIRM_STAGING_AI_RELIABILITY: "yes",
    JWT_SECRET: "synthetic-test-key",
    RELEASE_SHA: SHA,
    RENDER_GIT_COMMIT: SHA,
    STAGING_AI_RELIABILITY_OUTPUT: path.join(folder, "evidence.json"),
    STAGING_AI_RELIABILITY_RECOVERY_OUTPUT: path.join(folder, "recovery.json"),
  };
};

const sse = (events, headers = { "content-type": "text/event-stream" }) =>
  new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""), { headers });

describe("one-round reliability acceptance", () => {
  test("accepts model prior only for low-risk fitness KB misses without a required tool", () => {
    const plan = reliabilityPlan()[2];
    const trace = { routeDomain: "fitness", evidenceMode: "model_prior", kbEntryIds: [],
      webSearchUsed: false, webSearchOutcome: "not_called" };
    expect(() => assertReliabilityRuntimeRoute(trace, plan)).not.toThrow();
    for (const invalid of [
      { ...trace, routeDomain: "general" },
      { ...trace, kbEntryIds: [OID] },
      { ...trace, webSearchUsed: true },
      { ...trace, webSearchOutcome: "grounded" },
    ]) {
      expect(() => assertReliabilityRuntimeRoute(invalid, plan))
        .toThrowError("STAGING_AI_RELIABILITY_ROUTE_FAILED");
    }
    expect(() => assertReliabilityRuntimeRoute(trace, reliabilityPlan()[1]))
      .toThrowError("STAGING_AI_RELIABILITY_ROUTE_FAILED");
  });
  test("compares persisted cards semantically despite object key order", () => {
    expect(reliabilityCardsEqual(
      { cardType: "meal", data: { totals: { protein: 120, calories: 2200 }, status: "complete" } },
      { data: { status: "complete", totals: { calories: 2200, protein: 120 } }, cardType: "meal" },
    )).toBe(true);
  });

  test("uses exactly eleven corpus prompts and two live follow-up chains", () => {
    const plan = reliabilityPlan();
    expect({ count: plan.length, chains: plan.filter((item) => item.followUpTo)
      .map((item) => [item.number, item.followUpTo]) }).toEqual({
      count: 11, chains: [[6, 11], [8, 7]],
    });
  });

  test("rejects an exact staging lock mismatch before connection", async () => {
    const env = await stagingEnv();
    env.APP_ENV = "Staging";
    expect(() => assertReliabilityConfig(env)).toThrowError();
  });

  test("accepts a complete SSE turn", async () => {
    const result = await readChatSse(sse([
      { type: "conversation", conversationId: OID },
      { type: "text", content: "Xin chào" },
      { type: "done", conversationId: OID },
    ]));
    expect(result).toMatchObject({ conversationId: OID, text: "Xin chào" });
  });

  test("fails closed on missing done, explicit error, and conversation drift", async () => {
    const cases = [
      [{ type: "conversation", conversationId: OID }, { type: "text", content: "partial" }],
      [{ type: "error", message: "secret provider response" }],
      [{ type: "conversation", conversationId: OID }, { type: "text", content: "partial" },
        { type: "done", conversationId: "b".repeat(24) }],
    ];
    const results = await Promise.all(cases.map(async (events) => {
      try { await readChatSse(sse(events)); return "accepted"; }
      catch (error) { return error.code; }
    }));
    expect(results).toEqual([
      "STAGING_AI_RELIABILITY_SSE_INCOMPLETE",
      "STAGING_AI_RELIABILITY_STREAM_ERROR",
      "STAGING_AI_RELIABILITY_SSE_INVALID",
    ]);
  });

  test("evidence allowlist drops raw prompt, response, cookie and URI", () => {
    const evidence = buildSafeReliabilityEvidence({
      runId: "11111111-1111-4111-8111-111111111111", releaseSha: SHA,
      startedAt: "2026-09-24T00:00:00.000Z", completedAt: "2026-09-24T00:01:00.000Z",
      prompts: [{ number: 1, scenarioId: "incident-breakfast", requestId: "22222222-2222-4222-8222-222222222222",
        conversationId: OID, message: "raw prompt", response: "raw answer", cookie: "secret-cookie",
        uri: "mongodb://secret", tools: [{ name: "suggest_meal", status: "success", raw: "secret" }] }],
      error: { code: "SECRET string", message: "raw answer" },
    });
    const serialized = JSON.stringify(evidence);
    expect(["raw prompt", "raw answer", "secret-cookie", "mongodb://secret", "SECRET string"]
      .some((value) => serialized.includes(value))).toBe(false);
  });

  test("card mismatch evidence contains only bounded shape metadata", () => {
    const evidence = buildSafeReliabilityEvidence({
      runId: "11111111-1111-4111-8111-111111111111", releaseSha: SHA,
      cardDiagnostic: { streamedCount: 1, persistedCount: 0,
        streamed: [{ type: "meal", fieldCount: 3 }], persisted: [], matchedCount: 0 },
    });
    expect(evidence.cardDiagnostic).toEqual({ streamedCount: 1, persistedCount: 0,
      streamed: [{ type: "meal", fieldCount: 3 }], persisted: [], matchedCount: 0 });
  });

  test("known post-SSE failure still performs exact cleanup and writes safe evidence", async () => {
    const env = await stagingEnv();
    const cleanup = vi.fn();
    const verify = vi.fn().mockResolvedValue({ residue: 0 });
    const connection = {
      connection: { db: { databaseName: "htcoaching_staging" } },
      connect: vi.fn(), disconnect: vi.fn(),
    };
    const deps = {
      connection,
      inspectReadiness: async () => ({ ready: true }),
      createCleanup: () => ({ registerUser: vi.fn(), markMutationStart: vi.fn(),
        markMutationSettled: vi.fn(), cleanup, verify }),
      saveUser: async () => {},
      createClient: () => async () => ({ conversationId: OID, text: "safe answer", cards: [], toolResults: 0 }),
      fetchMetrics: async () => ({ runtimeReleaseSha: SHA }),
      inspectTurn: async () => { throw Object.assign(new Error("raw answer"), { code: "STAGING_AI_RELIABILITY_SEMANTIC_FAILED" }); },
    };
    await expect(runStagingAiReliabilityAcceptance({ env, deps })).rejects.toThrow();
    const evidence = JSON.parse(await fs.readFile(env.STAGING_AI_RELIABILITY_OUTPUT, "utf8"));
    expect({ cleanupCalls: cleanup.mock.calls.length, verified: evidence.cleanup?.verified,
      residue: evidence.cleanup?.residue, raw: JSON.stringify(evidence).includes("raw answer") })
      .toEqual({ cleanupCalls: 1, verified: true, residue: 0, raw: false });
  });

  test("uncertain in-flight failure retains exact recovery intent and avoids deletion", async () => {
    const env = await stagingEnv();
    const cleanup = vi.fn();
    const deps = {
      connection: { connection: { db: { databaseName: "htcoaching_staging" } },
        connect: vi.fn(), disconnect: vi.fn() },
      inspectReadiness: async () => ({ ready: true }),
      createCleanup: () => ({ registerUser: vi.fn(), markMutationStart: vi.fn(),
        markMutationSettled: vi.fn(), cleanup, verify: async () => ({ residue: 0 }) }),
      saveUser: async () => {},
      createClient: () => async () => { throw new Error("ambiguous network failure"); },
      fetchMetrics: async () => ({ runtimeReleaseSha: SHA }),
    };
    await expect(runStagingAiReliabilityAcceptance({ env, deps })).rejects.toThrow();
    const recovery = JSON.parse(await fs.readFile(env.STAGING_AI_RELIABILITY_RECOVERY_OUTPUT, "utf8"));
    expect({ cleanupCalls: cleanup.mock.calls.length, runId: recovery.runId,
      userId: recovery.userId, adminUserId: recovery.adminUserId })
      .toMatchObject({ cleanupCalls: 0, runId: expect.any(String),
        userId: expect.stringMatching(/^[a-f0-9]{24}$/),
        adminUserId: expect.stringMatching(/^[a-f0-9]{24}$/) });
  });

  test("one successful invocation dispatches exactly eleven prompts with follow-up identity", async () => {
    const env = await stagingEnv();
    const requests = [];
    const cleanup = vi.fn();
    const counters = {
      "provider.gemini_chat_requests": 0,
      "provider.gemini_chat_succeeded": 0,
      "provider.gemini_chat_failed": 0,
      "provider.gemini_chat_unavailable": 0,
      "provider.gemini_chat_rate_limited": 0,
      "provider.gemini_chat_not_required": 0,
    };
    let sequence = 0;
    const result = await runStagingAiReliabilityAcceptance({ env, deps: {
      connection: { connection: { db: { databaseName: "htcoaching_staging" } },
        connect: vi.fn(), disconnect: vi.fn() },
      inspectReadiness: async () => ({ ready: true }),
      createCleanup: () => ({ registerUser: vi.fn(), markMutationStart: vi.fn(),
        markMutationSettled: vi.fn(), cleanup, verify: async () => ({ residue: 0 }) }),
      saveUser: async () => {},
      createClient: () => async (request) => {
        requests.push(request);
        sequence += 1;
        return { conversationId: request.conversationId || sequence.toString(16).padStart(24, "0"),
          text: "safe answer", cards: [], toolResults: 0 };
      },
      seedContext: async ({ conversationId }) => String(conversationId),
      fetchMetrics: async () => {
        counters["provider.gemini_chat_requests"] += 1;
        counters["provider.gemini_chat_succeeded"] += 1;
        return { runtimeReleaseSha: SHA, runtimeInstanceId: "11111111-1111-4111-8111-111111111111",
          uptimeSeconds: 100 + sequence, counters: { ...counters } };
      },
      inspectTurn: async ({ plan }) => ({ trace: {
        routeDomain: plan.expectedPath.domain || "fitness",
        evidenceMode: plan.expectedPath.evidence || "model_prior",
        webSearchOutcome: plan.expectedPath.webSearchRequired ? "grounded" : "not_called",
      }, tools: [] }),
    } });
    expect({ count: result.prompts.length, cleanup: cleanup.mock.calls.length,
      residue: result.cleanup.residue,
      followUps: [
        requests[6].conversationId === result.prompts[5].conversationId,
        requests[10].conversationId === result.prompts[9].conversationId,
      ], seeded: requests[3].conversationId === result.prompts[3].conversationId }).toEqual({
      count: 11, cleanup: 1, residue: 0, followUps: [true, true], seeded: true,
    });
  });
});
