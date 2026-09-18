import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  EXPECTED_API_ORIGIN,
  EXPECTED_CLIENT_URL,
  validateAcceptanceConfig,
} from "../stagingAiChatAcceptance.config.js";
import { assertHealthyVectorTopology, buildSafeEvidence, metricDelta } from "../stagingAiChatAcceptance.evidence.js";
import { createExactCleanup } from "../stagingAiChatAcceptance.cleanup.js";
import {
  selectNewReconciledAssistant,
  STAGING_AI_CHAT_ATTEMPT_PLAN,
} from "../stagingAiChatAcceptance.browser.js";
import {
  assertExactRequestInventory,
  buildStagingAiRecoveryIntent,
  runStagingAiChatAcceptance,
  STAGING_AI_REQUEST_PURPOSES,
  waitForSettledReceipts,
} from "../stagingAiChatAcceptance.js";
import { createApiClient, createKnowledgeFixture, searchKnowledgeFixture } from "../stagingAiChatAcceptance.http.js";
import {
  assertExpectedRuntime,
  runAfterRuntimePreflight,
  waitForHealthyVectorFixture,
} from "../stagingAiChatAcceptance.vector.js";
import { validateKnowledgeEntryPrivacy } from "../../services/ai/knowledgePrivacy.js";
import { parseKnowledgeEntryPayload, validateKnowledgePublication } from "../../utils/knowledgeBase.js";

const SHA = "a".repeat(40);
const validEnv = () => ({
  APP_ENV: "staging",
  MONGO_URI: "mongodb://localhost:27017/htcoaching_staging",
  CLIENT_URL: EXPECTED_CLIENT_URL,
  PUBLIC_API_ORIGIN: EXPECTED_API_ORIGIN,
  RELEASE_SHA: SHA,
  RENDER_GIT_COMMIT: SHA,
  CONFIRM_STAGING_AI_ACCEPTANCE: "yes",
  STAGING_AI_ACCEPTANCE_ENABLED: "true",
  EXPECTED_KB_EMBEDDING_VERSION: "gemini-embedding-2:768:question-answering-v1",
  STAGING_AI_ACCEPTANCE_OUTPUT: "evidence.json",
  STAGING_AI_ACCEPTANCE_RECOVERY_OUTPUT: "recovery.json",
  BACKGROUND_JOBS_ENABLED: "false",
  MORNING_HEALTH_REMINDER_ENABLED: "false",
  EMAIL_DELIVERY_MODE: "disabled",
  F1_RETENTION_ENFORCE: "false",
  ALLOWED_ORIGINS: EXPECTED_CLIENT_URL,
});

describe("staging AI acceptance config", () => {
  it.each([
    ["production env", { APP_ENV: "production" }],
    ["non-exact staging env", { APP_ENV: "STAGING" }],
    ["wrong database", { MONGO_URI: "mongodb://localhost:27017/other" }],
    ["wrong client", { CLIENT_URL: "https://example.invalid" }],
    ["wrong api", { PUBLIC_API_ORIGIN: "https://example.invalid" }],
    ["bad sha", { RELEASE_SHA: "abc" }],
    ["missing runtime sha", { RENDER_GIT_COMMIT: "" }],
    ["sha drift", { RENDER_GIT_COMMIT: "b".repeat(40) }],
    ["missing confirmation", { CONFIRM_STAGING_AI_ACCEPTANCE: "" }],
    ["disabled capability", { STAGING_AI_ACCEPTANCE_ENABLED: "false" }],
    ["wrong embedding version", { EXPECTED_KB_EMBEDDING_VERSION: "question-answering-v1" }],
  ])("fails closed for %s", (_name, override) => {
    expect(validateAcceptanceConfig({ ...validEnv(), ...override }).valid).toBe(false);
  });

  it("accepts the exact staging identity", () => {
    expect(validateAcceptanceConfig(validEnv())).toMatchObject({ valid: true });
  });

});

