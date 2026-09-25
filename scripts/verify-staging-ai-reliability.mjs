import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { reliabilityPlan } from "../server/src/scripts/stagingAiReliabilityAcceptance.plan.js";

const SHA = /^[a-f0-9]{40}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const OID = /^[a-f0-9]{24}$/i;
const HEX64 = /^[a-f0-9]{64}$/;
const SAFE_NAME = /^[a-z0-9_-]{1,100}$/;
const CLEANUP_COLLECTIONS = [
  "staging_ai_acceptance_claims", "knowledgeentries", "chatconversations",
  "serviceusagebuckets", "aimemories", "aimemorypreferences", "aitoolconfirmations",
  "aimoderationstates", "users",
];
const PROVIDER_KEYS = [
  "provider.gemini_chat_requests",
  "provider.gemini_chat_succeeded",
  "provider.gemini_chat_failed",
  "provider.gemini_chat_unavailable",
  "provider.gemini_chat_rate_limited",
  "provider.gemini_chat_not_required",
];

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const exactKeys = (value, keys, name) => {
  assert(value && typeof value === "object" && !Array.isArray(value), `${name} is invalid`);
  assert(Object.keys(value).sort().join("|") === [...keys].sort().join("|"), `${name} fields are invalid`);
};
const timestamp = (value, name) => {
  const date = new Date(value);
  assert(typeof value === "string" && !Number.isNaN(date.getTime()) && date.toISOString() === value,
    `${name} is invalid`);
  return date.getTime();
};
const expectedContextSource = (number) => number === 4
  ? "synthetic_300_kcal_plan"
  : [6, 8].includes(number) ? "prior_live_turn" : "new_conversation";

const validatePrompt = (prompt, planned, name) => {
  exactKeys(prompt, [
    "number", "scenarioId", "requestId", "conversationId", "contextSource",
    "routeDomain", "evidenceMode", "webSearchOutcome", "tools", "modelClass",
    "providerWindowDelta", "latencyMs", "semanticPassed", "persisted",
    "semanticOutcome", "constraintProof",
  ], name);
  assert(prompt.number === planned.number && prompt.scenarioId === planned.scenarioId,
    `${name} does not match the incident corpus`);
  assert(UUID.test(prompt.requestId) && OID.test(prompt.conversationId), `${name} identity is invalid`);
  assert(prompt.contextSource === expectedContextSource(prompt.number), `${name} context is invalid`);
  assert(["fitness", "general", "adjacent", "ht_service"].includes(prompt.routeDomain), `${name} route is invalid`);
  assert(["internal_kb", "model_prior", "web_required"].includes(prompt.evidenceMode), `${name} evidence is invalid`);
  if (planned.expectedPath.domain) assert(prompt.routeDomain === planned.expectedPath.domain, `${name} route drifted`);
  if (planned.expectedPath.evidence) {
    const lowRiskFitnessKbMiss = planned.expectedPath.evidence === "internal_kb" &&
      planned.expectedPath.domain === "fitness" && planned.expectedPath.risk === "low" &&
      !planned.expectedPath.preferredTool && prompt.evidenceMode === "model_prior" &&
      prompt.webSearchOutcome === "not_called" &&
      Array.isArray(prompt.tools) && prompt.tools.length === 0;
    assert(prompt.evidenceMode === planned.expectedPath.evidence || lowRiskFitnessKbMiss,
      `${name} evidence drifted`);
  }
  assert(["not_called", "provider_error", "no_supported_source", "grounded"].includes(prompt.webSearchOutcome),
    `${name} web outcome is invalid`);
  if (planned.expectedPath.webSearchRequired === true) {
    assert(prompt.webSearchOutcome === "grounded", `${name} has no grounded source`);
  } else if (planned.expectedPath.maxWebSearchCalls === 0) {
    assert(prompt.webSearchOutcome === "not_called", `${name} made an unexpected web lookup`);
  }
  assert(Array.isArray(prompt.tools) && prompt.tools.length <= 8, `${name} tools are invalid`);
  for (const tool of prompt.tools) {
    exactKeys(tool, ["name", "status"], `${name} tool`);
    assert(SAFE_NAME.test(tool.name) && [
      "success", "error", "validation_failed", "timed_out", "confirmation_required",
    ].includes(tool.status), `${name} tool outcome is invalid`);
  }
  assert(["gemini_configured", "static_or_other"].includes(prompt.modelClass), `${name} model class is invalid`);
  exactKeys(prompt.providerWindowDelta, PROVIDER_KEYS, `${name} provider window`);
  assert(PROVIDER_KEYS.every((key) => Number.isSafeInteger(prompt.providerWindowDelta[key]) &&
    prompt.providerWindowDelta[key] >= 0), `${name} provider window is invalid`);
  assert(Number.isSafeInteger(prompt.latencyMs) && prompt.latencyMs >= 0 && prompt.latencyMs <= 180_000,
    `${name} latency is invalid`);
  assert(prompt.semanticPassed === true && prompt.persisted === true, `${name} was not accepted`);
  if (prompt.semanticOutcome === "constraint_unavailable") {
    assert(prompt.number === 8, `${name} used unavailable outcome outside Q8`);
    exactKeys(prompt.constraintProof, ["reason", "priorPlanFingerprint", "afterPlanFingerprint", "planPreserved"],
      `${name} constraint proof`);
    assert(prompt.constraintProof.reason === "scoped_adjustment_food_absent" &&
      HEX64.test(prompt.constraintProof.priorPlanFingerprint) &&
      prompt.constraintProof.afterPlanFingerprint === prompt.constraintProof.priorPlanFingerprint &&
      prompt.constraintProof.planPreserved === true,
    `${name} constraint proof is invalid`);
  } else {
    assert(prompt.semanticOutcome === "complete" && prompt.constraintProof === null,
      `${name} semantic outcome is invalid`);
  }
};

