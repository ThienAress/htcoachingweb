import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import mongoose from "mongoose";
import User from "../models/User.js";
import ChatConversation from "../models/ChatConversation.js";
import { validateStagingOperation } from "../config/stagingOperationSafety.js";
import { inspectStagingAiCatalogReadiness } from "./stagingAiCatalogReadiness.js";
import { createAcceptanceIdentity, runWithVerifiedCleanup } from "./stagingAcceptanceSafety.js";
import { createExactCleanup } from "./stagingAiChatAcceptance.cleanup.js";
import { createApiClient, createAccessToken, fetchMetrics } from "./stagingAiChatAcceptance.http.js";
import { EXPECTED_API_ORIGIN, EXPECTED_CLIENT_URL } from "./stagingAiChatAcceptance.config.js";
import { evaluateSemanticOutput } from "../services/ai/evals/semanticOutputEvaluator.js";
import { sanitizeAssistantOutput } from "../services/ai/assistantOutput.js";
import { reliabilityPlan } from "./stagingAiReliabilityAcceptance.plan.js";
import { createReliabilityClient } from "./stagingAiReliabilityAcceptance.http.js";
import { buildSafeReliabilityEvidence, providerDelta } from "./stagingAiReliabilityAcceptance.evidence.js";

const SHA = /^[a-f0-9]{40}$/;
const isEntrypoint = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
const fail = (code) => {
  const error = new Error(code);
  error.code = code;
  throw error;
};
const check = (condition, code) => { if (!condition) fail(code); };
const writeOnce = async (target, value) => {
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
};
const canonicalJson = (value) => Array.isArray(value)
  ? `[${value.map(canonicalJson).join(",")}]`
  : value && typeof value === "object"
    ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`
    : JSON.stringify(value);

export const reliabilityCardsEqual = (left, right) => canonicalJson(left) === canonicalJson(right);
const seedDeficitContext = async ({ userId, conversationId }) => {
  const conversation = new ChatConversation({
    _id: conversationId, userId,
    title: "Kế hoạch thử nghiệm 300 kcal",
    messages: [
      { role: "user", content: "Lập kế hoạch tập 4 ngày và ăn uống với mức thâm hụt 300 kcal." },
      { role: "assistant", content: "Kế hoạch 4 buổi: Buổi 1 thân trên, Buổi 2 thân dưới, Buổi 3 thân trên, Buổi 4 thân dưới. Ăn đủ protein và rau; mức thâm hụt là 300 kcal. Các phần khác của kế hoạch giữ nguyên khi chỉ đổi mức thâm hụt." },
    ],
    messageCount: 2,
  });
  await conversation.save();
  return String(conversation._id);
};

export const assertReliabilityConfig = (env = process.env) => {
  const staging = validateStagingOperation({ env, confirmationVariable: "CONFIRM_STAGING_AI_RELIABILITY" });
  const dbName = (() => {
    try { return decodeURIComponent(new URL(env.MONGO_URI).pathname).replace(/^\/+/, "").split("/", 1)[0]; }
    catch { return ""; }
  })();
  check(staging.valid && env.APP_ENV === "staging" && dbName === "htcoaching_staging" &&
    env.CLIENT_URL === EXPECTED_CLIENT_URL && env.PUBLIC_API_ORIGIN === EXPECTED_API_ORIGIN &&
    SHA.test(env.RELEASE_SHA || "") && env.RENDER_GIT_COMMIT === env.RELEASE_SHA &&
    Boolean(env.JWT_SECRET) && Boolean(env.STAGING_AI_RELIABILITY_OUTPUT) &&
    Boolean(env.STAGING_AI_RELIABILITY_RECOVERY_OUTPUT), "STAGING_AI_RELIABILITY_CONFIG_REJECTED");
  const output = path.resolve(env.STAGING_AI_RELIABILITY_OUTPUT);
  const recoveryOutput = path.resolve(env.STAGING_AI_RELIABILITY_RECOVERY_OUTPUT);
  check(output !== recoveryOutput, "STAGING_AI_RELIABILITY_CONFIG_REJECTED");
  return { releaseSha: env.RELEASE_SHA, output, recoveryOutput };
};

const inspectTurn = async ({ db, userId, conversationId, requestId, message, stream, plan }) => {
  const conversation = await db.collection("chatconversations").findOne(
    { _id: new mongoose.Types.ObjectId(conversationId), userId },
    { projection: { userId: 1, activeStreamId: 1, recentRequestIds: 1, messages: 1 } },
  );
  check(conversation && conversation.activeStreamId == null &&
    conversation.recentRequestIds?.includes(requestId),
    "STAGING_AI_RELIABILITY_PERSISTENCE_FAILED");
  const messages = conversation.messages || [];
  const userIndex = messages.findLastIndex((item) => item.role === "user" && item.content === message);
  check(userIndex >= 0, "STAGING_AI_RELIABILITY_PERSISTENCE_FAILED");
  const turn = messages.slice(userIndex + 1);
  const assistantMessages = turn.filter((item) => item.role === "assistant" && String(item.content || "").trim());
  check(assistantMessages.length === 1, "STAGING_AI_RELIABILITY_PERSISTENCE_FAILED");
  const assistant = assistantMessages[0];
  check(assistant && assistant.content === stream.text && assistant.answerTrace,
    "STAGING_AI_RELIABILITY_PERSISTENCE_FAILED");
  const trace = assistant.answerTrace;
  for (const [key, expected] of [["routeDomain", plan.expectedPath.domain], ["evidenceMode", plan.expectedPath.evidence]]) {
    if (expected !== undefined) check(trace[key] === expected, "STAGING_AI_RELIABILITY_ROUTE_FAILED");
  }
  if (plan.expectedPath.webSearchRequired === true) {
    check(trace.webSearchOutcome === "grounded", "STAGING_AI_RELIABILITY_WEB_EVIDENCE_FAILED");
  } else if (plan.expectedPath.maxWebSearchCalls === 0) {
    check(trace.webSearchOutcome === "not_called", "STAGING_AI_RELIABILITY_WEB_EVIDENCE_FAILED");
  }
  const tools = turn.filter((item) => item.role === "tool").map((item) => ({
    name: item.toolName, status: item.toolStatus,
  }));
  if (plan.expectedPath.preferredTool) {
    check(tools.some((item) => item.name === plan.expectedPath.preferredTool && item.status === "success") &&
      stream.toolResults > 0, "STAGING_AI_RELIABILITY_TOOL_FAILED");
  }
  const persistedCards = turn.filter((item) => item.uiCard)
    .map((item) => ({ cardType: item.uiCard.cardType, data: item.uiCard.data }));
  check(stream.cards.length === persistedCards.length &&
    stream.cards.every((card) => persistedCards.some((saved) =>
      reliabilityCardsEqual(saved, card))), "STAGING_AI_RELIABILITY_CARD_FAILED");
  const failures = evaluateSemanticOutput({
    output: { text: assistant.content, cards: stream.cards, trace }, rules: plan.rules,
  });
  check(failures.length === 0, "STAGING_AI_RELIABILITY_SEMANTIC_FAILED");
  if (plan.number === 6) {
    check(/(?:10[., ]?000|mười nghìn|bước)/iu.test(assistant.content) &&
      /(?:60|90|phút|tập)/iu.test(assistant.content),
    "STAGING_AI_RELIABILITY_CONTEXT_FAILED");
  }
  const sanitized = sanitizeAssistantOutput(assistant.content);
  check(!sanitized.protocolLeak && sanitized.content === assistant.content.trim() &&
    !/^(?:có lỗi xảy ra|dịch vụ ai đang tạm gián đoạn|ht assistant phản hồi quá lâu|mình chưa thể hoàn tất yêu cầu này|mình chưa thể tạo lịch tập đáp ứng)/iu
      .test(assistant.content.trim()),
    "STAGING_AI_RELIABILITY_OUTPUT_FAILED");
  return { trace, tools, modelClass: /^gemini[-\w.]{1,90}$/i.test(trace.model || "")
    ? "gemini_configured" : "static_or_other" };
};

export const runStagingAiReliabilityAcceptance = async ({ env = process.env, deps = {} } = {}) => {
  const config = assertReliabilityConfig(env);
  const plan = reliabilityPlan();
  const { runId } = createAcceptanceIdentity({ runId: env.STAGING_AI_RELIABILITY_RUN_ID || undefined });
  const userId = new mongoose.Types.ObjectId();
  const adminUserId = new mongoose.Types.ObjectId();
  const seededConversationId = new mongoose.Types.ObjectId();
  const state = {
    runId, releaseSha: config.releaseSha, userId: String(userId), adminUserId: String(adminUserId),
    startedAt: new Date().toISOString(), completedAt: null, status: "failed",
    runtimeFingerprint: null, prompts: [], cleanup: null, error: null,
  };
  try { await fs.access(config.output); fail("STAGING_AI_RELIABILITY_OUTPUT_EXISTS"); }
  catch (error) { if (error?.code !== "ENOENT") throw error; }
  await writeOnce(config.recoveryOutput, {
    schemaVersion: 1, kind: "staging-ai-reliability-recovery-intent", releaseSha: config.releaseSha,
    runId, userId: String(userId), adminUserId: String(adminUserId),
    seededConversationId: String(seededConversationId), createdAt: state.startedAt,
  });
  let connected = false;
  let operationError = null;
  try {
    const connection = deps.connection || mongoose;
    await connection.connect(env.MONGO_URI, { autoIndex: false });
    connected = true;
    const db = connection.connection.db;
    check(db?.databaseName === "htcoaching_staging", "STAGING_AI_RELIABILITY_DATABASE_MISMATCH");
    const readiness = await (deps.inspectReadiness || inspectStagingAiCatalogReadiness)({ db });
    check(readiness.ready === true, "STAGING_AI_RELIABILITY_CATALOG_NOT_READY");
    const exact = (deps.createCleanup || createExactCleanup)({ db, runId });
    exact.registerUser(userId);
    exact.registerUser(adminUserId);
    let outcomeUnknown = false;
    const result = await runWithVerifiedCleanup({
      execute: async () => {
        exact.markMutationStart();
        const user = new User({ _id: userId, name: `Reliability ${runId.slice(0, 8)}`,
          email: `reliability.${runId}@example.invalid`, role: "user" });
        const admin = new User({ _id: adminUserId, name: `Reliability Admin ${runId.slice(0, 8)}`,
          email: `reliability-admin.${runId}@example.invalid`, role: "admin" });
        try {
          await (deps.saveUser || ((item) => item.save()))(user);
          await (deps.saveUser || ((item) => item.save()))(admin);
        } catch (error) {
          outcomeUnknown = true;
          throw error;
        }
        exact.markMutationSettled();
        const adminApi = createApiClient({ origin: EXPECTED_API_ORIGIN,
          accessToken: createAccessToken(admin, env.JWT_SECRET) });
        const chat = (deps.createClient || createReliabilityClient)({ origin: EXPECTED_API_ORIGIN,
          user, jwtSecret: env.JWT_SECRET });
        let snapshot = await (deps.fetchMetrics || fetchMetrics)(adminApi);
        check(snapshot.runtimeReleaseSha === config.releaseSha,
          "STAGING_AI_RELIABILITY_RUNTIME_DRIFT");
        state.runtimeFingerprint = crypto.createHash("sha256")
          .update(`${runId}:${snapshot.runtimeInstanceId}`).digest("hex");
        const conversations = new Map();
        const dispatchOrder = [1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 6];
        const byNumber = new Map(plan.map((item) => [item.number, item]));
        for (const number of dispatchOrder) {
          const item = byNumber.get(number);
          const requestId = crypto.randomUUID();
          let preceding = item.followUpTo ? conversations.get(item.followUpTo) : null;
          if (number === 4) {
            exact.markMutationStart();
            try { preceding = await (deps.seedContext || seedDeficitContext)({
              userId, conversationId: seededConversationId,
            }); }
            catch (error) { outcomeUnknown = true; throw error; }
            exact.markMutationSettled();
            check(preceding === String(seededConversationId),
              "STAGING_AI_RELIABILITY_CONTEXT_FAILED");
          }
          if (item.followUpTo || number === 4) {
            check(/^[a-f0-9]{24}$/i.test(preceding || ""),
              "STAGING_AI_RELIABILITY_CONTEXT_FAILED");
          }
          const started = Date.now();
          const request = { message: item.message, requestId, conversationId: preceding };
          state.prompts.push({ number: item.number, scenarioId: item.scenarioId, requestId,
            conversationId: preceding || null, contextSource: number === 4 ? "synthetic_300_kcal_plan"
              : item.followUpTo ? "prior_live_turn" : "new_conversation",
            semanticPassed: false, persisted: false });
          exact.markMutationStart();
          let stream;
          try { stream = await chat(request); }
          catch (error) { outcomeUnknown = true; throw error; }
          exact.markMutationSettled();
          check(!preceding || stream.conversationId === preceding,
            "STAGING_AI_RELIABILITY_CONTEXT_FAILED");
          check(preceding || ![...conversations.values()].includes(stream.conversationId),
            "STAGING_AI_RELIABILITY_CONTEXT_FAILED");
          conversations.set(item.number, stream.conversationId);
          const observed = state.prompts.at(-1);
          observed.conversationId = stream.conversationId;
          observed.latencyMs = Date.now() - started;
          const persisted = await (deps.inspectTurn || inspectTurn)({ db, userId,
            conversationId: stream.conversationId, requestId, message: item.message, stream, plan: item });
          observed.persisted = true;
          observed.semanticPassed = true;
          observed.routeDomain = persisted.trace.routeDomain;
          observed.evidenceMode = persisted.trace.evidenceMode;
          observed.webSearchOutcome = persisted.trace.webSearchOutcome;
          observed.tools = persisted.tools;
          observed.modelClass = persisted.modelClass;
          const nextSnapshot = await (deps.fetchMetrics || fetchMetrics)(adminApi);
          observed.providerWindowDelta = providerDelta(snapshot, nextSnapshot, config.releaseSha);
          snapshot = nextSnapshot;
        }
        check(state.prompts.length === 11 && state.prompts.every((item) => item.semanticPassed),
          "STAGING_AI_RELIABILITY_INVENTORY_FAILED");
        check(state.prompts.some((item) => item.providerWindowDelta["provider.gemini_chat_succeeded"] > 0),
          "STAGING_AI_RELIABILITY_PROVIDER_NOT_OBSERVED");
        return true;
      },
      cleanup: async () => {
        if (outcomeUnknown) fail("STAGING_AI_RELIABILITY_OUTCOME_UNKNOWN");
        await exact.cleanup();
      },
      verify: exact.verify,
    });
    state.cleanup = result.cleanup;
    state.status = "passed";
  } catch (error) {
    operationError = error;
    state.error = error;
    state.cleanup = error.cleanup || { verified: false, residue: null };
  } finally {
    if (connected) {
      try { await (deps.connection || mongoose).disconnect(); }
      catch (error) {
        operationError ||= error;
        state.error ||= error;
        state.status = "failed";
      }
    }
  }
  state.completedAt = new Date().toISOString();
  const evidence = buildSafeReliabilityEvidence(state);
  await writeOnce(config.output, evidence);
  if (operationError) throw operationError;
  return evidence;
};

if (isEntrypoint) runStagingAiReliabilityAcceptance()
  .then(() => process.stdout.write("Staging AI reliability acceptance passed with verified cleanup.\n"))
  .catch(() => {
    process.stderr.write("Staging AI reliability acceptance failed; inspect sanitized evidence and recovery intent.\n");
    process.exitCode = 1;
  });