describe("staging AI acceptance evidence", () => {
  it("keeps only the safe schema and redacts forbidden values", () => {
    const rawRuntimeId = randomUUID();
    const evidence = buildSafeEvidence({
      releaseSha: SHA,
      runId: randomUUID(),
      syntheticIds: { userId: "u1", adminUserId: "a1", kbEntryId: "k1", capabilityJtis: ["j1"] },
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      status: "failed",
      sourceUrl: "https://www.who.int/news-room/fact-sheets/detail/physical-activity",
      assertions: [{ name: "failure lane", passed: false }],
      lanes: [{ name: "retry", passed: false, token: "must-not-leak", output: "raw" }],
      catalogReadiness: {
        ready: false,
        gaps: ["food_fresh_price_macro_groups_incomplete", "unsafe raw detail"],
        metrics: {
          exerciseCount: 31,
          displacedFixtures: 1,
          beginnerBodyweightChest: 3,
          foodCount: 50,
          safeMealFoods: 4,
          freshPricedSafeMealFoods: 3,
          safeMacroGroups: ["protein", "carb", "fat", "unexpected"],
          freshPricedSafeMacroGroups: ["protein"],
          rawFoodLabels: ["must-not-leak"],
        },
      },
      metricsDelta: { "kb.vector_fallbacks": 0, secret: 12 },
      cleanup: { verified: true, residue: 0, collections: { users: 0 } },
      runtimeBinding: {
        proof: "request_cohort", releaseSha: SHA,
        runtimeFingerprint: "f".repeat(64), metricsBeforeAt: new Date().toISOString(), metricsAfterAt: new Date().toISOString(),
        runtimeInstanceId: rawRuntimeId, attempts: [{
          purpose: "live_kb_provider", action: "ai_chat", mode: "observe_only", outcome: "completed",
          jti: randomUUID(), requestId: randomUUID(), releaseSha: SHA, runtimeFingerprint: "f".repeat(64),
          admittedAt: new Date().toISOString(), settledAt: new Date().toISOString(), receiptState: "settled", runtimeInstanceId: rawRuntimeId,
        }],
      },
      error: new Error("mongodb://secret token=abc raw conversation"),
    });
    expect(JSON.stringify(evidence)).not.toContain("must-not-leak");
    expect(JSON.stringify(evidence)).toEqual(expect.not.stringMatching(/secret|token=|conversation/i));
    expect(evidence).toMatchObject({ schemaVersion: 3, metricsDelta: { "kb.vector_fallbacks": 0 } });
    expect(evidence.catalogReadiness).toEqual({
      ready: false,
      gaps: [
        "food_fresh_price_macro_groups_incomplete",
        "catalog_readiness_payload_invalid",
      ],
      metrics: {
        exerciseCount: 31,
        displacedFixtures: 1,
        beginnerBodyweightChest: 3,
        foodCount: 50,
        safeMealFoods: 4,
        freshPricedSafeMealFoods: 3,
        safeMacroGroups: ["carb", "fat", "protein"],
        freshPricedSafeMacroGroups: ["protein"],
      },
    });
    expect(JSON.stringify(evidence)).not.toContain(rawRuntimeId);
    expect(evidence.runtimeBinding).toMatchObject({ proof: "request_cohort", attempts: [{ receiptState: "settled" }] });
  });

  it("fails sanitized catalog readiness closed when a passing payload contains unknown fields", () => {
    const evidence = buildSafeEvidence({
      catalogReadiness: {
        ready: true,
        gaps: ["unknown_gap"],
        metrics: {
          exerciseCount: 31,
          displacedFixtures: 0,
          beginnerBodyweightChest: 5,
          foodCount: 50,
          safeMealFoods: 3,
          freshPricedSafeMealFoods: 3,
          safeMacroGroups: ["protein", "carb", "fat"],
          freshPricedSafeMacroGroups: ["protein", "carb", "fat"],
          unexpected: true,
        },
      },
    });

    expect(evidence.catalogReadiness).toMatchObject({
      ready: false,
      gaps: ["catalog_readiness_payload_invalid"],
    });
  });

  it("retains a sanitized root operation code when cleanup wraps the failure", () => {
    const operationError = Object.assign(new Error("private browser detail"), {
      code: "STAGING_AI_CONTROL_BARRIER_FAILED",
    });
    const cleanupError = Object.assign(new Error("private cleanup detail"), {
      code: "STAGING_AI_CLEANUP_OUTCOME_UNKNOWN",
    });
    const evidence = buildSafeEvidence({
      releaseSha: SHA,
      runId: randomUUID(),
      syntheticIds: {},
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      status: "failed",
      sourceUrl: "https://www.who.int/news-room/fact-sheets/detail/physical-activity",
      error: Object.assign(
        new AggregateError([operationError, cleanupError], "private aggregate detail"),
        { code: "STAGING_ACCEPTANCE_CLEANUP_FAILED" },
      ),
    });

    expect(evidence.error).toEqual({
      code: "STAGING_ACCEPTANCE_CLEANUP_FAILED",
      operationCode: "STAGING_AI_CONTROL_BARRIER_FAILED",
    });
  });

  it("fails metrics closed without matching runtime identity", () => {
    expect(() => metricDelta(
      { uptimeSeconds: 10, counters: {} },
      { uptimeSeconds: 20, counters: {} },
    )).toThrowError(/stable runtime instance/);
  });

  it("blocks combined fallback even when root and variant fallback stay zero", () => {
    expect(() => assertHealthyVectorTopology({
      "kb.vector_fallbacks": 1,
      "kb.vector_root_fallbacks": 0,
      "kb.vector_variant_fallbacks": 0,
      "kb.vector_combined_fallbacks": 1,
    })).toThrowError(/combined_fallbacks|vector_fallbacks/);
  });
});

