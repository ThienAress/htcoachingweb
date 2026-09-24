import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { evaluateBackupReadiness } from "./lib/backup-readiness.mjs";
import {
  validateDeploymentIdentityEvidence,
} from "./lib/deployment-identity.mjs";
import {
  evaluateReleaseCandidate,
  validateStagingAiAcceptanceEvidence,
} from "./lib/release-evidence.mjs";

const required = (name) => {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const readJson = async (file) =>
  JSON.parse(await readFile(path.resolve(file), "utf8"));

const main = async () => {
  const [
    acceptance,
    aiAcceptanceEvidence,
    deploymentBefore,
    deploymentAfter,
    backupManifest,
  ] = await Promise.all([
    readJson(required("STAGING_ACCEPTANCE_EVIDENCE")),
    readJson(required("STAGING_AI_ACCEPTANCE_EVIDENCE")),
    readJson(required("STAGING_DEPLOY_IDENTITY_EVIDENCE")),
    readJson(required("STAGING_DEPLOY_IDENTITY_POST_AI_EVIDENCE")),
    readJson(required("BACKUP_READINESS_MANIFEST")),
  ]);
  const backup = evaluateBackupReadiness(backupManifest);
  const releaseSha = required("RELEASE_SHA").toLowerCase();
  validateDeploymentIdentityEvidence(deploymentBefore, { expectedSha: releaseSha });
  validateDeploymentIdentityEvidence(deploymentAfter, { expectedSha: releaseSha });
  const aiAcceptance = validateStagingAiAcceptanceEvidence(aiAcceptanceEvidence, {
    expectedSha: releaseSha,
  });
  const runUrl = required("ACCEPTANCE_RUN_URL");
  const artifactName = required("ACCEPTANCE_ARTIFACT_NAME");
  const candidate = {
    schemaVersion: 3,
    kind: "release-candidate",
    release: {
      sha: releaseSha,
      branch: required("RELEASE_BRANCH"),
      createdAt: new Date().toISOString(),
    },
    ci: {
      status: required("CI_STATUS"),
      sha: required("CI_SHA").toLowerCase(),
      runUrl: required("CI_RUN_URL"),
    },
    staging: {
      client: {
        deployId: deploymentAfter.client.deployId,
        sha: deploymentAfter.client.sha,
      },
      server: {
        deployId: deploymentAfter.server.deployId,
        sha: deploymentAfter.server.sha,
      },
      acceptance: {
        status: acceptance.success === true ? "passed" : "failed",
        runId: acceptance.runId,
        runUrl,
        artifactName,
        database: acceptance.database,
        cleanup: {
          verified: acceptance.cleanup?.verified === true,
          residue: Number(acceptance.cleanup?.residue ?? -1),
        },
      },
      aiAcceptance: {
        ...aiAcceptance,
        runUrl,
        artifactName,
      },
      verificationWindow: {
        before: {
          deployCheckedAt: deploymentBefore.checkedAt,
          clientDeployId: deploymentBefore.client.deployId,
          serverDeployId: deploymentBefore.server.deployId,
        },
        after: {
          deployCheckedAt: deploymentAfter.checkedAt,
          clientDeployId: deploymentAfter.client.deployId,
          serverDeployId: deploymentAfter.server.deployId,
        },
      },
    },
    recovery: {
      backupId: backup.backupId,
      releaseReady: backup.releaseReady,
      disasterRecoveryReady: backup.disasterRecoveryReady,
      continuousRecoveryAvailable: backup.continuousRecoveryAvailable,
      evidence: backup.evidence,
    },
    rollback: {
      clientDeployId: required("ROLLBACK_CLIENT_DEPLOY_ID"),
      serverDeployId: required("ROLLBACK_SERVER_DEPLOY_ID"),
    },
  };
  const result = evaluateReleaseCandidate(candidate);
  if (!result.ready) {
    throw new Error(`Release candidate is blocked: ${result.blockers.join(", ")}`);
  }
  const outputPath = path.resolve(required("RELEASE_CANDIDATE_OUTPUT"));
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(candidate, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
};

main().catch((error) => {
  process.stderr.write(
    `${JSON.stringify({ ready: false, error: error.message })}\n`,
  );
  process.exitCode = 1;
});
