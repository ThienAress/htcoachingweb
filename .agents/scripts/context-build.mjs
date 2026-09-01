#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  capturePlanDirectorySnapshot,
  validatePlanStateManifest,
} from "./plan-state-contract.mjs";
import { validateTraceabilityManifest } from "./traceability-contract.mjs";
import { findPrivacyTypes } from "../../scripts/lib/docs-privacy.mjs";
import { isCanonicalRepositoryRelativePath } from "../../scripts/lib/repository-path.mjs";
import { hasSecretLikeText } from "../../scripts/lib/sensitive-text.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const MAX_FILE_BYTES = 2_000_000;
const MAX_READ_SET_BYTES = 16_000_000;
const MAX_TASKS = 128;
const MAX_REQUIREMENTS = 128;
const MAX_ACCEPTANCE_CRITERIA = 512;
const MAX_VERIFICATIONS = 512;
const compareText = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function isInside(parentPath, childPath) {
  const relativePath = path.relative(parentPath, childPath);
  return (
    relativePath === "" ||
    (!relativePath.startsWith(`..${path.sep}`) &&
      relativePath !== ".." &&
      !path.isAbsolute(relativePath))
  );
}

function requireSafeRelativePath(rootDir, relativePath) {
  if (
    !isCanonicalRepositoryRelativePath(relativePath)
    || findPrivacyTypes(relativePath).length > 0
    || hasSecretLikeText(relativePath, { repositoryPath: true })
  ) {
    throw new Error("Invalid context artifacts");
  }
  const resolvedRoot = path.resolve(rootDir);
  const resolvedPath = path.resolve(resolvedRoot, relativePath);
  if (!isInside(resolvedRoot, resolvedPath)) {
    throw new Error("Invalid context artifacts");
  }
  return resolvedPath;
}

function sameStatSnapshot(left, right) {
  return (
    left.isFile()
    && right.isFile()
    && left.dev === right.dev
    && left.ino === right.ino
    && left.mode === right.mode
    && left.size === right.size
    && left.mtimeNs === right.mtimeNs
    && left.ctimeNs === right.ctimeNs
  );
}

function readExactBytes(fileDescriptor, expectedBytes) {
  const bytes = Buffer.alloc(expectedBytes);
  let offset = 0;
  while (offset < expectedBytes) {
    const bytesRead = fs.readSync(
      fileDescriptor,
      bytes,
      offset,
      expectedBytes - offset,
      null,
    );
    if (bytesRead === 0) throw new Error("Context artifact changed while reading");
    offset += bytesRead;
  }
  const overflowProbe = Buffer.allocUnsafe(1);
  if (fs.readSync(fileDescriptor, overflowProbe, 0, 1, null) !== 0) {
    throw new Error("Context artifact changed while reading");
  }
  return bytes;
}

function readBoundedArtifact(
  rootDir,
  relativePath,
  {
    maxBytes = MAX_FILE_BYTES,
    sizeLimitMessage = "Context artifact exceeds size limit",
  } = {},
) {
  const resolvedPath = requireSafeRelativePath(rootDir, relativePath);
  let fileDescriptor;
  try {
    const fileStats = fs.lstatSync(resolvedPath, { bigint: true });
    if (!fileStats.isFile() || fileStats.isSymbolicLink()) {
      throw new Error("Invalid context artifacts");
    }
    const realRoot = fs.realpathSync(rootDir);
    const realPath = fs.realpathSync(resolvedPath);
    if (!isInside(realRoot, realPath)) throw new Error("Invalid context artifacts");
    const openFlags = fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0);
    fileDescriptor = fs.openSync(resolvedPath, openFlags);
    const descriptorStats = fs.fstatSync(fileDescriptor, { bigint: true });
    if (
      !sameStatSnapshot(fileStats, descriptorStats)
      || descriptorStats.size > BigInt(maxBytes)
    ) {
      if (descriptorStats.size > BigInt(maxBytes)) throw new Error(sizeLimitMessage);
      throw new Error("Context artifact changed while reading");
    }
    const expectedBytes = Number(descriptorStats.size);
    const bytes = readExactBytes(fileDescriptor, expectedBytes);
    const finalDescriptorStats = fs.fstatSync(fileDescriptor, { bigint: true });
    const finalStats = fs.lstatSync(resolvedPath, { bigint: true });
    const finalRealPath = fs.realpathSync(resolvedPath);
    if (
      bytes.length !== expectedBytes
      || bytes.length > MAX_FILE_BYTES
      || !sameStatSnapshot(descriptorStats, finalDescriptorStats)
      || !sameStatSnapshot(finalDescriptorStats, finalStats)
      || realPath !== finalRealPath
      || !isInside(realRoot, finalRealPath)
    ) {
      throw new Error("Context artifact changed while reading");
    }
    return {
      bytes,
      metadata: {
        path: relativePath.replaceAll("\\", "/"),
        bytes: bytes.length,
        sha256: sha256(bytes),
      },
    };
  } catch (error) {
    if (error?.code === "ENOENT") throw new Error("Context artifact is missing");
    if (error?.message?.startsWith("Context ")) throw error;
    throw new Error("Invalid context artifacts");
  } finally {
    if (fileDescriptor !== undefined) fs.closeSync(fileDescriptor);
  }
}