describe("staging AI vector readiness", () => {
  const snapshot = ({ fallback = 0, root = 0, variant = 0, uptimeSeconds }) => ({
    runtimeInstanceId: "runtime-1",
    runtimeReleaseSha: SHA,
    uptimeSeconds,
    counters: {
      "kb.vector_fallbacks": fallback,
      "kb.vector_root_fallbacks": root,
      "kb.vector_variant_fallbacks": variant,
      "kb.vector_combined_fallbacks": 0,
      "provider.gemini_chat_failed": 0,
    },
  });

  it("does not enter the fixture/probe/capability operation on the wrong release", async () => {
    const execute = vi.fn();
    await expect(runAfterRuntimePreflight({
      fetchSnapshot: vi.fn(async () => ({
        ...snapshot({ uptimeSeconds: 10 }),
        runtimeReleaseSha: "b".repeat(40),
      })),
      expectedReleaseSha: SHA,
      execute,
    })).rejects.toMatchObject({ code: "STAGING_AI_METRICS_INCONCLUSIVE" });
    expect(execute).not.toHaveBeenCalled();
  });

  it("rejects a runtime restart between identity preflight and readiness", () => {
    expect(() => assertExpectedRuntime(
      { ...snapshot({ uptimeSeconds: 10 }), runtimeInstanceId: "runtime-2" },
      { expectedReleaseSha: SHA, expectedRuntimeInstanceId: "runtime-1" },
    )).toThrowError(expect.objectContaining({ code: "STAGING_AI_METRICS_INCONCLUSIVE" }));
  });

  it("starts the cohort only after root and variant probes stop using fallbacks", async () => {
    const finalSnapshot = snapshot({ fallback: 2, root: 1, variant: 1, uptimeSeconds: 12 });
    const snapshots = [
      snapshot({ uptimeSeconds: 10 }),
      snapshot({ fallback: 2, root: 1, variant: 1, uptimeSeconds: 11 }),
      snapshot({ fallback: 2, root: 1, variant: 1, uptimeSeconds: 11 }),
      finalSnapshot,
    ];
    let clock = 0;
    const fixtureId = "fixture-1";
    const baseline = await waitForHealthyVectorFixture({
      fetchSnapshot: vi.fn(async () => snapshots.shift()),
      search: vi.fn(async () => ({ data: [{ _id: fixtureId }] })),
      fixtureId,
      queries: ["root query", "variant query"],
      timeoutMs: 2_000,
      pollMs: 1_000,
      now: () => clock,
      wait: vi.fn(async (milliseconds) => { clock += milliseconds; }),
      expectedReleaseSha: SHA,
      expectedRuntimeInstanceId: "runtime-1",
    });

    expect(baseline).toBe(finalSnapshot);
  });

  it("fails closed when Atlas never serves the exact fixture without fallback", async () => {
    let clock = 0;
    let snapshotCall = 0;
    const fetchSnapshot = vi.fn(async () => {
      const attempt = Math.floor(snapshotCall / 2);
      const fallback = attempt + (snapshotCall % 2);
      snapshotCall += 1;
      return snapshot({ fallback, root: fallback, uptimeSeconds: 10 + snapshotCall });
    });

    await expect(waitForHealthyVectorFixture({
      fetchSnapshot,
      search: vi.fn(async () => ({ data: [{ _id: "fixture-1" }] })),
      fixtureId: "fixture-1",
      queries: ["root query", "variant query"],
      timeoutMs: 1_000,
      pollMs: 1_000,
      now: () => clock,
      wait: vi.fn(async (milliseconds) => { clock += milliseconds; }),
    })).rejects.toMatchObject({ code: "STAGING_AI_VECTOR_INDEX_NOT_READY" });
  });

  it.each([
    [{ data: [] }],
    [{ data: [{ _id: "another-fixture" }] }],
    [{ data: null }],
  ])("fails closed when any readiness probe omits the exact fixture", async (response) => {
    let clock = 0;
    await expect(waitForHealthyVectorFixture({
      fetchSnapshot: vi.fn(async () => snapshot({ uptimeSeconds: 10 })),
      search: vi.fn(async () => response),
      fixtureId: "fixture-1",
      queries: ["root query", "variant query"],
      timeoutMs: 1,
      pollMs: 1,
      now: () => clock,
      wait: vi.fn(async (milliseconds) => { clock += milliseconds; }),
    })).rejects.toMatchObject({ code: "STAGING_AI_VECTOR_INDEX_NOT_READY" });
  });

  it("requires both the root and variant probe to contain the exact fixture", async () => {
    let clock = 0;
    const search = vi.fn()
      .mockResolvedValueOnce({ data: [{ _id: "fixture-1" }] })
      .mockResolvedValueOnce({ data: [] });
    await expect(waitForHealthyVectorFixture({
      fetchSnapshot: vi.fn(async () => snapshot({ uptimeSeconds: 10 })),
      search,
      fixtureId: "fixture-1",
      queries: ["root query", "variant query"],
      timeoutMs: 1_000,
      pollMs: 1_000,
      now: () => clock,
      wait: vi.fn(async (milliseconds) => { clock += milliseconds; }),
    })).rejects.toMatchObject({ code: "STAGING_AI_VECTOR_INDEX_NOT_READY" });
    expect(search).toHaveBeenCalledTimes(2);
  });

  it("does not start another probe attempt once polling reaches the deadline", async () => {
    let clock = 0;
    const fetchSnapshot = vi.fn(async () => snapshot({ uptimeSeconds: 10 }));
    const search = vi.fn(async () => ({ data: [] }));

    await expect(waitForHealthyVectorFixture({
      fetchSnapshot,
      search,
      fixtureId: "fixture-1",
      queries: ["root query", "variant query"],
      timeoutMs: 1_000,
      pollMs: 1_000,
      now: () => clock,
      wait: vi.fn(async (milliseconds) => { clock += milliseconds; }),
    })).rejects.toMatchObject({ code: "STAGING_AI_VECTOR_INDEX_NOT_READY" });

    expect({ snapshots: fetchSnapshot.mock.calls.length, searches: search.mock.calls.length })
      .toEqual({ snapshots: 2, searches: 2 });
  });

  it("rejects a healthy probe that only completes after the readiness deadline", async () => {
    let clock = 0;
    const after = snapshot({ uptimeSeconds: 11 });
    const fetchSnapshot = vi.fn()
      .mockResolvedValueOnce(snapshot({ uptimeSeconds: 10 }))
      .mockImplementationOnce(async () => {
        clock = 1_001;
        return after;
      });

    await expect(waitForHealthyVectorFixture({
      fetchSnapshot,
      search: vi.fn(async () => ({ data: [{ _id: "fixture-1" }] })),
      fixtureId: "fixture-1",
      queries: ["root query", "variant query"],
      timeoutMs: 1_000,
      pollMs: 1_000,
      now: () => clock,
      wait: vi.fn(),
    })).rejects.toMatchObject({ code: "STAGING_AI_VECTOR_INDEX_NOT_READY" });
  });

  it("clamps polling sleep to the remaining deadline", async () => {
    let clock = 0;
    const wait = vi.fn(async (milliseconds) => { clock += milliseconds; });
    await expect(waitForHealthyVectorFixture({
      fetchSnapshot: vi.fn(async () => snapshot({ uptimeSeconds: 10 })),
      search: vi.fn(async () => ({ data: [] })),
      fixtureId: "fixture-1",
      queries: ["root query", "variant query"],
      timeoutMs: 250,
      pollMs: 1_000,
      now: () => clock,
      wait,
    })).rejects.toMatchObject({ code: "STAGING_AI_VECTOR_INDEX_NOT_READY" });
    expect(wait).toHaveBeenCalledTimes(1);
    expect(wait).toHaveBeenCalledWith(250, { signal: expect.any(AbortSignal) });
  });

  it("aborts an in-flight readiness request at the hard deadline", async () => {
    vi.useFakeTimers();
    try {
      let observedSignal;
      const pending = waitForHealthyVectorFixture({
        fetchSnapshot: vi.fn(({ signal }) => {
          observedSignal = signal;
          return new Promise(() => {});
        }),
        search: vi.fn(),
        fixtureId: "fixture-1",
        queries: ["root query", "variant query"],
        timeoutMs: 100,
      }).catch((error) => error);

      await vi.advanceTimersByTimeAsync(100);
      const failure = await pending;
      expect({ code: failure?.code, aborted: observedSignal?.aborted })
        .toEqual({ code: "STAGING_AI_VECTOR_INDEX_NOT_READY", aborted: true });
    } finally {
      vi.useRealTimers();
    }
  });

  it("propagates an inconclusive metrics window when the runtime changes", async () => {
    const snapshots = [
      snapshot({ uptimeSeconds: 10 }),
      { ...snapshot({ uptimeSeconds: 1 }), runtimeInstanceId: "runtime-2" },
    ];
    await expect(waitForHealthyVectorFixture({
      fetchSnapshot: vi.fn(async () => snapshots.shift()),
      search: vi.fn(async () => ({ data: [{ _id: "fixture-1" }] })),
      fixtureId: "fixture-1",
      queries: ["root query", "variant query"],
    })).rejects.toMatchObject({ code: "STAGING_AI_METRICS_INCONCLUSIVE" });
  });

  it("fails inconclusive when a later polling attempt moves to another runtime", async () => {
    let clock = 0;
    const snapshots = [
      snapshot({ uptimeSeconds: 10 }),
      snapshot({ fallback: 1, root: 1, uptimeSeconds: 11 }),
      { ...snapshot({ fallback: 5, root: 5, uptimeSeconds: 1 }), runtimeInstanceId: "runtime-2" },
      { ...snapshot({ fallback: 5, root: 5, uptimeSeconds: 2 }), runtimeInstanceId: "runtime-2" },
    ];

    await expect(waitForHealthyVectorFixture({
      fetchSnapshot: vi.fn(async () => snapshots.shift()),
      search: vi.fn(async () => ({ data: [{ _id: "fixture-1" }] })),
      fixtureId: "fixture-1",
      queries: ["root query", "variant query"],
      timeoutMs: 2_000,
      pollMs: 1_000,
      now: () => clock,
      wait: vi.fn(async (milliseconds) => { clock += milliseconds; }),
      expectedReleaseSha: SHA,
      expectedRuntimeInstanceId: "runtime-1",
    })).rejects.toMatchObject({ code: "STAGING_AI_METRICS_INCONCLUSIVE" });
  });
});

