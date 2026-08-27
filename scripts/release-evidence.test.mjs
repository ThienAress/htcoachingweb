import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluatePostDeployEvidence,
  evaluateReleaseCandidate,
} from "./lib/release-evidence.mjs";

const SHA = "a".repeat(40);
const RUN_URL = "https://github.com/ThienAress/htcoachingweb/actions/runs/123";

const candidate = (overrides = {}) => ({
  schemaVersion: 1,
  kind: "release-candidate",
  release: {
    sha: SHA,
    branch: "staging",
    createdAt: "2026-08-24T08:00:00.000Z",
  },
  ci: { status: "passed", sha: SHA, runUrl: RUN_URL },
  staging: {
    client: { deployId: "netlify-staging-123", sha: SHA },
    server: { deployId: "render-staging-456", sha: SHA },
    acceptance: {
      status: "passed",
      runId: "018f47f0-72a4-7c3c-9b21-891c46ffcb16",
      runUrl: RUN_URL,
      artifactName: "staging-acceptance-123",
      database: "htcoaching_staging",
      cleanup: { verified: true, residue: 0 },
    },
  },
  recovery: {
    backupId: "production-logical-backup-20260824T070000Z",
    releaseReady: true,
    disasterRecoveryReady: true,
    continuousRecoveryAvailable: false,
    evidence: "docs/operations/production/backup-record.md",
  },
  rollback: {
    clientDeployId: "netlify-production-known-good",
    serverDeployId: "render-production-known-good",
  },
  ...overrides,
});

test("release candidate requires exact SHA, staging cleanup and off-device recovery", () => {
  assert.deepEqual(evaluateReleaseCandidate(candidate()), {
    ready: true,
    sha: SHA,
    backupId: "production-logical-backup-20260824T070000Z",
    blockers: [],
    warnings: ["CONTINUOUS_RECOVERY_UNAVAILABLE"],
  });
});

test("release candidate fails closed on SHA drift and synthetic residue", () => {
  const value = candidate();
  value.staging.server.sha = "b".repeat(40);
  value.staging.acceptance.cleanup = { verified: false, residue: 2 };

  const result = evaluateReleaseCandidate(value);
  assert.equal(result.ready, false);
  assert.deepEqual(result.blockers, [
    "STAGING_SERVER_SHA_MISMATCH",
    "STAGING_CLEANUP_UNVERIFIED",
  ]);
});

test("release candidate rejects unknown fields that could hide secret metadata", () => {
  assert.throws(
    () => evaluateReleaseCandidate({ ...candidate(), databaseUri: "private" }),
    /unsupported field/i,
  );
});

test("release candidate accepts Actions evidence only from this repository", () => {
  const externalRun = candidate();
  externalRun.ci.runUrl = "https://github.com/another/repository/actions/runs/123";
  assert.throws(
    () => evaluateReleaseCandidate(externalRun),
    /this repository's Actions run/,
  );
});

test("post-deploy evidence belongs to the same SHA and observes at least 30 minutes", () => {
  const evidence = {
    schemaVersion: 1,
    kind: "production-observation",
    candidateSha: SHA,
    production: {
      client: { deployId: "netlify-production-789", sha: SHA },
      server: { deployId: "render-production-987", sha: SHA },
    },
    observation: {
      startedAt: "2026-08-24T09:00:00.000Z",
      endedAt: "2026-08-24T09:30:00.000Z",
      monitorRunUrl: RUN_URL,
      status: "passed",
      decision: "keep",
    },
  };

  assert.deepEqual(evaluatePostDeployEvidence(evidence, candidate()), {
    ready: true,
    sha: SHA,
    observationMinutes: 30,
    blockers: [],
  });

  evidence.observation.endedAt = "2026-08-24T09:10:00.000Z";
  assert.deepEqual(
    evaluatePostDeployEvidence(evidence, candidate()).blockers,
    ["OBSERVATION_WINDOW_TOO_SHORT"],
  );
});