function readBoundedArtifactSet(rootDir, relativePaths) {
  const artifacts = [];
  let totalBytes = 0;
  for (const relativePath of relativePaths) {
    const remainingBytes = MAX_READ_SET_BYTES - totalBytes;
    const aggregateBoundApplies = remainingBytes < MAX_FILE_BYTES;
    const artifact = readBoundedArtifact(rootDir, relativePath, {
      maxBytes: Math.min(MAX_FILE_BYTES, Math.max(remainingBytes, 0)),
      sizeLimitMessage: aggregateBoundApplies
        ? "Context read-set exceeds aggregate size limit"
        : "Context artifact exceeds size limit",
    });
    totalBytes += artifact.bytes.length;
    artifacts.push(artifact);
  }
  return artifacts;
}

function parseJsonArtifact(rootDir, relativePath) {
  const artifact = readBoundedArtifact(rootDir, relativePath);
  try {
    return { ...artifact, value: JSON.parse(artifact.bytes.toString("utf8").replace(/^\uFEFF/, "")) };
  } catch {
    throw new Error("Invalid context artifacts");
  }
}

function enforceTraceLimits(trace) {
  if (!Array.isArray(trace.tasks) || trace.tasks.length > MAX_TASKS) {
    throw new Error("Context limit exceeded");
  }
  if (!Array.isArray(trace.requirements) || trace.requirements.length > MAX_REQUIREMENTS) {
    throw new Error("Context limit exceeded");
  }
  let acceptanceCriteria = 0;
  let verifications = 0;
  for (const requirement of trace.requirements) {
    acceptanceCriteria += Array.isArray(requirement.acceptanceCriteria)
      ? requirement.acceptanceCriteria.length
      : MAX_ACCEPTANCE_CRITERIA + 1;
    for (const criterion of requirement.acceptanceCriteria || []) {
      verifications += Array.isArray(criterion.verifications)
        ? criterion.verifications.length
        : MAX_VERIFICATIONS + 1;
    }
  }
  if (acceptanceCriteria > MAX_ACCEPTANCE_CRITERIA || verifications > MAX_VERIFICATIONS) {
    throw new Error("Context limit exceeded");
  }
}

function sanitizedGitEnvironment() {
  const environment = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (!/^GIT_/i.test(name)) environment[name] = value;
  }
  environment.GIT_NO_REPLACE_OBJECTS = "1";
  environment.GIT_TERMINAL_PROMPT = "0";
  return environment;
}

function runRepositoryGit(rootDir, args) {
  return spawnSync("git", ["-C", rootDir, ...args], {
    cwd: rootDir,
    encoding: "utf8",
    env: sanitizedGitEnvironment(),
    windowsHide: true,
  });
}