describe("staging AI browser reconciliation", () => {
  it("does not reuse an earlier assistant when a recovery has no new matching response", () => {
    const items = [{ assistantId: "initial", questionDigest: "same-question" }];
    expect(selectNewReconciledAssistant(items, 1, "same-question")).toBeNull();
  });

  it("locks the seven browser attempts into failure-then-recovery chronology", () => {
    expect(STAGING_AI_CHAT_ATTEMPT_PLAN).toEqual([
      { purpose: "live_kb_provider", mode: "observe_only" },
      { purpose: "paced_conversation", mode: "paced_response" },
      { purpose: "stop", mode: "paced_response" },
      { purpose: "provider_failure_retry", mode: "provider_failure_before_llm" },
      { purpose: "recovery_retry", mode: "observe_only" },
      { purpose: "provider_failure_edit", mode: "provider_failure_before_llm" },
      { purpose: "recovery_edit", mode: "observe_only" },
    ]);
  });

  it("accepts only the exact seven-chat and two-search request inventory", () => {
    const inventory = STAGING_AI_REQUEST_PURPOSES.map((purpose) => ({
      purpose,
      jti: randomUUID(),
      requestId: randomUUID(),
    }));

    expect(assertExactRequestInventory(inventory)).toBe(inventory);
    expect(inventory.filter((item) => item.purpose.startsWith("kb_search_")))
      .toHaveLength(2);
  });

  it.each([
    ["missing", (items) => items.slice(0, -1)],
    ["extra", (items) => [...items, { purpose: "readiness_probe", jti: randomUUID(), requestId: randomUUID() }]],
    ["duplicate purpose", (items) => items.map((item, index) => index === 1 ? { ...item, purpose: items[0].purpose } : item)],
    ["duplicate JTI", (items) => items.map((item, index) => index === 1 ? { ...item, jti: items[0].jti } : item)],
    ["duplicate request ID", (items) => items.map((item, index) => index === 1 ? { ...item, requestId: items[0].requestId } : item)],
  ])("rejects a %s request inventory", (_name, mutate) => {
    const inventory = STAGING_AI_REQUEST_PURPOSES.map((purpose) => ({
      purpose,
      jti: randomUUID(),
      requestId: randomUUID(),
    }));

    expect(() => assertExactRequestInventory(mutate(inventory)))
      .toThrowError(expect.objectContaining({ code: "STAGING_AI_REQUEST_INVENTORY_FAILED" }));
  });
});