const validateRound = (evidence, expectedSha, index, plan) => {
  const name = `round ${index}`;
  exactKeys(evidence, [
    "schemaVersion", "kind", "releaseSha", "runId", "status", "startedAt",
    "completedAt", "runtimeFingerprint", "syntheticIds", "prompts", "cleanup",
  ], name);
  assert(evidence.schemaVersion === 1 && evidence.kind === "staging-ai-reliability-acceptance" &&
    evidence.status === "passed", `${name} did not pass`);
  assert(evidence.releaseSha === expectedSha && UUID.test(evidence.runId), `${name} identity is invalid`);
  assert(HEX64.test(evidence.runtimeFingerprint), `${name} runtime fingerprint is invalid`);
  const startedAt = timestamp(evidence.startedAt, `${name} start`);
  const completedAt = timestamp(evidence.completedAt, `${name} completion`);
  assert(completedAt >= startedAt, `${name} chronology is invalid`);
  exactKeys(evidence.syntheticIds, ["userId", "adminUserId"], `${name} actors`);
  assert(OID.test(evidence.syntheticIds.userId) && OID.test(evidence.syntheticIds.adminUserId) &&
    evidence.syntheticIds.userId !== evidence.syntheticIds.adminUserId, `${name} actor identity is invalid`);
  exactKeys(evidence.cleanup, ["verified", "residue", "collections"], `${name} cleanup`);
  assert(evidence.cleanup.verified === true && evidence.cleanup.residue === 0, `${name} has cleanup residue`);
  exactKeys(evidence.cleanup.collections, CLEANUP_COLLECTIONS, `${name} cleanup collections`);
  assert(CLEANUP_COLLECTIONS.every((collection) => evidence.cleanup.collections[collection] === 0),
    `${name} left a synthetic artifact`);
  assert(Array.isArray(evidence.prompts) && evidence.prompts.length === 11, `${name} prompt count is invalid`);
  const byNumber = new Map();
  for (const prompt of evidence.prompts) {
    assert(Number.isInteger(prompt?.number) && !byNumber.has(prompt.number), `${name} prompt inventory is invalid`);
    byNumber.set(prompt.number, prompt);
  }
  for (const planned of plan) validatePrompt(byNumber.get(planned.number), planned, `${name} prompt ${planned.number}`);
  assert(new Set(evidence.prompts.map((item) => item.requestId)).size === 11, `${name} reused a request id`);
  assert(byNumber.get(6).conversationId === byNumber.get(11).conversationId &&
    byNumber.get(8).conversationId === byNumber.get(7).conversationId,
    `${name} lost follow-up continuity`);
  const newConversations = evidence.prompts.filter((item) => item.contextSource === "new_conversation");
  assert(new Set(newConversations.map((item) => item.conversationId)).size === newConversations.length,
    `${name} reused a new conversation`);
  return { startedAt, completedAt };
};

export const verifyStagingAiReliabilityRounds = (first, second, expectedSha) => {
  assert(SHA.test(expectedSha || ""), "Expected staging SHA is invalid");
  const plan = reliabilityPlan();
  const firstTime = validateRound(first, expectedSha, 1, plan);
  const secondTime = validateRound(second, expectedSha, 2, plan);
  assert(first.runId !== second.runId && first.runtimeFingerprint !== second.runtimeFingerprint &&
    new Set([first.syntheticIds.userId, first.syntheticIds.adminUserId,
      second.syntheticIds.userId, second.syntheticIds.adminUserId]).size === 4,
  "Reliability rounds reused synthetic actors");
  assert(secondTime.startedAt >= firstTime.completedAt, "Reliability rounds are not consecutive");
  const firstConversations = new Set(first.prompts.map((item) => item.conversationId));
  assert(second.prompts.every((item) => !firstConversations.has(item.conversationId)),
    "Reliability rounds reused a conversation");
  return { releaseSha: expectedSha, rounds: 2, promptsPerRound: 11 };
};

const main = async () => {
  const options = Object.fromEntries(process.argv.slice(2).map((argument) => {
    const match = /^--(round-1|round-2|expected-sha)=(.+)$/.exec(argument);
    assert(match, "Unsupported reliability evidence argument");
    return [match[1], match[2]];
  }));
  exactKeys(options, ["round-1", "round-2", "expected-sha"], "Reliability evidence arguments");
  const [first, second] = await Promise.all([options["round-1"], options["round-2"]]
    .map(async (file) => JSON.parse(await readFile(file, "utf8"))));
  process.stdout.write(`${JSON.stringify(verifyStagingAiReliabilityRounds(first, second, options["expected-sha"]))}\n`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