function readGitHead(rootDir) {
  const worktreeResult = runRepositoryGit(rootDir, ["rev-parse", "--is-inside-work-tree"]);
  if (
    worktreeResult.status !== 0 ||
    worktreeResult.error ||
    worktreeResult.stdout.trim() !== "true"
  ) {
    throw new Error("Invalid Git metadata");
  }
  const result = runRepositoryGit(rootDir, ["rev-parse", "--verify", "HEAD^{commit}"]);
  if (result.status === 0 && !result.error) {
    const head = result.stdout.trim().toLowerCase();
    if (!/^[0-9a-f]{40,64}$/.test(head)) throw new Error("Invalid Git metadata");
    return head;
  }
  const rawHead = runRepositoryGit(rootDir, ["rev-parse", "--verify", "HEAD"]);
  if (rawHead.status === 0 || rawHead.error) {
    throw new Error("Invalid Git metadata");
  }
  const symbolicHead = runRepositoryGit(rootDir, ["symbolic-ref", "-q", "HEAD"]);
  if (
    symbolicHead.status === 0
    && !symbolicHead.error
    && /^refs\/heads\/[^\r\n]+$/.test(symbolicHead.stdout.trim())
  ) {
    return "unborn";
  }
  throw new Error("Invalid Git metadata");
}

function safeCapturePlanDirectorySnapshot(rootDir, planState) {
  try {
    return capturePlanDirectorySnapshot({
      rootDir,
      planPaths: Array.isArray(planState?.plans)
        ? planState.plans.map((plan) => plan?.path)
        : [],
    });
  } catch {
    throw new Error("Invalid context plan state");
  }
}

function safeValidatePlanState(
  planState,
  rootDir,
  plansIndexSnapshot,
  planDirectorySnapshot,
) {
  try {
    validatePlanStateManifest(planState, {
      rootDir,
      plansIndexSnapshot,
      planDirectorySnapshot,
    });
  } catch {
    throw new Error("Invalid context plan state");
  }
}

function safeValidateTrace(trace, rootDir, fileName, artifactSnapshots) {
  try {
    validateTraceabilityManifest(trace, { rootDir, fileName, artifactSnapshots });
  } catch {
    throw new Error("Invalid context artifacts");
  }
}

