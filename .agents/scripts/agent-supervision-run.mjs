import { evaluateLeaseAvailability } from "./agent-supervision-lease.mjs";
import { findPrivacyTypes } from "../../scripts/lib/docs-privacy.mjs";
import { hasSecretLikeText } from "../../scripts/lib/sensitive-text.mjs";

const SHA256 = /^[0-9a-f]{64}$/;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,79}$/;
const MAX_LEASE_CONFLICTS = 400;
const MAX_TRANSITIONS = 100;
const MAX_ACTIONS = 500;
const READ_ONLY_ACTIONS = new Set(["read", "search", "test", "report"]);
const ALLOWED_TRANSITIONS = new Set([
  "planned>context_ready",
  "context_ready>lease_ready",
  "lease_ready>running",
  "running>checkpointed",
  "checkpointed>running",
  "running>completed",
]);

const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const closedObject = (value, allowedFields, name) => {
  invariant(value && typeof value === "object" && !Array.isArray(value), `${name} must be an object`);
  for (const field of Object.keys(value)) {
    invariant(allowedFields.includes(field), `${name} contains an unsupported field`);
  }
};

const safeIdentifier = (value, name) => {
  invariant(typeof value === "string" && IDENTIFIER.test(value), `${name} is invalid`);
  const comparableIdentifier = value.replace(/[._/-]+/g, " ");
  invariant(
    !hasSecretLikeText(value)
      && findPrivacyTypes(value).length === 0
      && findPrivacyTypes(comparableIdentifier).length === 0,
    `${name} is invalid`,
  );
  invariant(
    !value.split("/").some((segment) => segment === "" || segment === "." || segment === ".."),
    `${name} is invalid`,
  );
  return value;
};

const canonicalTime = (value, name) => {
  const parsed = new Date(value);
  invariant(
    typeof value === "string" && Number.isFinite(parsed.getTime()) && parsed.toISOString() === value,
    `${name} must be canonical ISO-8601`,
  );
  return parsed.getTime();
};

const requireFingerprint = (value, name) => {
  invariant(SHA256.test(String(value || "")), `${name} is invalid`);
  return value;
};

const normalizeLeaseDecision = (value, name) => {
  closedObject(
    value,
    [
      "schemaVersion", "kind", "decision", "evaluatedAt", "proposalFingerprint",
      "registryFingerprint", "conflicts",
    ],
    name,
  );
  invariant(
    value.schemaVersion === 1 && value.kind === "lease-decision",
    `${name} identity is invalid`,
  );
  invariant(["available", "conflict"].includes(value.decision), `${name} decision is invalid`);
  const evaluatedAt = canonicalTime(value.evaluatedAt, `${name} evaluatedAt`);
  const proposalFingerprint = requireFingerprint(
    value.proposalFingerprint,
    `${name} proposal fingerprint`,
  );
  const registryFingerprint = requireFingerprint(
    value.registryFingerprint,
    `${name} registry fingerprint`,
  );
  invariant(
    Array.isArray(value.conflicts) && value.conflicts.length <= MAX_LEASE_CONFLICTS,
    `${name} conflicts are invalid`,
  );
  const conflictKeys = new Set();
  for (const conflict of value.conflicts) {
    closedObject(conflict, ["reason", "leaseId", "owner"], `${name} conflict`);
    invariant(
      ["active-registry-overlap", "proposal-overlap"].includes(conflict.reason),
      `${name} conflict reason is invalid`,
    );
    const leaseId = safeIdentifier(conflict.leaseId, `${name} conflict lease ID`);
    safeIdentifier(conflict.owner, `${name} conflict owner`);
    const key = `${conflict.reason}:${leaseId}`;
    invariant(!conflictKeys.has(key), `${name} contains duplicate conflicts`);
    conflictKeys.add(key);
  }
  invariant(
    value.decision === "available" ? value.conflicts.length === 0 : value.conflicts.length > 0,
    `${name} decision is inconsistent`,
  );
  return {
    decision: value.decision,
    evaluatedAt,
    proposalFingerprint,
    registryFingerprint,
  };
};

const requireAvailableDecision = (value, name, expectedProposalFingerprint) => {
  const decision = normalizeLeaseDecision(value, name);
  invariant(decision.decision === "available", `${name} must be available`);
  if (expectedProposalFingerprint) {
    invariant(
      decision.proposalFingerprint === expectedProposalFingerprint,
      "Lease proposal fingerprint drift detected",
    );
  }
  return decision;
};

const normalizeTransitions = (values) => {
  invariant(
    Array.isArray(values) && values.length > 0 && values.length <= MAX_TRANSITIONS,
    "Run transitions are invalid",
  );
  let currentState = "planned";
  let enteredRunning = false;
  let checkpointCount = 0;
  let resumeCount = 0;
  for (const transition of values) {
    closedObject(transition, ["from", "to"], "Run transition");
    invariant(transition.from === currentState, "Run transition order is invalid");
    invariant(
      ALLOWED_TRANSITIONS.has(`${transition.from}>${transition.to}`),
      "Run transition is not allowed",
    );
    if (transition.to === "checkpointed") checkpointCount += 1;
    if (transition.from === "checkpointed" && transition.to === "running") resumeCount += 1;
    if (transition.to === "running") enteredRunning = true;
    currentState = transition.to;
  }
  invariant(checkpointCount <= 1 && resumeCount <= 1, "Run supports one checkpoint cycle");
  return {
    state: currentState,
    checkpointed: checkpointCount === 1,
    resumed: resumeCount === 1,
    enteredRunning,
  };
};

