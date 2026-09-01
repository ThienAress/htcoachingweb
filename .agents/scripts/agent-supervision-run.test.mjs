import assert from "node:assert/strict";
import test from "node:test";

import * as supervision from "./agent-supervision-contract.mjs";

const { evaluateLeaseAvailability, validateSupervisedRun } = supervision;
const NOW = "2026-08-30T02:00:00.000Z";
const FUTURE = "2026-08-30T03:00:00.000Z";
const RESUME_NOW = "2026-08-30T02:30:00.000Z";
const CONTEXT = "a".repeat(64);
const DRIFTED_CONTEXT = "f".repeat(64);
const scope = (path, kind = "file") => ({ kind, path });
const lease = (overrides = {}) => ({
  id: "lease-a",
  owner: "agent-a",
  lifecycle: "active",
  expiresAt: FUTURE,
  scopes: [scope(".agents/scripts/owned.mjs")],
  ...overrides,
});
const registry = (leases = [lease()]) => ({
  schemaVersion: 1,
  kind: "worktree-lease-registry",
  leases,
});
const proposal = (scopes = [scope("docs/plans/078-plan.md")]) => ({
  owner: "agent-b",
  scopes,
});
const availableDecision = (now = NOW) =>
  evaluateLeaseAvailability(registry([]), proposal(), { now });
const conflictDecision = (now = RESUME_NOW) => evaluateLeaseAvailability(
  registry([lease({ scopes: proposal().scopes })]),
  proposal(),
  { now },
);
const transitions = [
  { from: "planned", to: "context_ready" },
  { from: "context_ready", to: "lease_ready" },
  { from: "lease_ready", to: "running" },
  { from: "running", to: "completed" },
];
const actions = ["read", "search", "test", "report"].map((type, index) => ({
  sequence: index + 1,
  type,
  state: "running",
}));
const runManifest = () => ({
  schemaVersion: 1,
  kind: "supervised-run",
  runId: "run-078-step-3",
  contextFingerprint: CONTEXT,
  leaseDecision: availableDecision(),
  state: "completed",
  transitions: structuredClone(transitions),
  actions: structuredClone(actions),
});
const resumedRun = () => {
  const run = runManifest();
  run.transitions.splice(
    3,
    1,
    { from: "running", to: "checkpointed" },
    { from: "checkpointed", to: "running" },
    { from: "running", to: "completed" },
  );
  run.checkpoint = {
    state: "checkpointed",
    contextFingerprint: CONTEXT,
    leaseDecision: availableDecision(),
    actionCount: 2,
  };
  run.resume = {
    contextFingerprint: CONTEXT,
    leaseDecision: availableDecision(RESUME_NOW),
  };
  return run;
};
const validate = (run, overrides = {}) => validateSupervisedRun(run, {
  currentContextFingerprint: CONTEXT,
  currentLeaseDecision: availableDecision(RESUME_NOW),
  currentLeaseRegistry: registry([]),
  currentLeaseProposal: proposal(),
  now: RESUME_NOW,
  ...overrides,
});

test("accepts a deterministic read-only run and exposes only validator seams", () => {
  const run = runManifest();
  const before = structuredClone(run);
  const first = validate(run);
  const second = validate(run);

  assert.deepEqual(
    {
      first,
      deterministic: first.contextFingerprint === second.contextFingerprint,
      input: run,
      exports: Object.keys(supervision),
    },
    {
      first: {
        valid: true,
        runId: "run-078-step-3",
        state: "completed",
        contextFingerprint: CONTEXT,
        proposalFingerprint: availableDecision().proposalFingerprint,
        actionCount: 4,
        checkpointed: false,
        resumed: false,
      },
      deterministic: true,
      input: before,
      exports: ["evaluateLeaseAvailability", "validateSupervisedRun"],
    },
  );
});

test("accepts a checkpoint and resume only with matching context and available lease evidence", () => {
  const run = resumedRun();
  const before = structuredClone(run);
  const result = validate(run);

  assert.deepEqual(
    { result, input: run },
    {
      result: {
        valid: true,
        runId: "run-078-step-3",
        state: "completed",
        contextFingerprint: CONTEXT,
        proposalFingerprint: availableDecision().proposalFingerprint,
        actionCount: 4,
        checkpointed: true,
        resumed: true,
      },
      input: before,
    },
  );
});

test("rejects out-of-order transitions and a resume transition without evidence", () => {
  const outOfOrder = runManifest();
  outOfOrder.transitions[1] = { from: "context_ready", to: "running" };
  const missingResume = resumedRun();
  delete missingResume.resume;

  for (const run of [outOfOrder, missingResume]) {
    assert.throws(() => validate(run), /transition|resume/i);
  }
});

