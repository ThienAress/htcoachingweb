import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { isCanonicalRepositoryRelativePath } from "./repository-path.mjs";
import { decodeSensitiveTextBytes } from "./sensitive-text.mjs";

const MAX_GIT_LIST_BYTES = 10 * 1024 * 1024;
const MAX_GIT_METADATA_BYTES = 64 * 1024;

const isInside = (parentPath, childPath) => {
  const relativePath = path.relative(parentPath, childPath);
  return (
    relativePath === "" ||
    (
      relativePath !== ".."
      && !relativePath.startsWith(`..${path.sep}`)
      && !path.isAbsolute(relativePath)
    )
  );
};

const runGit = (repositoryRoot, args, { maxBuffer = MAX_GIT_LIST_BYTES } = {}) => {
  const result = spawnSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer,
  });
  if (result.status !== 0 || result.error) {
    throw new Error("Unable to inspect documentation candidates");
  }
  return result.stdout;
};

const runGitBytes = (
  repositoryRoot,
  args,
  { maxBuffer = MAX_GIT_LIST_BYTES } = {},
) => {
  const result = spawnSync("git", args, {
    cwd: repositoryRoot,
    encoding: null,
    maxBuffer,
  });
  if (result.status !== 0 || result.error || !Buffer.isBuffer(result.stdout)) {
    throw new Error("Unable to inspect documentation candidates");
  }
  return result.stdout;
};

const gitStateArguments = (trackedPaths) => ({
  candidates: [
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard",
    "-z",
    "--",
    ...trackedPaths,
  ],
  index: ["ls-files", "--stage", "-z", "--", ...trackedPaths],
  status: [
    "status",
    "--porcelain=v1",
    "-z",
    "--untracked-files=all",
    "--",
    ...trackedPaths,
  ],
  flags: ["ls-files", "-v", "-z", "--", ...trackedPaths],
});

const digestGitOutput = (value) =>
  createHash("sha256").update(value, "utf8").digest("hex");

const captureGitDocumentationState = (repositoryRoot, trackedPaths) => {
  const argsByType = gitStateArguments(trackedPaths);
  const outputs = Object.fromEntries(
    Object.entries(argsByType).map(([type, args]) => [type, runGit(repositoryRoot, args)]),
  );
  const fingerprints = Object.freeze(Object.fromEntries(
    Object.entries(outputs).map(([type, output]) => [type, digestGitOutput(output)]),
  ));

  return {
    outputs,
    snapshot: Object.freeze({
      repositoryRoot,
      trackedPaths: Object.freeze([...trackedPaths]),
      fingerprints,
    }),
  };
};

export const assertGitDocumentationStateUnchanged = (snapshot) => {
  const current = captureGitDocumentationState(
    snapshot.repositoryRoot,
    snapshot.trackedPaths,
  ).snapshot;
  const changed = Object.keys(snapshot.fingerprints).some(
    (type) => current.fingerprints[type] !== snapshot.fingerprints[type],
  );
  if (changed) {
    throw new Error("Git state changed during scanning");
  }
};

export const collectGitDocumentationCandidates = ({
  repositoryRoot,
  allowedRoot,
  trackedPaths,
  isDocumentFile,
}) => {
  const { outputs, snapshot: gitStateSnapshot } = captureGitDocumentationState(
    allowedRoot,
    trackedPaths,
  );
  const workingTreeDisplayPaths = outputs.candidates
    .split("\0")
    .filter(Boolean)
    .filter(isDocumentFile)
    .sort();
  if (workingTreeDisplayPaths.some((displayPath) => (
    !isCanonicalRepositoryRelativePath(displayPath)
  ))) {
    throw new Error("Documentation paths must be canonical repository paths");
  }
  const indexOutput = outputs.index;
  const indexTargets = [];

  for (const entry of indexOutput.split("\0").filter(Boolean)) {
    const separatorIndex = entry.indexOf("\t");
    if (separatorIndex === -1) {
      throw new Error("Unable to parse the documentation index");
    }
    const [mode, objectId, stage] = entry.slice(0, separatorIndex).split(" ");
    const displayPath = entry.slice(separatorIndex + 1);
    if (!isDocumentFile(displayPath)) continue;
    if (!isCanonicalRepositoryRelativePath(displayPath)) {
      throw new Error("Documentation paths must be canonical repository paths");
    }
    if (stage !== "0") {
      throw new Error("Unmerged documentation index entries are not allowed");
    }
    if (mode === "120000") {
      throw new Error("Documentation symbolic links are not allowed");
    }
    if (!/^100(?:644|755)$/.test(mode) || !/^[0-9a-f]{40,64}$/i.test(objectId)) {
      throw new Error("Documentation index entries must be regular files");
    }
    const absolutePath = path.resolve(repositoryRoot, displayPath);
    if (!isInside(repositoryRoot, absolutePath)) {
      throw new Error("Documentation path escapes the repository");
    }
    indexTargets.push({
      source: "git-index",
      objectId,
      repositoryRoot: allowedRoot,
      absolutePath,
      displayPath,
      allowedRoot,
      gitStateSnapshot,
    });
  }

  return { gitStateSnapshot, indexTargets, workingTreeDisplayPaths };
};

export const readGitIndexDocument = (target, { maxDocumentBytes }) => {
  const sizeOutput = runGit(
    target.repositoryRoot,
    ["cat-file", "-s", target.objectId],
    { maxBuffer: MAX_GIT_METADATA_BYTES },
  ).trim();
  const size = Number(sizeOutput);
  if (!Number.isSafeInteger(size) || size < 0) {
    throw new Error("Documentation index blob has an invalid size");
  }
  if (size > maxDocumentBytes) {
    throw new Error("Documentation target exceeds the scan size limit");
  }
  const content = runGitBytes(
    target.repositoryRoot,
    ["cat-file", "blob", target.objectId],
    { maxBuffer: maxDocumentBytes + 1024 },
  );
  if (content.length !== size || content.length > maxDocumentBytes) {
    throw new Error("Documentation target exceeds the scan size limit");
  }
  return {
    byteLength: content.length,
    content: decodeSensitiveTextBytes(content),
  };
};
