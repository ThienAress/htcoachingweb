import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  evaluatePostDeployEvidence,
  evaluateReleaseCandidate,
  validateStagingAiAcceptanceEvidence,
} from "./lib/release-evidence.mjs";
import { evaluateCandidateGate } from "./release-gate.mjs";

const SHA = "a".repeat(40);
const RUN_URL = "https://github.com/ThienAress/htcoachingweb/actions/runs/123";
const AI_ASSERTIONS = [
  "exact staging identity",
  "live UI and Mongo provenance correspondence",
  "metrics snapshots conclusive without reset",
  "reviewed published KB embedding",
];
const AI_LANES = [
  "live-kb-provider",
  "metrics-single-instance-topology",
  "paced-conversation-isolation",
  "provider-failure-edit",
  "provider-failure-retry",
  "stop-recovery",
];

const candidate = (overrides = {}) => ({
  schemaVersion: 2,
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
    aiAcceptance: {
      status: "passed",
      releaseSha: SHA,
      runId: "018f47f0-72a4-7c3c-9b21-891c46ffcb16",
      runUrl: RUN_URL,
      artifactName: "staging-acceptance-123",
      startedAt: "2026-08-24T08:05:00.000Z",
      completedAt: "2026-08-24T08:10:00.000Z",
      assertions: AI_ASSERTIONS,
      lanes: AI_LANES,
      responseMocking: false,
      cleanup: { verified: true, residue: 0 },
    },
    verificationWindow: {
      before: {
        deployCheckedAt: "2026-08-24T08:04:00.000Z",
        topologyCheckedAt: "2026-08-24T08:04:00.000Z",
        clientDeployId: "netlify-staging-123",
        serverDeployId: "render-staging-456",
        configuredInstances: 1,
        currentInstances: 1,
      },
      after: {
        deployCheckedAt: "2026-08-24T08:11:00.000Z",
        topologyCheckedAt: "2026-08-24T08:11:00.000Z",
        clientDeployId: "netlify-staging-123",
        serverDeployId: "render-staging-456",
        configuredInstances: 1,
        currentInstances: 1,
      },
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

const rawAiEvidence = ({
  startedAt = "2026-08-24T08:05:00.000Z",
  completedAt = "2026-08-24T08:10:00.000Z",
} = {}) => ({
  schemaVersion: 1,
  kind: "staging-ai-chat-acceptance",
  releaseSha: SHA,
  runId: "018f47f0-72a4-7c3c-9b21-891c46ffcb16",
  status: "passed",
  startedAt,
  completedAt,
  syntheticIds: {
    userId: "507f1f77bcf86cd799439011",
    kbEntryId: "507f1f77bcf86cd799439012",
    capabilityJtis: [
      "018f47f0-72a4-7c3c-9b21-891c46ffcb17",
      "018f47f0-72a4-7c3c-9b21-891c46ffcb18",
      "018f47f0-72a4-7c3c-9b21-891c46ffcb19",
      "018f47f0-72a4-7c3c-9b21-891c46ffcb20",
    ],
  },
  sourceUrl: "https://www.who.int/news-room/fact-sheets/detail/physical-activity",
  assertions: AI_ASSERTIONS.map((name) => ({ name, passed: true })),
  lanes: AI_LANES.map((name) => ({ name, passed: true })),
  traceMetadata: {
    browser: "chromium",
    headless: true,
    locale: "vi-VN",
    trace: false,
    video: false,
    screenshot: false,
    har: false,
    storageState: false,
    responseMocking: false,
  },
  metricsDelta: {
    "kb.vector_fallbacks": 0,
    "kb.vector_root_fallbacks": 0,
    "kb.vector_variant_fallbacks": 0,
    "kb.vector_combined_fallbacks": 0,
    "provider.gemini_chat_failed": 0,
  },
  cleanup: {
    verified: true,
    residue: 0,
    collections: {
      staging_ai_acceptance_claims: 0,
      knowledgeentries: 0,
      chatconversations: 0,
      serviceusagebuckets: 0,
      aimemories: 0,
      aimemorypreferences: 0,
      aitoolconfirmations: 0,
      aimoderationstates: 0,
      users: 0,
      knowledgeQuestionDiscovery: 0,
    },
  },
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

test("candidate gate rejects an expected release SHA different from the artifact", () => {
  const value = candidate();
  const result = evaluateCandidateGate({
    candidate: value,
    expectedSha: "b".repeat(40),
    backupManifest: {
      schemaVersion: 1,
      policy: { releaseMaxAgeHours: 24, requireOffDeviceRecovery: true },
      latestVerifiedBackup: {
        backupId: value.recovery.backupId,
        completedAt: new Date().toISOString(),
        backupType: "logical_mongodump",
        archiveIntegrityVerified: true,
        isolatedRestoreVerified: true,
        sourceFingerprintMatched: true,
        continuousRecoveryAvailable: false,
        offDeviceRecoveryVerified: true,
        evidence: "docs/operations/production/backup-record.md",
      },
    },
  });

  assert.equal(result.ready, false);
  assert.ok(result.blockers.includes("EXPECTED_RELEASE_SHA_MISMATCH"));
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

test("release candidate fails closed on AI cleanup or post-AI verification drift", () => {
  const value = candidate();
  value.staging.aiAcceptance.cleanup = { verified: false, residue: 1 };
  value.staging.verificationWindow.after.serverDeployId = "render-staging-drift";

  const result = evaluateReleaseCandidate(value);
  assert.equal(result.ready, false);
  assert.deepEqual(result.blockers, [
    "STAGING_AI_CLEANUP_UNVERIFIED",
    "STAGING_POST_AI_SERVER_DEPLOY_MISMATCH",
  ]);
});

test("raw AC-009 evidence requires every lane, assertion and zero cleanup residue", () => {
  const raw = rawAiEvidence();

  const missingLane = structuredClone(raw);
  missingLane.lanes.pop();
  assert.throws(
    () => validateStagingAiAcceptanceEvidence(missingLane, { expectedSha: SHA }),
    /required lanes/i,
  );
  assert.equal(
    validateStagingAiAcceptanceEvidence(raw, { expectedSha: SHA }).cleanup.residue,
    0,
  );
});

test("release candidate CLI binds the actual AI evidence and post-AI verification files", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "release-candidate-ac009-"));
  const now = Date.now();
  const timestamp = (offsetMs) => new Date(now + offsetMs).toISOString();
  const files = {
    acceptance: {
      success: true,
      runId: "018f47f0-72a4-7c3c-9b21-891c46ffcb16",
      database: "htcoaching_staging",
      cleanup: { verified: true, residue: 0 },
    },
    ai: rawAiEvidence({ startedAt: timestamp(-9 * 60_000), completedAt: timestamp(-5 * 60_000) }),
    deployBefore: {
      schemaVersion: 1,
      checkedAt: timestamp(-10 * 60_000),
      sha: SHA,
      client: { provider: "netlify", deployId: "netlify-staging-123", sha: SHA, state: "ready" },
      server: { provider: "render", deployId: "render-staging-456", sha: SHA, state: "live" },
    },
    deployAfter: {
      schemaVersion: 1,
      checkedAt: timestamp(-4 * 60_000),
      sha: SHA,
      client: { provider: "netlify", deployId: "netlify-staging-123", sha: SHA, state: "ready" },
      server: { provider: "render", deployId: "render-staging-456", sha: SHA, state: "live" },
    },
    topologyBefore: {
      schemaVersion: 1,
      kind: "render-single-instance-topology",
      releaseSha: SHA,
      checkedAt: timestamp(-10 * 60_000),
      serviceTopology: { configuredInstances: 1, currentInstances: 1 },
    },
    topologyAfter: {
      schemaVersion: 1,
      kind: "render-single-instance-topology",
      releaseSha: SHA,
      checkedAt: timestamp(-4 * 60_000),
      serviceTopology: { configuredInstances: 1, currentInstances: 1 },
    },
    backup: {
      schemaVersion: 1,
      policy: { releaseMaxAgeHours: 24, requireOffDeviceRecovery: true },
      latestVerifiedBackup: {
        backupId: "production-logical-backup-current",
        completedAt: timestamp(-60 * 60_000),
        backupType: "logical_mongodump",
        archiveIntegrityVerified: true,
        isolatedRestoreVerified: true,
        sourceFingerprintMatched: true,
        continuousRecoveryAvailable: false,
        offDeviceRecoveryVerified: true,
        evidence: "docs/operations/production/backup-record.md",
      },
    },
  };
  const paths = Object.fromEntries(Object.entries(files).map(([name, value]) => {
    const file = path.join(directory, `${name}.json`);
    writeFileSync(file, `${JSON.stringify(value)}\n`);
    return [name, file];
  }));
  const output = path.join(directory, "candidate.json");
  try {
    const result = spawnSync(process.execPath, ["scripts/create-release-candidate.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        RELEASE_SHA: SHA,
        RELEASE_BRANCH: "staging",
        CI_STATUS: "passed",
        CI_SHA: SHA,
        CI_RUN_URL: RUN_URL,
        ACCEPTANCE_RUN_URL: RUN_URL,
        ACCEPTANCE_ARTIFACT_NAME: "staging-acceptance-123",
        STAGING_ACCEPTANCE_EVIDENCE: paths.acceptance,
        STAGING_AI_ACCEPTANCE_EVIDENCE: paths.ai,
        STAGING_DEPLOY_IDENTITY_EVIDENCE: paths.deployBefore,
        STAGING_DEPLOY_IDENTITY_POST_AI_EVIDENCE: paths.deployAfter,
        STAGING_RENDER_TOPOLOGY_EVIDENCE: paths.topologyBefore,
        STAGING_RENDER_TOPOLOGY_POST_AI_EVIDENCE: paths.topologyAfter,
        BACKUP_READINESS_MANIFEST: paths.backup,
        ROLLBACK_CLIENT_DEPLOY_ID: "netlify-production-known-good",
        ROLLBACK_SERVER_DEPLOY_ID: "render-production-known-good",
        RELEASE_CANDIDATE_OUTPUT: output,
      },
    });
    const manifest = result.status === 0 ? JSON.parse(readFileSync(output, "utf8")) : null;
    assert.deepEqual({
      status: result.status,
      schemaVersion: manifest?.schemaVersion,
      aiRunId: manifest?.staging?.aiAcceptance?.runId,
      postDeployId: manifest?.staging?.verificationWindow?.after?.serverDeployId,
    }, {
      status: 0,
      schemaVersion: 2,
      aiRunId: files.ai.runId,
      postDeployId: files.deployAfter.server.deployId,
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
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
