import assert from "node:assert/strict";
import { test } from "node:test";
import { verifyAiCertification } from "./ai-certification-contract.mjs";

const sha = "a".repeat(40);
const time = "2026-10-07T10:00:00.000Z";
const corpus = { cases: Array.from({ length: 15 }, (_, i) => ({ id: i + 1,
  prompt: `Canonical ${i + 1}`, dependsOn: i === 4 ? 4 : null })) };
const fixture = () => ({ environment: "staging", sha, runStartedAt: time,
  model: "deepseek-v4.1-flash", provider: "vibi",
  cases: corpus.cases.map((item) => ({ ...item, sha, runStartedAt: time, startedAt: time,
    finishedAt: time, grade: "PASS", completed: true, model: "deepseek-v4.1-flash",
    configuredModel: "deepseek-v4.1-flash",
    firstUserTurn: !item.dependsOn,
    conversationId: String(item.dependsOn || item.id).padStart(24, "0"),
    userMessageId: String(item.id + 100).padStart(24, "0") })),
  talk01: { grade: "PASS", sha, model: "deepseek-v4.1-flash", runStartedAt: time,
    conversationId: "f".repeat(24), completedToolGroups: 4, requestCount: 4, errors: [] },
  ci: { sha, jobs: ["client", "docker", "e2e", "secrets", "server"].map((name) => ({ name, conclusion: "success" })) },
  deploy: { serverSha: sha, clientSha: sha, serverStatus: "live", clientStatus: "ready" },
  health: { status: 200, ready: true, checkedAt: time }, safety: { reviewed: true, blockers: [] },
});

test("requires exact new canonical evidence, live history, CI, deployment and safety together", () => {
  assert.deepEqual(verifyAiCertification(fixture(), corpus), { go: true, reasons: [] });
});

test("rejects reused evidence, substituted prompts, missing parent and mismatched SHA", () => {
  const e = fixture();
  e.cases[0].runStartedAt = "2026-10-06T10:00:00.000Z";
  e.cases[1].prompt = "Easier replacement";
  e.cases[4].conversationId = "f".repeat(24);
  e.deploy.clientSha = "b".repeat(40);
  const result = verifyAiCertification(e, corpus);
  assert.equal(result.go, false);
  for (const reason of ["case_1_reused", "case_2_prompt_mismatch", "case_5_parent_mismatch", "deploy_sha_mismatch"]) {
    assert.ok(result.reasons.includes(reason), reason);
  }
});

test("does not infer readiness from old green CI, superficial TALK01 or absent safety review", () => {
  const e = fixture();
  e.ci.sha = "b".repeat(40);
  e.talk01.completedToolGroups = 1;
  e.health.checkedAt = "2026-10-06T10:00:00.000Z";
  e.safety = {};
  assert.deepEqual(verifyAiCertification(e, corpus).reasons,
    ["talk01_live_required", "ci_5_of_5_required", "fresh_health_required", "safety_review_required"]);
});

test("invalid and incomplete evidence is NO-GO", () => {
  assert.equal(verifyAiCertification(null, corpus).go, false);
  assert.equal(verifyAiCertification({}, corpus).go, false);
  const e = fixture();
  e.cases.push(e.cases[0]);
  assert.equal(verifyAiCertification(e, corpus).go, false);
});