describe("staging AI hard-kill intent", () => {
  it("emits the complete closed recovery schema without secret-adjacent fields", () => {
    const runId = randomUUID();
    const createdAt = new Date().toISOString();
    const value = buildStagingAiRecoveryIntent({
      releaseSha: SHA,
      runId,
      marker: `htcoaching-acceptance:${runId}`,
      createdAt,
    });
    expect(value).toEqual({
      schemaVersion: 1,
      kind: "staging-ai-chat-recovery-intent",
      releaseSha: SHA,
      runId,
      marker: `htcoaching-acceptance:${runId}`,
      createdAt,
    });
    expect(JSON.stringify(value)).not.toMatch(/token|cookie|mongo|prompt|output/i);
  });
});

describe("staging AI remote mutation outcomes", () => {
  it("builds a fixture payload accepted by the real KB write guards", async () => {
    const api = { request: vi.fn(async (requestPath, options) => {
      const parsed = parseKnowledgeEntryPayload(options.body);
      expect({
        requestPath,
        method: options.method,
        parseError: parsed.error || null,
        privacy: parsed.value ? validateKnowledgeEntryPrivacy(parsed.value) : null,
        publication: parsed.value ? validateKnowledgePublication(parsed.value) : null,
      }).toEqual({
        requestPath: "/api/knowledge-base",
        method: "POST",
        parseError: null,
        privacy: { valid: true },
        publication: { valid: true },
      });
      return { data: {
        _id: String(new mongoose.Types.ObjectId()), status: "published", reviewStatus: "reviewed",
        embeddingStatus: "ready", embeddingVersion: "locked-target",
      } };
    }) };
    await createKnowledgeFixture({
      api,
      marker: `htcoaching-acceptance:${randomUUID()}`,
      sourceUrl: "https://www.who.int/news-room/fact-sheets/detail/physical-activity",
    });
    expect(api.request).toHaveBeenCalledOnce();
  });

  it.each([502, 504])("does not call HTTP %i a terminal remote outcome", async (status) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({ status, json: async () => ({}) });
    const api = createApiClient({ origin: EXPECTED_API_ORIGIN, accessToken: "synthetic", csrfToken: "csrf" });
    let failure;
    try {
      await api.request("/api/knowledge-base", { method: "POST", body: {} });
    } catch (error) {
      failure = error;
    }
    expect({ code: failure?.code, outcomeKnown: failure?.remoteOutcomeKnown === true })
      .toEqual({ code: "STAGING_AI_API_CONTRACT_FAILED", outcomeKnown: false });
    vi.restoreAllMocks();
  });

  it("recognizes only the exact pre-write privacy rejection as a known remote outcome", async () => {
    const requestId = randomUUID();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      status: 400,
      headers: { get: (name) => name.toLowerCase() === "x-request-id" ? requestId : null },
      json: async () => ({ success: false, code: "KNOWLEDGE_QUERY_SENSITIVE" }),
    });
    const api = createApiClient({ origin: EXPECTED_API_ORIGIN, accessToken: "synthetic", csrfToken: "csrf" });
    let failure;
    try {
      await api.request("/api/knowledge-base", {
        method: "POST",
        body: {},
        headers: { "X-Request-Id": requestId },
      });
    } catch (error) {
      failure = error;
    }
    expect({
      code: failure?.code,
      outcomeKnown: failure?.remoteOutcomeKnown === true,
      httpStatus: failure?.httpStatus,
      responseCode: failure?.responseCode,
      requestId: failure?.requestId,
    }).toEqual({
      code: "STAGING_AI_API_CONTRACT_FAILED",
      outcomeKnown: true,
      httpStatus: 400,
      responseCode: "KNOWLEDGE_QUERY_SENSITIVE",
      requestId,
    });
    vi.restoreAllMocks();
  });

  it.each([
    [400, "VALIDATION_ERROR", "matching"],
    [400, "KNOWLEDGE_QUERY_SENSITIVE", "mismatch"],
    [409, "KNOWLEDGE_QUERY_SENSITIVE", "matching"],
  ])("keeps HTTP %i/%s with %s request ID outcome unknown", async (status, code, requestIdMode) => {
    const requestId = randomUUID();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      status,
      headers: { get: () => requestIdMode === "matching" ? requestId : randomUUID() },
      json: async () => ({ success: false, code }),
    });
    const api = createApiClient({ origin: EXPECTED_API_ORIGIN, accessToken: "synthetic", csrfToken: "csrf" });
    let failure;
    try {
      await api.request("/api/knowledge-base", {
        method: "POST",
        body: {},
        headers: { "X-Request-Id": requestId },
      });
    } catch (error) {
      failure = error;
    }
    expect(failure?.remoteOutcomeKnown === true).toBe(false);
    vi.restoreAllMocks();
  });

  it("does not call malformed JSON from a successful mutation a terminal outcome", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      status: 201,
      json: async () => { throw new SyntaxError("malformed JSON"); },
    });
    const api = createApiClient({ origin: EXPECTED_API_ORIGIN, accessToken: "synthetic", csrfToken: "csrf" });
    let failure;
    try {
      await createKnowledgeFixture({
        api,
        marker: `htcoaching-acceptance:${randomUUID()}`,
        sourceUrl: "https://www.who.int/news-room/fact-sheets/detail/physical-activity",
      });
    } catch (error) {
      failure = error;
    }
    expect({ code: failure?.code, outcomeKnown: failure?.remoteOutcomeKnown === true })
      .toEqual({ code: "STAGING_AI_KB_FIXTURE_FAILED", outcomeKnown: false });
  });

  it("does not swallow an abort while reading an API response body", async () => {
    const controller = new AbortController();
    const reason = Object.assign(new Error("readiness deadline reached"), {
      code: "STAGING_AI_VECTOR_INDEX_NOT_READY",
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      status: 200,
      json: async () => {
        controller.abort(reason);
        throw reason;
      },
    });
    const api = createApiClient({ origin: EXPECTED_API_ORIGIN, accessToken: "synthetic", csrfToken: "csrf" });

    await expect(api.request("/api/ops/metrics", { signal: controller.signal }))
      .rejects.toBe(reason);
    vi.restoreAllMocks();
  });

  it("sends the exact staging client origin with a capability-bound KB search", async () => {
    const request = vi.fn().mockResolvedValue({ success: true, data: [] });
    await searchKnowledgeFixture({
      api: { request },
      clientOrigin: EXPECTED_CLIENT_URL,
      query: "  squat   cơ bản ",
      token: "synthetic-capability",
      requestId: randomUUID(),
    });
    expect(request).toHaveBeenCalledWith(
      "/api/knowledge-base/search?q=squat%20c%C6%A1%20b%E1%BA%A3n&threshold=0.75&limit=3",
      { headers: expect.objectContaining({ Origin: EXPECTED_CLIENT_URL }) },
    );
  });

  it("omits acceptance capability headers from vector-readiness probes", async () => {
    const request = vi.fn().mockResolvedValue({ success: true, data: [] });
    const signal = new AbortController().signal;
    await searchKnowledgeFixture({
      api: { request },
      clientOrigin: EXPECTED_CLIENT_URL,
      query: "readiness probe",
      signal,
    });

    expect(request).toHaveBeenCalledWith(
      "/api/knowledge-base/search?q=readiness%20probe&threshold=0.75&limit=3",
      { headers: { Origin: EXPECTED_CLIENT_URL }, signal },
    );
  });

  it.each([
    [{ requestId: "request-id-without-capability" }],
    [Object.fromEntries([["to" + "ken", "capability-without-request-id"]])],
    [Object.fromEntries([["to" + "ken", ""], ["requestId", ""]])],
  ])("rejects incomplete acceptance capability binding", async (binding) => {
    await expect(searchKnowledgeFixture({
      api: { request: vi.fn() },
      clientOrigin: EXPECTED_CLIENT_URL,
      query: "bound query",
      ...binding,
    })).rejects.toMatchObject({ code: "STAGING_AI_REQUEST_INVENTORY_FAILED" });
  });
});

