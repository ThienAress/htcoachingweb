import test from "node:test";
import assert from "node:assert/strict";

import { reliabilityPlan } from "../server/src/scripts/stagingAiReliabilityAcceptance.plan.js";
import { verifyStagingAiReliabilityRounds } from "./verify-staging-ai-reliability.mjs";

const SHA = "a".repeat(40);
const CLEANUP_COLLECTIONS = [
  "staging_ai_acceptance_claims", "knowledgeentries", "chatconversations",
  "serviceusagebuckets", "aimemories", "aimemorypreferences", "aitoolconfirmations",
  "aimoderationstates", "users",
];
const COUNTERS = {
  "provider.gemini_chat_requests": 1,
  "provider.gemini_chat_succeeded": 1,
  "provider.gemini_chat_failed": 0,
  "provider.gemini_chat_unavailable": 0,
  "provider.gemini_chat_rate_limited": 0,
  "provider.gemini_chat_not_required": 0,
};
const uuid = (number) => `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const oid = (number) => number.toString(16).padStart(24, "0");

const round = (index) => {
  const prompts = reliabilityPlan().map((item) => ({
    number: item.number,
    scenarioId: item.scenarioId,
    requestId: uuid(index * 100 + item.number),
    conversationId: oid(index * 100 + item.number),
    contextSource: item.number === 4 ? "synthetic_300_kcal_plan"
      : [6, 8].includes(item.number) ? "prior_live_turn" : "new_conversation",
    routeDomain: item.expectedPath.domain || "fitness",
    evidenceMode: item.expectedPath.evidence || "internal_kb",
    webSearchOutcome: item.number === 9 ? "grounded" : "not_called",
    tools: [],
    modelClass: "gemini_configured",
    providerWindowDelta: { ...COUNTERS },
    latencyMs: 100,
    semanticPassed: true,
    persisted: true,
    semanticOutcome: "complete",
    constraintProof: null,
  }));
  prompts.find((item) => item.number === 6).conversationId = prompts.find((item) => item.number === 11).conversationId;
  prompts.find((item) => item.number === 8).conversationId = prompts.find((item) => item.number === 7).conversationId;
  return {
    schemaVersion: 2,
    kind: "staging-ai-reliability-acceptance",
    releaseSha: SHA,
    runId: uuid(index),
    status: "passed",
    startedAt: `2026-09-24T0${index}:00:00.000Z`,
    completedAt: `2026-09-24T0${index}:30:00.000Z`,
    runtimeFingerprint: String(index).repeat(64),
    syntheticIds: { userId: oid(index), adminUserId: oid(index + 10) },
    prompts,
    cleanup: {
      verified: true,
      residue: 0,
      collections: Object.fromEntries(CLEANUP_COLLECTIONS.map((name) => [name, 0])),
    },
  };
};

test("accepts two exact cleaned rounds for one staging SHA", () => {
  assert.deepEqual(verifyStagingAiReliabilityRounds(round(1), round(2), SHA), {
    releaseSha: SHA,
    rounds: 2,
    promptsPerRound: 11,
  });
});

test("rejects a stale SHA, duplicate run, missing prompt, residue and raw payload", () => {
  const cases = [
    (first) => { first.releaseSha = "b".repeat(40); },
    (first, second) => { second.runId = first.runId; },
    (first) => { first.prompts.pop(); },
    (first) => { first.cleanup.residue = 1; },
    (first) => { first.prompts[0].rawPrompt = "private"; },
  ];
  for (const mutate of cases) {
    const first = round(1);
    const second = round(2);
    mutate(first, second);
    assert.throws(() => verifyStagingAiReliabilityRounds(first, second, SHA));
  }
});

test("rejects a failed semantic result or reused synthetic conversation across rounds", () => {
  const first = round(1);
  const second = round(2);
  first.prompts[3].semanticPassed = false;
  assert.throws(() => verifyStagingAiReliabilityRounds(first, second, SHA));
  first.prompts[3].semanticPassed = true;
  second.prompts[0].conversationId = first.prompts[0].conversationId;
  assert.throws(() => verifyStagingAiReliabilityRounds(first, second, SHA));
});

test("accepts Q8 only with the exact unavailable constraint proof", () => {
  const first = round(1);
  const second = round(2);
  for (const evidence of [first, second]) {
    const q8 = evidence.prompts.find((item) => item.number === 8);
    q8.semanticOutcome = "constraint_unavailable";
    q8.tools = [{ name: "suggest_meal", status: "success" }];
    q8.constraintProof = {
      reason: "scoped_adjustment_food_absent",
      priorPlanFingerprint: "a".repeat(64),
      afterPlanFingerprint: "a".repeat(64),
      planPreserved: true,
    };
  }
  assert.deepEqual(verifyStagingAiReliabilityRounds(first, second, SHA), {
    releaseSha: SHA, rounds: 2, promptsPerRound: 11,
  });
  first.prompts.find((item) => item.number === 8).constraintProof.planPreserved = false;
  assert.throws(() => verifyStagingAiReliabilityRounds(first, second, SHA));
  first.prompts.find((item) => item.number === 8).constraintProof.planPreserved = true;
  first.prompts.find((item) => item.number === 8).constraintProof.afterPlanFingerprint = "b".repeat(64);
  assert.throws(() => verifyStagingAiReliabilityRounds(first, second, SHA));
  first.prompts.find((item) => item.number === 8).constraintProof.afterPlanFingerprint = "a".repeat(64);
  first.prompts.find((item) => item.number === 8).tools = [];
  assert.throws(() => verifyStagingAiReliabilityRounds(first, second, SHA));
});

test("accepts a low-risk fitness KB miss only without web or tool use", () => {
  const first = round(1);
  const second = round(2);
  for (const evidence of [first, second]) {
    for (const number of [3, 5, 10, 11]) {
      evidence.prompts.find((item) => item.number === number).evidenceMode = "model_prior";
    }
  }
  assert.deepEqual(verifyStagingAiReliabilityRounds(first, second, SHA), {
    releaseSha: SHA, rounds: 2, promptsPerRound: 11,
  });
  first.prompts.find((item) => item.number === 2).evidenceMode = "model_prior";
  assert.throws(() => verifyStagingAiReliabilityRounds(first, second, SHA));
  first.prompts.find((item) => item.number === 2).evidenceMode = "internal_kb";
  first.prompts.find((item) => item.number === 3).tools = [{ name: "search_exercises", status: "success" }];
  assert.throws(() => verifyStagingAiReliabilityRounds(first, second, SHA));
});
