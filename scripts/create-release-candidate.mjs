import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { evaluateBackupReadiness } from "./lib/backup-readiness.mjs";
import { validateDeploymentIdentityEvidence } from "./lib/deployment-identity.mjs";
import { evaluateReleaseCandidate } from "./lib/release-evidence.mjs";

const required = (name) => {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const readJson = async (file) =>
  JSON.parse(await readFile(path.resolve(file), "utf8"));

const main = async () => {
  const [acceptance, deployment, backupManifest] = await Promise.all([
    readJson(required("STAGING_ACCEPTANCE_EVIDENCE")),
    readJson(required("STAGING_DEPLOY_IDENTITY_EVIDENCE")),
    readJson(required("BACKUP_READINESS_MANIFEST")),
  ]);
  const backup = evaluateBackupReadiness(backupManifest);
  const releaseSha = required("RELEASE_SHA").toLowerCase();
  validateDeploymentIdentityEvidence(deployment, { expectedSha: releaseSha });
  const candidate = {
    schemaVersion: 1,
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
        deployId: deployment.client.deployId,
        sha: deployment.client.sha,
      },
      server: {
        deployId: deployment.server.deployId,
        sha: deployment.server.sha,
      },
      acceptance: {
        status: acceptance.success === true ? "passed" : "failed",
        runId: acceptance.runId,
        runUrl: required("ACCEPTANCE_RUN_URL"),
        artifactName: required("ACCEPTANCE_ARTIFACT_NAME"),
        database: acceptance.database,
        cleanup: {
          verified: acceptance.cleanup?.verified === true,
          residue: Number(acceptance.cleanup?.residue ?? -1),
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