const normalizeActions = (values) => {
  invariant(Array.isArray(values) && values.length <= MAX_ACTIONS, "Run actions are invalid");
  return values.map((action, index) => {
    closedObject(action, ["sequence", "type", "state"], "Run action");
    invariant(action.sequence === index + 1, "Run action sequence is invalid");
    invariant(READ_ONLY_ACTIONS.has(action.type), "Run action is outside the read-only allowlist");
    invariant(action.state === "running", "Run action must execute in running state");
    return { sequence: action.sequence, type: action.type, state: action.state };
  });
};

export const validateSupervisedRun = (
  run,
  {
    currentContextFingerprint,
    currentLeaseDecision,
    currentLeaseRegistry,
    currentLeaseProposal,
    now,
  } = {},
) => {
  closedObject(
    run,
    [
      "schemaVersion", "kind", "runId", "contextFingerprint", "leaseDecision",
      "state", "transitions", "actions", "checkpoint", "resume",
    ],
    "Supervised run",
  );
  invariant(
    run.schemaVersion === 1 && run.kind === "supervised-run",
    "Supervised run identity is invalid",
  );
  const runId = safeIdentifier(run.runId, "Run ID");
  const contextFingerprint = requireFingerprint(run.contextFingerprint, "Run context fingerprint");
  invariant(
    requireFingerprint(currentContextFingerprint, "Current context fingerprint") === contextFingerprint,
    "Context fingerprint drift detected",
  );
  const initialLease = requireAvailableDecision(run.leaseDecision, "Run lease decision");
  const evaluatedNow = canonicalTime(now, "now");
  const currentLease = requireAvailableDecision(
    currentLeaseDecision,
    "Current lease decision",
    initialLease.proposalFingerprint,
  );
  const recomputedCurrentLease = requireAvailableDecision(
    evaluateLeaseAvailability(currentLeaseRegistry, currentLeaseProposal, { now }),
    "Recomputed current lease decision",
    initialLease.proposalFingerprint,
  );
  invariant(
    currentLease.decision === recomputedCurrentLease.decision,
    "Current lease decision does not match the current registry",
  );
  invariant(
    currentLease.proposalFingerprint === recomputedCurrentLease.proposalFingerprint,
    "Current lease proposal fingerprint drift detected",
  );
  invariant(
    currentLease.registryFingerprint === recomputedCurrentLease.registryFingerprint,
    "Current lease registry fingerprint drift detected",
  );
  const transitionState = normalizeTransitions(run.transitions);
  invariant(run.state === transitionState.state, "Run state does not match transition log");
  const actions = normalizeActions(run.actions);
  invariant(
    actions.length === 0 || transitionState.enteredRunning,
    "Run actions require a running transition",
  );
  invariant(
    transitionState.checkpointed === Boolean(run.checkpoint),
    "Run checkpoint evidence does not match transitions",
  );
  invariant(
    transitionState.resumed === Boolean(run.resume),
    "Run resume evidence does not match transitions",
  );

  let checkpointLease;
  if (run.checkpoint) {
    closedObject(
      run.checkpoint,
      ["state", "contextFingerprint", "leaseDecision", "actionCount"],
      "Checkpoint",
    );
    invariant(run.checkpoint.state === "checkpointed", "Checkpoint state is invalid");
    invariant(
      requireFingerprint(run.checkpoint.contextFingerprint, "Checkpoint context fingerprint") === contextFingerprint,
      "Checkpoint context fingerprint drift detected",
    );
    checkpointLease = requireAvailableDecision(
      run.checkpoint.leaseDecision,
      "Checkpoint lease decision",
      initialLease.proposalFingerprint,
    );
    invariant(
      Number.isSafeInteger(run.checkpoint.actionCount) &&
        run.checkpoint.actionCount >= 0 && run.checkpoint.actionCount <= actions.length,
      "Checkpoint action count is invalid",
    );
    if (!run.resume) {
      invariant(run.checkpoint.actionCount === actions.length, "Checkpoint action count is stale");
    }
  }

  let resumeLease;
  if (run.resume) {
    closedObject(run.resume, ["contextFingerprint", "leaseDecision"], "Resume");
    invariant(
      requireFingerprint(run.resume.contextFingerprint, "Resume context fingerprint") === contextFingerprint,
      "Resume context fingerprint drift detected",
    );
    resumeLease = requireAvailableDecision(
      run.resume.leaseDecision,
      "Resume lease decision",
      initialLease.proposalFingerprint,
    );
  }
  const evidenceTimes = [
    initialLease.evaluatedAt,
    ...(checkpointLease ? [checkpointLease.evaluatedAt] : []),
    ...(resumeLease ? [resumeLease.evaluatedAt] : []),
    currentLease.evaluatedAt,
  ];
  invariant(
    evidenceTimes.every((value, index) => index === 0 || value >= evidenceTimes[index - 1]),
    "Lease evidence time moved backwards",
  );
  invariant(currentLease.evaluatedAt === evaluatedNow, "Current lease decision is not fresh");
  return {
    valid: true,
    runId,
    state: run.state,
    contextFingerprint,
    proposalFingerprint: initialLease.proposalFingerprint,
    actionCount: actions.length,
    checkpointed: transitionState.checkpointed,
    resumed: transitionState.resumed,
  };
};
