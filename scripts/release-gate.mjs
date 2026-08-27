import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { evaluateBackupReadiness } from "./lib/backup-readiness.mjs";
import {
  evaluatePostDeployEvidence,
  evaluateReleaseCandidate,
} from "./lib/release-evidence.mjs";

const parseArguments = (argv) => {
  const result = {};
  for (const argument of argv) {
    const match = /^--([a-z-]+)=(.+)$/.exec(argument);
    if (!match) throw new Error(`Unsupported argument: ${argument}`);
    result[match[1]] = match[2];
  }
  if (!result.mode || !result.manifest) {
    throw new Error("--mode and --manifest are required");
  }
  return result;
};

const readJson = async (file) =>
  JSON.parse(await readFile(path.resolve(file), "utf8"));

const candidateGate = async (args) => {
  if (!args["backup-manifest"]) {
    throw new Error("--backup-manifest is required for candidate mode");
  }
  const [candidate, backupManifest] = await Promise.all([
    readJson(args.manifest),
    readJson(args["backup-manifest"]),
  ]);
  const candidateResult = evaluateReleaseCandidate(candidate);
  const backup = evaluateBackupReadiness(backupManifest);
  const blockers = [...candidateResult.blockers];
  if (candidate.recovery.backupId !== backup.backupId) {
    blockers.push("BACKUP_ID_MISMATCH");
  }
  if (!backup.releaseReady) blockers.push("CURRENT_BACKUP_RELEASE_NOT_READY");
  if (!backup.disasterRecoveryReady) {
    blockers.push("CURRENT_OFF_DEVICE_RECOVERY_NOT_READY");
  }
  return {
    mode: "candidate",
    ready: blockers.length === 0,
    sha: candidateResult.sha,
    backupId: backup.backupId,
    blockers: [...new Set(blockers)],
    warnings: [
      ...new Set([
        ...candidateResult.warnings,
        ...backup.warnings.map(({ code }) => code),
      ]),
    ],
  };
};

const postDeployGate = async (args) => {
  if (!args.candidate) {
    throw new Error("--candidate is required for post-deploy mode");
  }
  const [evidence, candidate] = await Promise.all([
    readJson(args.manifest),
    readJson(args.candidate),
  ]);
  const candidateResult = evaluateReleaseCandidate(candidate);
  const postDeploy = evaluatePostDeployEvidence(evidence, candidate);
  return {
    mode: "post-deploy",
    ready: candidateResult.ready && postDeploy.ready,
    sha: postDeploy.sha,
    observationMinutes: postDeploy.observationMinutes,
    blockers: [...candidateResult.blockers, ...postDeploy.blockers],
  };
};

export const main = async (argv = process.argv.slice(2)) => {
  const args = parseArguments(argv);
  let result;
  if (args.mode === "candidate") result = await candidateGate(args);
  else if (args.mode === "post-deploy") result = await postDeployGate(args);
  else throw new Error(`Unsupported mode: ${args.mode}`);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result.ready ? 0 : 1;
};

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  try {
    process.exitCode = await main();
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify({ ready: false, error: error.message })}\n`,
    );
    process.exitCode = 1;
  }
}
