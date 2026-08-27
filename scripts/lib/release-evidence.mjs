const SHA_PATTERN = /^[0-9a-f]{40}$/;
const DEPLOY_ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{5,159}$/i;
const RUN_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const plainObject = (value, name) => {
  assert(value && typeof value === "object" && !Array.isArray(value), `${name} must be an object`);
  return value;
};

const closedObject = (value, allowed, name) => {
  plainObject(value, name);
  for (const field of Object.keys(value)) {
    assert(allowed.includes(field), `${name} contains unsupported field: ${field}`);
  }
};

const canonicalTimestamp = (value, name) => {
  const date = new Date(value);
  assert(Number.isFinite(date.getTime()), `${name} must be an ISO timestamp`);
  assert(date.toISOString() === value, `${name} must use canonical ISO format`);
  return date;
};

const githubRunUrl = (value, name) => {
  const url = new URL(String(value || ""));
  assert(url.protocol === "https:", `${name} must use HTTPS`);
  assert(url.hostname === "github.com", `${name} must point to GitHub`);
  assert(
    /^\/ThienAress\/htcoachingweb\/actions\/runs\/\d+\/?$/.test(url.pathname),
    `${name} must point to this repository's Actions run`,
  );
};

const sha = (value, name) => {
  assert(SHA_PATTERN.test(String(value || "")), `${name} must be an exact 40-character Git SHA`);
};

const deploy = (value, name) => {
  assert(DEPLOY_ID_PATTERN.test(String(value || "")), `${name} is invalid`);
};

const validateDeployIdentity = (value, name) => {
  closedObject(value, ["deployId", "sha"], name);
  deploy(value.deployId, `${name}.deployId`);
  sha(value.sha, `${name}.sha`);
};

export const validateReleaseCandidate = (manifest) => {
  closedObject(manifest, ["schemaVersion", "kind", "release", "ci", "staging", "recovery", "rollback"], "Release candidate");
  assert(manifest.schemaVersion === 1, "Unsupported release candidate schemaVersion");
  assert(manifest.kind === "release-candidate", "Release candidate kind is invalid");

  closedObject(manifest.release, ["sha", "branch", "createdAt"], "release");
  sha(manifest.release.sha, "release.sha");
  assert(["staging", "main"].includes(manifest.release.branch), "release.branch is invalid");
  canonicalTimestamp(manifest.release.createdAt, "release.createdAt");

  closedObject(manifest.ci, ["status", "sha", "runUrl"], "ci");
  assert(["passed", "failed"].includes(manifest.ci.status), "ci.status is invalid");
  sha(manifest.ci.sha, "ci.sha");
  githubRunUrl(manifest.ci.runUrl, "ci.runUrl");

  closedObject(manifest.staging, ["client", "server", "acceptance"], "staging");
  validateDeployIdentity(manifest.staging.client, "staging.client");
  validateDeployIdentity(manifest.staging.server, "staging.server");
  const acceptance = manifest.staging.acceptance;
  closedObject(acceptance, ["status", "runId", "runUrl", "artifactName", "database", "cleanup"], "staging.acceptance");
  assert(["passed", "failed"].includes(acceptance.status), "staging.acceptance.status is invalid");
  assert(RUN_ID_PATTERN.test(String(acceptance.runId || "")), "staging.acceptance.runId is invalid");
  githubRunUrl(acceptance.runUrl, "staging.acceptance.runUrl");
  assert(DEPLOY_ID_PATTERN.test(String(acceptance.artifactName || "")), "staging.acceptance.artifactName is invalid");
  assert(acceptance.database === "htcoaching_staging", "staging acceptance database must be htcoaching_staging");
  closedObject(acceptance.cleanup, ["verified", "residue"], "staging.acceptance.cleanup");
  assert(typeof acceptance.cleanup.verified === "boolean", "cleanup.verified must be boolean");
  assert(Number.isSafeInteger(acceptance.cleanup.residue) && acceptance.cleanup.residue >= 0, "cleanup.residue is invalid");

  closedObject(manifest.recovery, ["backupId", "releaseReady", "disasterRecoveryReady", "continuousRecoveryAvailable", "evidence"], "recovery");
  assert(/^production-[a-z0-9-]{8,100}$/i.test(manifest.recovery.backupId), "recovery.backupId is invalid");
  for (const field of ["releaseReady", "disasterRecoveryReady", "continuousRecoveryAvailable"]) {
    assert(typeof manifest.recovery[field] === "boolean", `recovery.${field} must be boolean`);
  }
  assert(/^docs\/operations\/production\/[a-z0-9./-]+\.md$/i.test(manifest.recovery.evidence), "recovery.evidence is invalid");

  closedObject(manifest.rollback, ["clientDeployId", "serverDeployId"], "rollback");
  deploy(manifest.rollback.clientDeployId, "rollback.clientDeployId");
  deploy(manifest.rollback.serverDeployId, "rollback.serverDeployId");
  return manifest;
};

