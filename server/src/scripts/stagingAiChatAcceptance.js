import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import mongoose from "mongoose";

import User from "../models/User.js";
import { normalizeKnowledgeQuestion } from "../utils/knowledgeBase.js";
import { createAcceptanceIdentity, runWithVerifiedCleanup } from "./stagingAcceptanceSafety.js";
import { assertAcceptanceConfig, EXPECTED_API_ORIGIN, EXPECTED_CLIENT_URL } from "./stagingAiChatAcceptance.config.js";
import { createExactCleanup } from "./stagingAiChatAcceptance.cleanup.js";
import { assertHealthyVectorTopology, buildSafeEvidence, metricDelta } from "./stagingAiChatAcceptance.evidence.js";
import { createAccessToken, createApiClient, fetchMetrics, knowledgeFixtureQueries, normalizeQuery, searchKnowledgeFixture } from "./stagingAiChatAcceptance.http.js";
import { createTrackedKnowledgeFixture, deleteSettledFixtureJournal } from "./stagingAiChatAcceptance.fixture.js";
import { inspectStagingAiCatalogReadiness } from "./stagingAiCatalogReadiness.js";
import {
  runBrowserAcceptance,
  STAGING_AI_CHAT_ATTEMPT_PLAN,
} from "./stagingAiChatAcceptance.browser.js";
import {
  assertExpectedRuntime,
  runAfterRuntimePreflight,
  waitForHealthyVectorFixture,
} from "./stagingAiChatAcceptance.vector.js";

const SOURCE_URL = "https://www.who.int/news-room/fact-sheets/detail/physical-activity";
const isEntrypoint = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

const assert = (condition, message, code = "STAGING_AI_ACCEPTANCE_ASSERTION_FAILED") => {
  if (!condition) {
    const error = new Error(message);
    error.code = code;
    throw error;
  }
};

export const STAGING_AI_REQUEST_PURPOSES = Object.freeze([
  ...STAGING_AI_CHAT_ATTEMPT_PLAN.map((item) => item.purpose),
  "kb_search_root",
  "kb_search_variant",
]);

export const assertExactRequestInventory = (attempts) => {
  const expectedPurposes = new Set(STAGING_AI_REQUEST_PURPOSES);
  const purposes = Array.isArray(attempts) ? attempts.map((item) => item?.purpose) : [];
  const jtis = Array.isArray(attempts) ? attempts.map((item) => item?.jti) : [];
  const requestIds = Array.isArray(attempts) ? attempts.map((item) => item?.requestId) : [];
  assert(
    attempts?.length === expectedPurposes.size &&
      purposes.every((purpose) => expectedPurposes.has(purpose)) &&
      new Set(purposes).size === expectedPurposes.size &&
      jtis.every((value) => typeof value === "string" && value.length > 0) &&
      new Set(jtis).size === expectedPurposes.size &&
      requestIds.every((value) => typeof value === "string" && value.length > 0) &&
      new Set(requestIds).size === expectedPurposes.size,
    "AC-009 must register exactly nine unique counter-producing requests",
    "STAGING_AI_REQUEST_INVENTORY_FAILED",
  );
  return attempts;
};

const writeEvidence = async (output, evidence) => {
  const target = path.resolve(output);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx" });
};

const runtimeFingerprint = (runId, runtimeInstanceId) => crypto.createHash("sha256")
  .update(`${runId}:${runtimeInstanceId}`).digest("hex");

export const buildStagingAiRecoveryIntent = ({ releaseSha, runId, marker, createdAt }) => ({
  schemaVersion: 1,
  kind: "staging-ai-chat-recovery-intent",
  releaseSha,
  runId,
  marker,
  createdAt,
});