export function buildContextManifest({ rootDir, planId }) {
  if (typeof planId !== "string" || !/^\d{3}[A-Za-z]?$/.test(planId)) {
    throw new Error("Plan ID has an invalid format");
  }
  const canonicalPlanId = planId.toUpperCase();
  const resolvedRoot = path.resolve(rootDir);
  const statePath = "docs/plans/plan-state.json";
  const planIndexPath = "docs/plans/README.md";
  const tracePath = `docs/plans/traceability/${canonicalPlanId.toLowerCase()}.json`;
  const stateArtifact = parseJsonArtifact(resolvedRoot, statePath);
  const planIndexArtifact = readBoundedArtifact(resolvedRoot, planIndexPath);
  const planDirectorySnapshot = safeCapturePlanDirectorySnapshot(
    resolvedRoot,
    stateArtifact.value,
  );
  safeValidatePlanState(
    stateArtifact.value,
    resolvedRoot,
    {
      path: planIndexArtifact.metadata.path,
      bytes: planIndexArtifact.bytes,
    },
    planDirectorySnapshot,
  );
  if (Number(canonicalPlanId.slice(0, 3)) <= Number(stateArtifact.value.legacyCutoff)) {
    throw new Error("Plan ID is outside the context contract");
  }
  const planState = stateArtifact.value.plans.find((entry) => entry.id === canonicalPlanId);
  if (!planState) throw new Error("Plan is not registered");
  const initialHead = readGitHead(resolvedRoot);

  const traceArtifact = parseJsonArtifact(resolvedRoot, tracePath);
  const trace = traceArtifact.value;
  enforceTraceLimits(trace);
  const declaredArtifacts = [
    ["specPath", trace.specPath],
    ["planPath", trace.planPath],
  ];
  const initialArtifacts = [
    stateArtifact.metadata,
    planIndexArtifact.metadata,
    traceArtifact.metadata,
  ];
  const declaredArtifactSnapshots = {};
  for (const [field, relativePath] of declaredArtifacts) {
    const artifact = readBoundedArtifact(resolvedRoot, relativePath);
    initialArtifacts.push(artifact.metadata);
    declaredArtifactSnapshots[field] = {
      path: artifact.metadata.path,
      bytes: artifact.bytes,
    };
  }
  safeValidateTrace(
    trace,
    resolvedRoot,
    `${canonicalPlanId.toLowerCase()}.json`,
    declaredArtifactSnapshots,
  );
  if (trace.planPath !== planState.path) throw new Error("Invalid context artifacts");

  const verificationPaths = [
    ...new Set(
      trace.requirements.flatMap((requirement) =>
        requirement.acceptanceCriteria.flatMap((criterion) =>
          criterion.verifications
            .filter((verification) => verification.type === "test")
            .map((verification) => {
              requireSafeRelativePath(resolvedRoot, verification.path);
              return verification.path;
            }),
        ),
      ),
    ),
  ].sort(compareText);
  const readPaths = [
    statePath,
    planIndexPath,
    tracePath,
    trace.specPath,
    trace.planPath,
    ...verificationPaths,
  ];
  const uniqueReadPaths = [...new Set(readPaths)];
  const readSet = readBoundedArtifactSet(resolvedRoot, uniqueReadPaths)
    .map((artifact) => artifact.metadata)
    .sort((left, right) => compareText(left.path, right.path));
  const readSetByPath = new Map(readSet.map((entry) => [entry.path, entry]));
  for (const initialArtifact of initialArtifacts) {
    const finalArtifact = readSetByPath.get(initialArtifact.path);
    if (
      !finalArtifact ||
      finalArtifact.bytes !== initialArtifact.bytes ||
      finalArtifact.sha256 !== initialArtifact.sha256
    ) {
      throw new Error("Context artifacts changed during collection");
    }
  }
  const finalReadSet = readBoundedArtifactSet(
    resolvedRoot,
    readSet.map((entry) => entry.path),
  ).map((artifact) => artifact.metadata);
  for (const finalArtifact of finalReadSet) {
    const observedArtifact = readSetByPath.get(finalArtifact.path);
    if (
      !observedArtifact
      || finalArtifact.bytes !== observedArtifact.bytes
      || finalArtifact.sha256 !== observedArtifact.sha256
    ) {
      throw new Error("Context artifacts changed during collection");
    }
  }
  const finalPlanDirectorySnapshot = safeCapturePlanDirectorySnapshot(
    resolvedRoot,
    stateArtifact.value,
  );
  if (JSON.stringify(finalPlanDirectorySnapshot) !== JSON.stringify(planDirectorySnapshot)) {
    throw new Error("Context artifacts changed during collection");
  }
  if (readGitHead(resolvedRoot) !== initialHead) {
    throw new Error("Git metadata changed during collection");
  }

  const projection = {
    schemaVersion: 1,
    repository: {
      head: initialHead,
      planDirectorySha256: sha256(JSON.stringify(planDirectorySnapshot)),
    },
    plan: {
      id: canonicalPlanId,
      planPath: trace.planPath.replaceAll("\\", "/"),
      specPath: trace.specPath.replaceAll("\\", "/"),
      priority: planState.priority,
      lifecycle: planState.lifecycle,
      updatedAt: planState.updatedAt,
    },
    tasks: trace.tasks
      .map((task) => ({ id: task.id, planStep: task.planStep }))
      .sort((left, right) => compareText(left.id, right.id)),
    requirements: trace.requirements
      .map((requirement) => ({
        id: requirement.id,
        acceptanceCriteria: requirement.acceptanceCriteria
          .map((criterion) => ({
            id: criterion.id,
            taskIds: [...criterion.taskIds].sort(compareText),
          }))
          .sort((left, right) => compareText(left.id, right.id)),
      }))
      .sort((left, right) => compareText(left.id, right.id)),
    verificationPaths,
    counts: {
      tasks: trace.tasks.length,
      requirements: trace.requirements.length,
      acceptanceCriteria: trace.requirements.reduce(
        (total, requirement) => total + requirement.acceptanceCriteria.length,
        0,
      ),
      verificationPaths: verificationPaths.length,
      readSet: readSet.length,
    },
    readSet,
  };
  return { ...projection, fingerprint: sha256(JSON.stringify(projection)) };
}

function parseCliArguments(argv) {
  if (argv.length !== 2 || argv[0] !== "--plan") {
    throw new Error("Usage: context-build --plan <plan-id>");
  }
  return argv[1];
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  try {
    const planId = parseCliArguments(process.argv.slice(2));
    const manifest = buildContextManifest({ rootDir: process.cwd(), planId });
    process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