export const evaluateReleaseCandidate = (manifest) => {
  validateReleaseCandidate(manifest);
  const expectedSha = manifest.release.sha;
  const blockers = [];
  if (manifest.ci.status !== "passed") blockers.push("CI_NOT_PASSED");
  if (manifest.ci.sha !== expectedSha) blockers.push("CI_SHA_MISMATCH");
  if (manifest.staging.client.sha !== expectedSha) blockers.push("STAGING_CLIENT_SHA_MISMATCH");
  if (manifest.staging.server.sha !== expectedSha) blockers.push("STAGING_SERVER_SHA_MISMATCH");
  if (manifest.staging.acceptance.status !== "passed") blockers.push("STAGING_ACCEPTANCE_NOT_PASSED");
  if (!manifest.staging.acceptance.cleanup.verified || manifest.staging.acceptance.cleanup.residue !== 0) {
    blockers.push("STAGING_CLEANUP_UNVERIFIED");
  }
  if (!manifest.recovery.releaseReady) blockers.push("RECOVERY_RELEASE_NOT_READY");
  if (!manifest.recovery.disasterRecoveryReady) blockers.push("OFF_DEVICE_RECOVERY_NOT_READY");
  return {
    ready: blockers.length === 0,
    sha: expectedSha,
    backupId: manifest.recovery.backupId,
    blockers,
    warnings: manifest.recovery.continuousRecoveryAvailable
      ? []
      : ["CONTINUOUS_RECOVERY_UNAVAILABLE"],
  };
};

export const validatePostDeployEvidence = (evidence) => {
  closedObject(evidence, ["schemaVersion", "kind", "candidateSha", "production", "observation"], "Production observation");
  assert(evidence.schemaVersion === 1, "Unsupported production observation schemaVersion");
  assert(evidence.kind === "production-observation", "Production observation kind is invalid");
  sha(evidence.candidateSha, "candidateSha");
  closedObject(evidence.production, ["client", "server"], "production");
  validateDeployIdentity(evidence.production.client, "production.client");
  validateDeployIdentity(evidence.production.server, "production.server");
  closedObject(evidence.observation, ["startedAt", "endedAt", "monitorRunUrl", "status", "decision"], "observation");
  canonicalTimestamp(evidence.observation.startedAt, "observation.startedAt");
  canonicalTimestamp(evidence.observation.endedAt, "observation.endedAt");
  githubRunUrl(evidence.observation.monitorRunUrl, "observation.monitorRunUrl");
  assert(["passed", "failed"].includes(evidence.observation.status), "observation.status is invalid");
  assert(["keep", "rollback"].includes(evidence.observation.decision), "observation.decision is invalid");
  return evidence;
};

export const evaluatePostDeployEvidence = (evidence, candidate) => {
  validatePostDeployEvidence(evidence);
  validateReleaseCandidate(candidate);
  const blockers = [];
  const expectedSha = candidate.release.sha;
  if (evidence.candidateSha !== expectedSha) blockers.push("CANDIDATE_SHA_MISMATCH");
  if (evidence.production.client.sha !== expectedSha) blockers.push("PRODUCTION_CLIENT_SHA_MISMATCH");
  if (evidence.production.server.sha !== expectedSha) blockers.push("PRODUCTION_SERVER_SHA_MISMATCH");
  const startedAt = new Date(evidence.observation.startedAt);
  const endedAt = new Date(evidence.observation.endedAt);
  const observationMinutes = Number(((endedAt - startedAt) / 60_000).toFixed(2));
  if (observationMinutes < 30) blockers.push("OBSERVATION_WINDOW_TOO_SHORT");
  if (evidence.observation.status !== "passed") blockers.push("PRODUCTION_MONITOR_NOT_PASSED");
  if (evidence.observation.decision !== "keep") blockers.push("RELEASE_NOT_KEPT");
  return { ready: blockers.length === 0, sha: expectedSha, observationMinutes, blockers };
};