export const waitForSettledReceipts = async ({ collection, runId, attempts, runtimeInstanceId, releaseSha }) => {
  const deadline = Date.now() + 30_000;
  let receipts = [];
  const expected = new Map(attempts.map((item) => [item.jti, item]));
  while (Date.now() < deadline) {
    receipts = await collection.find({ runId, recordType: "capability" }).toArray();
    assert(receipts.every((item) => expected.has(String(item._id))),
      "Acceptance run contains a receipt outside the exact request inventory",
      "STAGING_AI_REQUEST_INVENTORY_FAILED");
    if (receipts.length === attempts.length && receipts.every((item) => item.receiptState === "settled")) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert(receipts.length === attempts.length && receipts.every((item) => item.receiptState === "settled"),
    "Every registered request receipt must settle before metrics-after", "STAGING_AI_RECEIPT_UNSETTLED");
  const byJti = new Map(receipts.map((item) => [String(item._id), item]));
  const fingerprint = runtimeFingerprint(runId, runtimeInstanceId);
  return attempts.map((attempt) => {
    const receipt = byJti.get(attempt.jti);
    assert(receipt && receipt.action === attempt.action && receipt.purpose === attempt.purpose &&
      receipt.mode === attempt.mode && receipt.requestId === attempt.requestId &&
      receipt.releaseSha === releaseSha && receipt.runtimeInstanceId === runtimeInstanceId &&
      receipt.receiptState === "settled" && receipt.outcome === attempt.outcome &&
      receipt.admittedAt && receipt.settledAt,
    "Receipt did not match its exact request cohort contract", "STAGING_AI_RECEIPT_MISMATCH");
    return {
      purpose: receipt.purpose, action: receipt.action, mode: receipt.mode, outcome: receipt.outcome,
      jti: receipt._id, requestId: receipt.requestId, releaseSha: receipt.releaseSha,
      runtimeFingerprint: fingerprint, admittedAt: new Date(receipt.admittedAt).toISOString(),
      settledAt: new Date(receipt.settledAt).toISOString(), receiptState: receipt.receiptState,
    };
  });
};

export const runStagingAiChatAcceptance = async ({ env = process.env } = {}) => {
  const config = assertAcceptanceConfig(env);
  const startedAt = new Date().toISOString();
  const { runId, marker } = createAcceptanceIdentity({ runId: env.STAGING_ACCEPTANCE_RUN_ID || undefined });
  const state = {
    releaseSha: config.releaseSha,
    runId,
    startedAt,
    completedAt: null,
    status: "failed",
    sourceUrl: SOURCE_URL,
    syntheticIds: { userId: null, adminUserId: null, kbEntryId: null, capabilityJtis: [] },
    assertions: [],
    lanes: [],
    metricsDelta: {},
    metricsSnapshots: null,
    runtimeBinding: null,
    catalogReadiness: null,
    cleanup: null,
    error: null,
  };
  const recoveryOutput = path.resolve(env.STAGING_AI_ACCEPTANCE_RECOVERY_OUTPUT);
  const evidenceOutput = path.resolve(env.STAGING_AI_ACCEPTANCE_OUTPUT);
  assert(recoveryOutput !== evidenceOutput,
    "Staging AI recovery intent and final evidence paths must be distinct");
  const recoveryIntent = buildStagingAiRecoveryIntent({
    releaseSha: config.releaseSha,
    runId,
    marker,
    createdAt: startedAt,
  });
  await writeEvidence(recoveryOutput, recoveryIntent);
  // This complete schema is safe to copy from Actions logs when a runner is
  // lost before the always-upload step can retain the local intent file.
  process.stdout.write(`${JSON.stringify(recoveryIntent)}\n`);
  let operationError = null;
  let connected = false;

  try {
    await mongoose.connect(env.MONGO_URI, { autoIndex: false });
    connected = true;
    assert(mongoose.connection.db?.databaseName === "htcoaching_staging", "Connected database is not exactly htcoaching_staging");
    state.assertions.push({ name: "exact staging identity", passed: true });
    state.catalogReadiness = await inspectStagingAiCatalogReadiness({
      db: mongoose.connection.db,
    });
    assert(
      state.catalogReadiness.ready,
      `Staging AI catalog is not ready: ${state.catalogReadiness.gaps.join(", ")}`,
      "STAGING_AI_CATALOG_NOT_READY",
    );
    const capability = await import("../services/ai/stagingAiAcceptance.service.js");
    const { chromium } = await import("@playwright/test");
    const exact = createExactCleanup({
      db: mongoose.connection.db,
      runId,
      controlCollection: capability.STAGING_AI_ACCEPTANCE_COLLECTION,
      retainRunTombstone: true,
      requireFixtureCreateProof: true,
      releaseSha: config.releaseSha,
    });
    const result = await runWithVerifiedCleanup({
      execute: async () => {
        const syntheticId = new mongoose.Types.ObjectId();
        const syntheticAdminId = new mongoose.Types.ObjectId();
        exact.registerUser(syntheticId);
        exact.registerUser(syntheticAdminId);
        state.syntheticIds.userId = syntheticId.toString();
        state.syntheticIds.adminUserId = syntheticAdminId.toString();
        const user = new User({
          _id: syntheticId,
          name: `AC009 ${runId.slice(0, 8)}`,
          email: `ac009.${runId}@example.invalid`,
          role: "user",
        });
        await user.save();
        const admin = new User({
          _id: syntheticAdminId,
          name: `AC009 Admin ${runId.slice(0, 8)}`,
          email: `ac009-admin.${runId}@example.invalid`,
          role: "admin",
        });
        await admin.save();

        const adminApi = createApiClient({
          origin: EXPECTED_API_ORIGIN,
          accessToken: createAccessToken(admin, env.JWT_SECRET),
        });
        const userApi = createApiClient({
          origin: EXPECTED_API_ORIGIN,
          accessToken: createAccessToken(user, env.JWT_SECRET),
        });
        const attempts = [];
        const registerAttempt = (attempt) => {
          assert(!attempts.some((item) => item.jti === attempt.jti || item.requestId === attempt.requestId),
            "Request cohort contains duplicate JTI or request ID", "STAGING_AI_REQUEST_INVENTORY_FAILED");
          attempts.push(attempt);
        };
        const issueRegisteredCapability = async (options) => {
          const token = capability.issueStagingAiAcceptance(options, { env });
          const conservativeExpiry = Date.now() + (Number(options.ttlSeconds || 300) + 1) * 1000;
          exact.registerCapabilityJti(options.jti, conservativeExpiry);
          state.syntheticIds.capabilityJtis.push(options.jti);
          await capability.registerStagingAiAcceptanceCapability(token, { env });
          return token;
        };
        const { question: expectedQuestion } = knowledgeFixtureQueries(marker);
        exact.registerKnowledgeQuestion(normalizeKnowledgeQuestion(expectedQuestion));
        const { runtime, result: fixture } = await runAfterRuntimePreflight({
          fetchSnapshot: () => fetchMetrics(adminApi),
          expectedReleaseSha: config.releaseSha,
          execute: async () => {
            exact.markMutationStart();
            try {
              const createdFixture = await createTrackedKnowledgeFixture({
                collection: mongoose.connection.db.collection(capability.STAGING_AI_ACCEPTANCE_COLLECTION),
                api: adminApi, marker, sourceUrl: SOURCE_URL, runId,
                releaseSha: config.releaseSha, actorId: syntheticAdminId.toString(),
              });
              exact.markMutationSettled();
              return createdFixture;
            } catch (error) {
              if (error?.remoteOutcomeKnown === true) exact.markMutationSettled();
              throw error;
            }
          },
        });
        exact.registerKnowledgeEntry(fixture.id);
        state.syntheticIds.kbEntryId = fixture.id;
        assert(fixture.embeddingVersion === env.EXPECTED_KB_EMBEDDING_VERSION, "Knowledge fixture embedding version is not the locked staging target");
        state.assertions.push({ name: "reviewed published KB embedding", passed: true });

        // Atlas Search indexes new documents asynchronously. Keep readiness
        // probes outside the certified exact-nine metrics/receipt cohort.
        const beforeMetrics = await waitForHealthyVectorFixture({
          fetchSnapshot: ({ signal }) => fetchMetrics(adminApi, { signal }),
          search: async (query, { signal }) => (await searchKnowledgeFixture({
            api: adminApi,
            clientOrigin: EXPECTED_CLIENT_URL,
            query,
            signal,
          })).response,
          fixtureId: fixture.id,
          queries: [fixture.question, fixture.variant],
          expectedReleaseSha: config.releaseSha,
          expectedRuntimeInstanceId: runtime.runtimeInstanceId,
        });
        assertExpectedRuntime(beforeMetrics, {
          expectedReleaseSha: config.releaseSha,
          expectedRuntimeInstanceId: runtime.runtimeInstanceId,
        });

        for (const [purpose, query] of [["kb_search_root", fixture.question], ["kb_search_variant", fixture.variant]]) {
          const requestId = crypto.randomUUID();
          const jti = crypto.randomUUID();
          const capabilityOptions = {
            releaseSha: config.releaseSha, runtimeInstanceId: runtime.runtimeInstanceId, runId, actorId: syntheticAdminId.toString(),
            action: "kb_search", purpose, mode: "observe_only", request: {
              query: { q: normalizeQuery(query), threshold: "0.75", limit: "3" }, requestId,
            }, jti, ttlSeconds: 30,
          };
          const token = await issueRegisteredCapability(capabilityOptions);
          registerAttempt({ purpose, action: "kb_search", mode: "observe_only", outcome: "completed", jti, requestId });
          const { response: search } = await searchKnowledgeFixture({
            api: adminApi,
            clientOrigin: EXPECTED_CLIENT_URL,
            query,
            token,
            requestId,
          });
          assert(search?.data?.some((entry) => String(entry._id) === fixture.id), "Exact fixture was not found by healthy semantic search");
        }

        exact.markMutationStart();
        const browserResult = await runBrowserAcceptance({
          chromium,
          clientUrl: EXPECTED_CLIENT_URL,
          apiOrigin: EXPECTED_API_ORIGIN,
          accessToken: createAccessToken(user, env.JWT_SECRET),
          csrfToken: userApi.csrfToken,
          actorId: syntheticId.toString(),
          ownerObjectId: syntheticId,
          releaseSha: config.releaseSha,
          runtimeInstanceId: runtime.runtimeInstanceId,
          runId,
          fixture,
          sourceUrl: SOURCE_URL,
          prefix: capability.STAGING_AI_ACCEPTANCE_PREFIX,
          lateSuffix: capability.STAGING_AI_ACCEPTANCE_LATE_SUFFIX,
          issueCapability: issueRegisteredCapability,
          onAttempt: (attempt) => registerAttempt({ ...attempt, outcome: attempt.mode === "paced_response" && attempt.purpose === "stop" ? "aborted" : attempt.mode === "provider_failure_before_llm" ? "failed" : "completed" }),
          db: mongoose.connection.db,
          onLaneResult: (lane) => state.lanes.push(lane),
        });
        exact.markMutationSettled();
        assertExactRequestInventory(attempts);
        const receiptAttempts = await waitForSettledReceipts({
          collection: mongoose.connection.db.collection(capability.STAGING_AI_ACCEPTANCE_COLLECTION), runId, attempts,
          runtimeInstanceId: runtime.runtimeInstanceId, releaseSha: config.releaseSha,
        });
        state.lanes.push({ name: "request-cohort-runtime-binding", passed: true });

        const conversations = await mongoose.connection.db.collection("chatconversations")
          .find({ userId: syntheticId }, { projection: { messages: 1, activeStreamId: 1 } })
          .toArray();
        assert(conversations.every((item) => item.activeStreamId == null), "A synthetic conversation retained an active stream");
        const sourcedAnswers = conversations.flatMap((item) => item.messages || []).filter(
          (message) => message.role === "assistant" &&
            message.answerTrace?.evidenceMode === "internal_kb" &&
            message.answerTrace?.webSearchUsed === false &&
            message.answerTrace?.kbEntryIds?.some((id) => String(id) === fixture.id),
        );
        const assistantById = new Map(conversations.flatMap((item) => item.messages || [])
          .flatMap((message, index, messages) => message.role === "assistant"
            ? [[String(message._id), { message, precedingUser: messages.slice(0, index).findLast((item) => item.role === "user") }]]
            : []));
        const uiDbMatches = browserResult.uiAssistantEvidence.map((observed) => {
          const persistedPair = assistantById.get(observed.assistantId);
          const persisted = persistedPair?.message;
          const contentDigest = persisted
            ? crypto.createHash("sha256").update(String(persisted.content || "")).digest("hex")
            : null;
          const questionDigest = persistedPair
            ? crypto.createHash("sha256").update(String(persistedPair.precedingUser?.content || "")).digest("hex")
            : null;
          return Boolean(
            persisted && observed.renderedMessageId === observed.assistantId &&
            observed.renderedContentLength > 0 && contentDigest === observed.contentDigest &&
            questionDigest === observed.questionDigest &&
            persisted.answerTrace?.evidenceMode === "internal_kb" &&
            persisted.answerTrace?.webSearchUsed === false &&
            persisted.answerTrace?.kbEntryIds?.some((id) => String(id) === fixture.id),
          );
        });
        const uniqueAssistantIds = new Set(browserResult.uiAssistantEvidence.map((item) => item.assistantId));
        assert(sourcedAnswers.length >= 3 && uiDbMatches.length >= 3 && uniqueAssistantIds.size === uiDbMatches.length && uiDbMatches.every(Boolean), "Positive/recovery UI assistant identities did not match unique persisted KB provenance/content");
        state.assertions.push({ name: "live UI and Mongo provenance correspondence", passed: true });

        const afterMetrics = await fetchMetrics(adminApi);
        assert(afterMetrics.runtimeInstanceId === runtime.runtimeInstanceId &&
          afterMetrics.runtimeReleaseSha === runtime.runtimeReleaseSha,
        "Metrics-after did not remain on the admitted runtime", "STAGING_AI_METRICS_INCONCLUSIVE");
        const metricsBeforeAt = new Date(beforeMetrics.generatedAt).getTime();
        const metricsAfterAt = new Date(afterMetrics.generatedAt).getTime();
        assert(Number.isFinite(metricsBeforeAt) && Number.isFinite(metricsAfterAt) && metricsAfterAt >= metricsBeforeAt &&
          receiptAttempts.every((item) => new Date(item.admittedAt).getTime() >= metricsBeforeAt &&
            new Date(item.settledAt).getTime() <= metricsAfterAt),
        "Metrics snapshots did not bracket every settled receipt", "STAGING_AI_METRICS_INCONCLUSIVE");
        state.metricsDelta = metricDelta(beforeMetrics, afterMetrics);
        const cohortRuntimeFingerprint = runtimeFingerprint(runId, runtime.runtimeInstanceId);
        state.metricsSnapshots = {
          before: {
            generatedAt: beforeMetrics.generatedAt,
            releaseSha: beforeMetrics.runtimeReleaseSha,
            runtimeFingerprint: cohortRuntimeFingerprint,
            counters: beforeMetrics.counters,
          },
          after: {
            generatedAt: afterMetrics.generatedAt,
            releaseSha: afterMetrics.runtimeReleaseSha,
            runtimeFingerprint: cohortRuntimeFingerprint,
            counters: afterMetrics.counters,
          },
        };
        assertHealthyVectorTopology(state.metricsDelta);
        state.assertions.push({ name: "metrics snapshots conclusive without reset", passed: true });
        state.assertions.push({ name: "request cohort bound to one runtime", passed: true });
        state.runtimeBinding = {
          proof: "request_cohort", releaseSha: config.releaseSha,
          runtimeFingerprint: cohortRuntimeFingerprint,
          metricsBeforeAt: new Date(metricsBeforeAt).toISOString(),
          metricsAfterAt: new Date(metricsAfterAt).toISOString(),
          attempts: receiptAttempts,
        };
        return true;
      },
      cleanup: async () => {
        await capability.revokeStagingAiAcceptanceRun(runId);
        await exact.cleanup();
        const provisional = await exact.verify({ allowFixtureJournal: true });
        assert(provisional.residue === 0, "Fixture journal retained because data cleanup is incomplete");
        await deleteSettledFixtureJournal({
          collection: mongoose.connection.db.collection(capability.STAGING_AI_ACCEPTANCE_COLLECTION),
          runId, releaseSha: config.releaseSha, marker,
        });
        await exact.deleteRunTombstone();
      },
      verify: exact.verify,
    });
    state.cleanup = result.cleanup;
    state.status = "passed";
  } catch (error) {
    operationError = error;
    state.error = error;
    state.cleanup = error.cleanup || {
      verified: false,
      residue: null,
      outcomeUnknown: true,
    };
  } finally {
    if (connected || mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
  state.completedAt = new Date().toISOString();
  const evidence = buildSafeEvidence(state);
  await writeEvidence(evidenceOutput, evidence);
  if (operationError) throw operationError;
  return evidence;
};

if (isEntrypoint) {
  runStagingAiChatAcceptance()
    .then(() => process.stdout.write("Staging AI acceptance passed with verified cleanup.\n"))
    .catch(() => {
      process.stderr.write("Staging AI acceptance failed; sanitized evidence is written only after safe initialization.\n");
      process.exitCode = 1;
    });
}