test("rejects actions that claim a state other than running", () => {
  const run = runManifest();
  run.actions[0].state = "context_ready";

  assert.throws(() => validate(run), /action.*running/i);
});

test("rejects actions when the transition log never entered running", () => {
  const run = runManifest();
  run.transitions = [{ from: "planned", to: "context_ready" }];
  run.state = "context_ready";

  assert.throws(() => validate(run), /actions.*running transition/i);
});

test("rejects every action outside the read-only allowlist and arbitrary action payloads", () => {
  const forbidden = [
    "shell",
    "git-write",
    "deploy",
    "production-read",
    "production-write",
    "external-write",
  ];
  for (const type of forbidden) {
    const run = runManifest();
    run.actions[0].type = type;
    assert.throws(() => validate(run), /action.*allowlist/i);
  }
  const executorPayload = runManifest();
  executorPayload.actions[0].command = "anything";
  assert.throws(() => validate(executorPayload), /unsupported field/i);
});

test("rejects checkpoint or resume records missing context and lease evidence", () => {
  const cases = [
    ["checkpoint", "contextFingerprint"],
    ["checkpoint", "leaseDecision"],
    ["resume", "contextFingerprint"],
    ["resume", "leaseDecision"],
  ];
  for (const [record, field] of cases) {
    const run = resumedRun();
    delete run[record][field];
    assert.throws(() => validate(run), /checkpoint|resume|fingerprint|lease/i);
  }
});

test("rejects context fingerprint drift at checkpoint, resume and current-state guards", () => {
  const mutations = [
    (run) => { run.checkpoint.contextFingerprint = DRIFTED_CONTEXT; },
    (run) => { run.resume.contextFingerprint = DRIFTED_CONTEXT; },
  ];
  for (const mutate of mutations) {
    const run = resumedRun();
    mutate(run);
    assert.throws(() => validate(run), /fingerprint.*drift/i);
  }
  assert.throws(
    () => validate(resumedRun(), { currentContextFingerprint: DRIFTED_CONTEXT }),
    /fingerprint.*drift/i,
  );
});

test("rejects lease conflict at run, checkpoint, resume and current-state guards", () => {
  for (const target of ["leaseDecision", "checkpoint", "resume", "current"]) {
    const run = resumedRun();
    const overrides = {};
    if (target === "leaseDecision") run.leaseDecision = conflictDecision(NOW);
    else if (target === "current") overrides.currentLeaseDecision = conflictDecision();
    else run[target].leaseDecision = conflictDecision(target === "checkpoint" ? NOW : RESUME_NOW);
    assert.throws(() => validate(run, overrides), /lease.*available/i);
  }
});

test("rejects a lease proposal change during resume", () => {
  const run = resumedRun();
  run.resume.leaseDecision = evaluateLeaseAvailability(
    registry([]),
    proposal([scope("docs/other.md")]),
    { now: RESUME_NOW },
  );
  assert.throws(() => validate(run), /lease proposal.*drift/i);
});

test("rejects replay of a stale current lease decision", () => {
  assert.throws(
    () => validate(runManifest(), { currentLeaseDecision: availableDecision(NOW) }),
    /current lease.*fresh/i,
  );
});

test("rejects a forged available decision when the current registry conflicts", () => {
  const actualConflict = conflictDecision(RESUME_NOW);
  const forgedAvailable = {
    ...actualConflict,
    decision: "available",
    conflicts: [],
  };

  assert.throws(
    () => validate(runManifest(), {
      currentLeaseDecision: forgedAvailable,
      currentLeaseRegistry: registry([lease({ scopes: proposal().scopes })]),
    }),
    /lease.*available/i,
  );
});

test("rejects an available decision whose registry fingerprint is stale", () => {
  assert.throws(
    () => validate(runManifest(), {
      currentLeaseRegistry: registry([lease({ lifecycle: "released" })]),
    }),
    /registry fingerprint drift/i,
  );
});

test("treats ancestor scopes as overlap even when a directory is mislabeled as a file", () => {
  const result = evaluateLeaseAvailability(
    registry([lease({ scopes: [scope("client/src")] })]),
    proposal([scope("client/src/App.jsx")]),
    { now: NOW },
  );

  assert.equal(result.decision, "conflict");
});

test("rejects a secret-like run ID before it can appear in validator output", () => {
  const run = runManifest();
  run.runId = ["github", "pat", "A".repeat(40)].join("_");

  assert.throws(
    () => validate(run),
    /run id.*invalid/i,
  );
});