describe("staging AI acceptance cleanup", () => {
  let memory;
  beforeAll(async () => {
    memory = await MongoMemoryServer.create();
    await mongoose.connect(memory.getUri("htcoaching_staging"));
  });
  afterAll(async () => {
    await mongoose.disconnect();
    await memory.stop();
  });

  it("rejects a settled receipt outside the exact run inventory", async () => {
    const db = mongoose.connection.db;
    const runId = randomUUID();
    const runtimeInstanceId = randomUUID();
    const attempt = {
      purpose: "kb_search_root",
      action: "kb_search",
      mode: "observe_only",
      outcome: "completed",
      jti: randomUUID(),
      requestId: randomUUID(),
    };
    const receipt = (item) => ({
      _id: item.jti,
      recordType: "capability",
      receiptVersion: 2,
      receiptState: "settled",
      runId,
      action: item.action,
      purpose: item.purpose,
      mode: item.mode,
      outcome: item.outcome,
      requestId: item.requestId,
      releaseSha: SHA,
      runtimeInstanceId,
      admittedAt: new Date(),
      settledAt: new Date(),
    });
    await db.collection("staging_ai_acceptance_claims").insertMany([
      receipt(attempt),
      receipt({ ...attempt, purpose: "kb_search_variant", jti: randomUUID(), requestId: randomUUID() }),
    ]);

    await expect(waitForSettledReceipts({
      collection: db.collection("staging_ai_acceptance_claims"),
      runId,
      attempts: [attempt],
      runtimeInstanceId,
      releaseSha: SHA,
    })).rejects.toMatchObject({ code: "STAGING_AI_REQUEST_INVENTORY_FAILED" });
  });

  it("returns receipt proof in the registered request order", async () => {
    const db = mongoose.connection.db;
    const runId = randomUUID();
    const runtimeInstanceId = randomUUID();
    const attempts = ["kb_search_root", "kb_search_variant"].map((purpose) => ({
      purpose,
      action: "kb_search",
      mode: "observe_only",
      outcome: "completed",
      jti: randomUUID(),
      requestId: randomUUID(),
    }));
    const documents = [...attempts].reverse().map((item) => ({
      _id: item.jti,
      recordType: "capability",
      receiptVersion: 2,
      receiptState: "settled",
      runId,
      action: item.action,
      purpose: item.purpose,
      mode: item.mode,
      outcome: item.outcome,
      requestId: item.requestId,
      releaseSha: SHA,
      runtimeInstanceId,
      admittedAt: new Date(),
      settledAt: new Date(),
    }));
    await db.collection("staging_ai_acceptance_claims").insertMany(documents);

    const result = await waitForSettledReceipts({
      collection: db.collection("staging_ai_acceptance_claims"),
      runId,
      attempts,
      runtimeInstanceId,
      releaseSha: SHA,
    });
    expect(result.map((item) => item.purpose)).toEqual(["kb_search_root", "kb_search_variant"]);
  });

  it("deletes only registered exact IDs and proves zero residue", async () => {
    const db = mongoose.connection.db;
    const runId = randomUUID();
    const userId = new mongoose.Types.ObjectId();
    const otherUserId = new mongoose.Types.ObjectId();
    const kbId = new mongoose.Types.ObjectId();
    await db.collection("users").insertMany([
      { _id: userId, email: `${userId}@example.invalid` },
      { _id: otherUserId, email: `${otherUserId}@example.invalid` },
    ]);
    await db.collection("knowledgeentries").insertOne({ _id: kbId });
    await db.collection("chatconversations").insertMany([{ userId }, { userId: otherUserId }]);
    await db.collection("staging_ai_acceptance_claims").insertMany([
      { _id: runId, recordType: "run", runId, state: "revoked" },
      { _id: "owned", runId, receiptState: "settled", expiresAt: new Date(Date.now() - 1) },
      { _id: "other", runId: randomUUID() },
    ]);

    const exact = createExactCleanup({ db, runId });
    exact.registerUser(userId);
    exact.registerKnowledgeEntry(kbId);
    exact.registerCapabilityJti("owned");
    await exact.cleanup();

    expect({ report: await exact.verify(), other: await db.collection("users").countDocuments({ _id: otherUserId }) })
      .toEqual({ report: expect.objectContaining({ residue: 0 }), other: 1 });
  });

  it("retains the tombstone and actors when a capability appears after inventory", async () => {
    const db = mongoose.connection.db;
    const runId = randomUUID();
    const userId = new mongoose.Types.ObjectId();
    await db.collection("users").insertOne({
      _id: userId,
      email: `${userId}@example.invalid`,
    });
    await db.collection("staging_ai_acceptance_claims").insertMany([
      { _id: runId, recordType: "run", runId, state: "revoked" },
      {
        _id: "registered",
        recordType: "capability",
        runId,
        receiptState: "settled",
        expiresAt: new Date(Date.now() - 1),
      },
      {
        _id: "late-extra",
        recordType: "capability",
        runId,
        receiptState: "settled",
        expiresAt: new Date(Date.now() - 1),
      },
    ]);
    const exact = createExactCleanup({ db, runId });
    exact.registerUser(userId);
    exact.registerCapabilityJti("registered");

    await expect(exact.cleanup()).rejects.toMatchObject({
      code: "STAGING_AI_CLEANUP_UNEXPECTED_CAPABILITY",
    });
    expect({
      actor: await db.collection("users").countDocuments({ _id: userId }),
      tombstone: await db.collection("staging_ai_acceptance_claims")
        .countDocuments({ _id: runId, state: "revoked" }),
      lateReceipt: await db.collection("staging_ai_acceptance_claims")
        .countDocuments({ _id: "late-extra" }),
    }).toEqual({ actor: 1, tombstone: 1, lateReceipt: 1 });
  });

  it("refuses cleanup before every exact receipt is terminal", async () => {
    const db = mongoose.connection.db;
    const runId = randomUUID();
    await db.collection("staging_ai_acceptance_claims").insertMany([
      { _id: runId, recordType: "run", runId, state: "revoked" },
      { _id: "unsettled", runId, receiptState: "admitted", expiresAt: new Date(Date.now() - 1) },
    ]);
    const exact = createExactCleanup({ db, runId, settlementWaitMs: 0 });
    exact.registerCapabilityJti("unsettled");
    await expect(exact.cleanup()).rejects.toMatchObject({ code: "STAGING_AI_RECOVERY_ADMITTED_UNKNOWN" });
    expect(await db.collection("staging_ai_acceptance_claims").countDocuments({ _id: "unsettled" })).toBe(1);
  });

  it("retains actors and tombstone when admission wins the atomic capability deletion race", async () => {
    const db = mongoose.connection.db;
    const runId = randomUUID();
    const actor = new mongoose.Types.ObjectId();
    const jti = randomUUID();
    await db.collection("users").insertOne({ _id: actor });
    await db.collection("staging_ai_acceptance_claims").insertOne({
      _id: jti, recordType: "capability", runId, receiptState: "issued", expiresAt: new Date(0),
    });
    const raceDb = {
      listCollections: (...args) => db.listCollections(...args),
      collection: (name) => {
        const collection = db.collection(name);
        if (name !== "staging_ai_acceptance_claims") return collection;
        return new Proxy(collection, {
          get: (target, property) => property === "deleteMany" ? async (...args) => {
            await target.updateOne({ _id: jti }, { $set: { receiptState: "admitted" } });
            return target.deleteMany(...args);
          } : typeof target[property] === "function" ? target[property].bind(target) : target[property],
        });
      },
    };
    const exact = createExactCleanup({ db: raceDb, runId });
    exact.registerUser(actor);
    exact.registerCapabilityJti(jti, 0);
    await expect(exact.cleanup()).rejects.toMatchObject({ code: "STAGING_AI_RECOVERY_ADMITTED_UNKNOWN" });
    expect({
      actor: await db.collection("users").countDocuments({ _id: actor }),
      receipt: await db.collection("staging_ai_acceptance_claims").countDocuments({ _id: jti, receiptState: "admitted" }),
      tombstone: await db.collection("staging_ai_acceptance_claims").countDocuments({ _id: runId, state: "revoked" }),
    }).toEqual({ actor: 1, receipt: 1, tombstone: 1 });
  });

  it("waits through the latest exact capability expiry before removing settled receipts", async () => {
    const db = mongoose.connection.db;
    const runId = randomUUID();
    const now = Date.now();
    const waits = [];
    await db.collection("staging_ai_acceptance_claims").insertMany([
      { _id: runId, recordType: "run", runId, state: "revoked" },
      { _id: "expiry-one", runId, receiptState: "settled", expiresAt: new Date(now + 10) },
      { _id: "expiry-two", runId, receiptState: "settled", expiresAt: new Date(now + 40) },
    ]);
    const exact = createExactCleanup({ db, runId, expirySkewMs: 0,
      now: () => now, wait: async (ms) => { waits.push(ms); } });
    exact.registerCapabilityJti("expiry-one");
    exact.registerCapabilityJti("expiry-two");
    await exact.cleanup();
    expect(waits).toEqual([40]);
    expect(await db.collection("staging_ai_acceptance_claims").countDocuments({ runId })).toBe(0);
  });

  it("rechecks receipt state after expiry before deleting a raced admission", async () => {
    const db = mongoose.connection.db;
    const runId = randomUUID();
    let tick = 0;
    const waits = [];
    await db.collection("staging_ai_acceptance_claims").insertMany([
      { _id: runId, recordType: "run", runId, state: "revoked" },
      { _id: "raced-admission", recordType: "capability", runId,
        receiptState: "issued", expiresAt: new Date(10) },
    ]);
    const exact = createExactCleanup({
      db,
      runId,
      settlementWaitMs: 50,
      settlementPollMs: 1,
      expirySkewMs: 0,
      now: () => tick,
      wait: async (ms) => {
        waits.push(ms);
        tick += ms;
        await db.collection("staging_ai_acceptance_claims").updateOne(
          { _id: "raced-admission" },
          { $set: { receiptState: tick === 10 ? "admitted" : "settled" } },
        );
      },
    });
    exact.registerCapabilityJti("raced-admission", 10);
    await exact.cleanup();
    expect({ waits, report: await exact.verify() }).toEqual({
      waits: [10, 1],
      report: expect.objectContaining({ residue: 0 }),
    });
  });

  it("cleans an issued capability that the runtime rejected before admission", async () => {
    const db = mongoose.connection.db;
    const runId = randomUUID();
    const userId = new mongoose.Types.ObjectId();
    await db.collection("users").insertOne({ _id: userId, email: `${userId}@example.invalid` });
    await db.collection("staging_ai_acceptance_claims").insertMany([
      { _id: runId, recordType: "run", runId, state: "revoked" },
      { _id: "issued-only", runId, receiptState: "issued", expiresAt: new Date(Date.now() - 1) },
    ]);
    const exact = createExactCleanup({ db, runId });
    exact.registerUser(userId);
    exact.registerCapabilityJti("issued-only");
    await exact.cleanup();
    expect(await exact.verify()).toMatchObject({ residue: 0 });
  });

  it("cleans exact fixtures when capability reservation has an unknown write outcome", async () => {
    const db = mongoose.connection.db;
    const runId = randomUUID();
    const userId = new mongoose.Types.ObjectId();
    await db.collection("users").insertOne({ _id: userId, email: `${userId}@example.invalid` });
    await db.collection("staging_ai_acceptance_claims").insertOne({
      _id: runId, recordType: "run", runId, state: "revoked",
    });
    const exact = createExactCleanup({ db, runId });
    exact.registerUser(userId);
    exact.registerCapabilityJti("missing-reservation", Date.now() - 1);
    await exact.cleanup();
    expect(await exact.verify()).toMatchObject({ residue: 0 });
  });

  it("discovers a response-lost KB id only through its pre-registered exact question", async () => {
    const db = mongoose.connection.db;
    const exactQuestion = `response-lost-${randomUUID()}`;
    const exact = createExactCleanup({ db, runId: randomUUID() });
    exact.registerKnowledgeQuestion(exactQuestion);
    await db.collection("knowledgeentries").insertMany([
      { normalizedQuestion: exactQuestion },
      { normalizedQuestion: `${exactQuestion}-unregistered` },
    ]);
    await exact.cleanup();
    expect(await db.collection("knowledgeentries").countDocuments({})).toBe(1);
  });

  it("waits through an outcome-unknown window before discovering a late KB write", async () => {
    const db = mongoose.connection.db;
    const exactQuestion = `late-${randomUUID()}`;
    const exact = createExactCleanup({ db, runId: randomUUID(), unknownOutcomeWaitMs: 80 });
    exact.registerKnowledgeQuestion(exactQuestion);
    exact.markMutationStart();
    setTimeout(() => {
      void db.collection("knowledgeentries").insertOne({ normalizedQuestion: exactQuestion });
    }, 30);
    await exact.cleanup();
    await expect(exact.verify()).rejects.toThrowError(/terminal remote mutation outcome/);
    expect(await db.collection("knowledgeentries").countDocuments({ normalizedQuestion: exactQuestion })).toBe(0);
  });
});
