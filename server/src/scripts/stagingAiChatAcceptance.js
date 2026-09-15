import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import mongoose from "mongoose";

import User from "../models/User.js";
import { normalizeKnowledgeQuestion } from "../utils/knowledgeBase.js";
import { createAcceptanceIdentity, runWithVerifiedCleanup } from "./stagingAcceptanceSafety.js";
import { assertAcceptanceConfig, EXPECTED_API_ORIGIN, EXPECTED_CLIENT_URL, validateTopologyEvidence } from "./stagingAiChatAcceptance.config.js";
import { createExactCleanup } from "./stagingAiChatAcceptance.cleanup.js";
import { assertHealthyVectorTopology, buildSafeEvidence, metricDelta } from "./stagingAiChatAcceptance.evidence.js";
import { createAccessToken, createApiClient, createKnowledgeFixture, fetchMetrics, knowledgeFixtureQueries } from "./stagingAiChatAcceptance.http.js";
import { runBrowserAcceptance } from "./stagingAiChatAcceptance.browser.js";

const SOURCE_URL = "https://www.who.int/news-room/fact-sheets/detail/physical-activity";
const isEntrypoint = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

const assert = (condition, message, code = "STAGING_AI_ACCEPTANCE_ASSERTION_FAILED") => {
  if (!condition) {
    const error = new Error(message);
    error.code = code;
    throw error;
  }
};

const writeEvidence = async (output, evidence) => {
  const target = path.resolve(output);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx" });
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
    syntheticIds: { userId: null, kbEntryId: null, capabilityJtis: [] },
    assertions: [],
    lanes: [],
    metricsDelta: {},
    cleanup: null,
    error: null,
  };
  const recoveryOutput = path.resolve(env.STAGING_AI_ACCEPTANCE_RECOVERY_OUTPUT);
  const evidenceOutput = path.resolve(env.STAGING_AI_ACCEPTANCE_OUTPUT);
  assert(recoveryOutput !== evidenceOutput,
    "Staging AI recovery intent and final evidence paths must be distinct");
  await writeEvidence(recoveryOutput, {
    schemaVersion: 1,
    kind: "staging-ai-chat-recovery-intent",
    releaseSha: config.releaseSha,
    runId,
    marker,
    createdAt: startedAt,
  });
  process.stdout.write(`${JSON.stringify({
    kind: "staging-ai-chat-recovery-intent",
    releaseSha: config.releaseSha,
    runId,
  })}\n`);
  let operationError = null;
  let connected = false;

  try {
    const topologyDocument = JSON.parse(
      await fs.readFile(path.resolve(env.STAGING_RENDER_TOPOLOGY_EVIDENCE), "utf8"),
    );
    const topologyEvidence = validateTopologyEvidence(topologyDocument, config.releaseSha);
    await mongoose.connect(env.MONGO_URI, { autoIndex: false });
    connected = true;
    assert(mongoose.connection.db?.databaseName === "htcoaching_staging", "Connected database is not exactly htcoaching_staging");
    state.assertions.push({ name: "exact staging identity", passed: true });
    const capability = await import("../services/ai/stagingAiAcceptance.service.js");
    const { chromium } = await import("@playwright/test");
    const exact = createExactCleanup({
      db: mongoose.connection.db,
      runId,
      controlCollection: capability.STAGING_AI_ACCEPTANCE_COLLECTION,
    });
    const result = await runWithVerifiedCleanup({
      execute: async () => {
        const adminEmails = String(env.ADMIN_EMAIL).split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
        const admin = await User.findOne({ email: { $in: adminEmails }, role: "admin" })
          .select("_id role")
          .lean();
        assert(admin, "ADMIN_EMAIL did not resolve to an admin", "STAGING_AI_ADMIN_NOT_FOUND");
        const syntheticId = new mongoose.Types.ObjectId();
        exact.registerUser(syntheticId);
        state.syntheticIds.userId = syntheticId.toString();
        const user = new User({
          _id: syntheticId,
          name: `AC009 ${runId.slice(0, 8)}`,
          email: `ac009.${runId}@example.invalid`,
          role: "user",
        });
        await user.save();

        const adminApi = createApiClient({
          origin: EXPECTED_API_ORIGIN,
          accessToken: createAccessToken(admin, env.JWT_SECRET),
        });
        const userApi = createApiClient({
          origin: EXPECTED_API_ORIGIN,
          accessToken: createAccessToken(user, env.JWT_SECRET),
        });
        const beforeMetrics = await fetchMetrics(adminApi);
        const { question: expectedQuestion } = knowledgeFixtureQueries(marker);
        exact.registerKnowledgeQuestion(normalizeKnowledgeQuestion(expectedQuestion));
        exact.markMutationStart();
        const fixture = await createKnowledgeFixture({ api: adminApi, marker, sourceUrl: SOURCE_URL });
        exact.markMutationSettled();
        exact.registerKnowledgeEntry(fixture.id);
        state.syntheticIds.kbEntryId = fixture.id;
        assert(fixture.embeddingVersion === env.EXPECTED_KB_EMBEDDING_VERSION, "Knowledge fixture embedding version is not the locked staging target");
        state.assertions.push({ name: "reviewed published KB embedding", passed: true });

        for (const query of [fixture.question, fixture.variant]) {
          const search = await adminApi.request(
            `/api/knowledge-base/search?q=${encodeURIComponent(query)}&threshold=0.75&limit=3`,
          );
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
          runId,
          fixture,
          sourceUrl: SOURCE_URL,
          prefix: capability.STAGING_AI_ACCEPTANCE_PREFIX,
          lateSuffix: capability.STAGING_AI_ACCEPTANCE_LATE_SUFFIX,
          issueCapability: capability.issueStagingAiAcceptance,
          registerCapabilityJti: (jti) => {
            exact.registerCapabilityJti(jti);
            state.syntheticIds.capabilityJtis.push(jti);
          },
          db: mongoose.connection.db,
          onLaneResult: (lane) => state.lanes.push(lane),
        });
        exact.markMutationSettled();
        state.lanes.push({
          name: "metrics-single-instance-topology",
          passed: true,
          observedTopology: `${topologyEvidence.topology}; checkedAt=${topologyEvidence.checkedAt}`,
        });

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
        state.metricsDelta = metricDelta(beforeMetrics, afterMetrics);
        assertHealthyVectorTopology(state.metricsDelta);
        state.assertions.push({ name: "metrics snapshots conclusive without reset", passed: true });
        return true;
      },
      cleanup: exact.cleanup,
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
