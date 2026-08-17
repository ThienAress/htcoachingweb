import { execFile as execFileCallback } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import {
  assertSourceBackupManifest,
  fingerprintFiles,
  parseRefs,
  safeRepoPath,
  sha256,
} from "./source-backup-manifest.mjs";

const execFile = promisify(execFileCallback);
const MAX_GIT_OUTPUT = 64 * 1024 * 1024;
const MANIFEST_FILE = "source-backup-manifest.json";

const run = async (command, args, options = {}) =>
  execFile(command, args, {
    cwd: options.cwd,
    encoding: options.encoding || "utf8",
    maxBuffer: MAX_GIT_OUTPUT,
    windowsHide: true,
  });

const canonicalPath = (value) => {
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
};

const isInside = (parent, candidate) => {
  const relative = path.relative(canonicalPath(parent), canonicalPath(candidate));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
};

const splitNull = (buffer) =>
  buffer
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .map(safeRepoPath);

const gitNullList = async (repoRoot, args) => {
  const { stdout } = await run("git", args, {
    cwd: repoRoot,
    encoding: "buffer",
  });
  return splitNull(stdout);
};

const existingFiles = async (repoRoot, relativePaths) => {
  const result = [];
  for (const relativePath of relativePaths) {
    const absolutePath = path.join(repoRoot, relativePath);
    try {
      if ((await stat(absolutePath)).isFile()) result.push(relativePath);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return result;
};

export const assertExternalTarget = (repoRoot, targetDirectory) => {
  if (!targetDirectory) throw new Error("A target directory is required");
  if (isInside(repoRoot, targetDirectory)) {
    throw new Error("Source backup target must be outside the repository");
  }
};

export const verifySourceBackup = async ({ packageDirectory }) => {
  const packageRoot = path.resolve(packageDirectory);
  const manifest = JSON.parse(
    await readFile(path.join(packageRoot, MANIFEST_FILE), "utf8"),
  );
  assertSourceBackupManifest(manifest);

  const bundlePath = path.join(packageRoot, "repository.bundle");
  const patchPath = path.join(packageRoot, "working-tree.patch");
  if ((await sha256(bundlePath)) !== manifest.bundleSha256) {
    throw new Error("Repository bundle checksum mismatch");
  }
  if ((await sha256(patchPath)) !== manifest.patchSha256) {
    throw new Error("Working tree patch checksum mismatch");
  }

  const restoreRoot = await mkdtemp(path.join(os.tmpdir(), "ht-source-restore-"));
  const verificationRepo = path.join(restoreRoot, "verification.git");
  const restoredRepo = path.join(restoreRoot, "repository");
  try {
    await run("git", ["init", "--bare", verificationRepo], { cwd: restoreRoot });
    await run("git", ["check-ref-format", "--branch", manifest.branch], {
      cwd: verificationRepo,
    });
    await run("git", ["bundle", "verify", bundlePath], {
      cwd: verificationRepo,
    });
    const { stdout: bundleRefsOutput } = await run(
      "git",
      ["bundle", "list-heads", bundlePath],
      { cwd: verificationRepo },
    );
    const bundleRefs = parseRefs(bundleRefsOutput);
    for (const sourceRef of manifest.refs) {
      if (
        !bundleRefs.some(
          (entry) =>
            entry.ref === sourceRef.ref && entry.object === sourceRef.object,
        )
      ) {
        throw new Error(`Repository bundle is missing ${sourceRef.ref}`);
      }
    }

    await run(
      "git",
      ["clone", "--branch", manifest.branch, bundlePath, restoredRepo],
      { cwd: restoreRoot },
    );
    await run("git", ["apply", "--binary", "--whitespace=nowarn", patchPath], {
      cwd: restoredRepo,
    });
    for (const entry of manifest.files) {
      const source = path.join(packageRoot, "worktree", entry.path);
      const relativePath = entry.path;
      const destination = path.join(restoredRepo, relativePath);
      await mkdir(path.dirname(destination), { recursive: true });
      await cp(source, destination);
    }
    await run("git", ["fsck", "--full"], { cwd: restoredRepo });

    for (const entry of manifest.files) {
      const restoredHash = await sha256(path.join(restoredRepo, entry.path));
      if (restoredHash !== entry.sha256) {
        throw new Error(`Restored source fingerprint mismatch: ${entry.path}`);
      }
    }
    for (const relativePath of manifest.deletedTrackedPaths) {
      try {
        await stat(path.join(restoredRepo, relativePath));
        throw new Error(`Deleted source path was restored: ${relativePath}`);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
  } finally {
    await rm(restoreRoot, { recursive: true, force: true });
  }

  return {
    backupId: manifest.backupId,
    branch: manifest.branch,
    dirty: manifest.dirty,
    fileCount: manifest.files.length,
    head: manifest.head,
    untrackedFileCount: manifest.untrackedPaths.length,
    verified: true,
  };
};

export const createSourceBackup = async ({
  repoRoot,
  targetDirectory,
  now = new Date(),
}) => {
  const sourceRoot = path.resolve(repoRoot);
  const targetRoot = path.resolve(targetDirectory);
  assertExternalTarget(sourceRoot, targetRoot);
  await run("git", ["rev-parse", "--is-inside-work-tree"], { cwd: sourceRoot });
  await mkdir(targetRoot, { recursive: true });
  const [realSourceRoot, realTargetRoot] = await Promise.all([
    realpath(sourceRoot),
    realpath(targetRoot),
  ]);
  assertExternalTarget(realSourceRoot, realTargetRoot);

  const stamp = now.toISOString().replaceAll(/[-:]/gu, "").replace(/\.\d{3}Z$/u, "Z");
  const backupId = `htcoachingweb-source-${stamp}`;
  const finalDirectory = path.join(targetRoot, backupId);
  const partialDirectory = path.join(
    targetRoot,
    `.partial-${backupId}-${randomUUID()}`,
  );
  await mkdir(partialDirectory, { recursive: true });

  try {
    const [{ stdout: head }, { stdout: branch }, { stdout: statusOutput }] =
      await Promise.all([
        run("git", ["rev-parse", "HEAD"], { cwd: sourceRoot }),
        run("git", ["branch", "--show-current"], { cwd: sourceRoot }),
        run("git", ["status", "--porcelain=v1", "-z"], {
          cwd: sourceRoot,
          encoding: "buffer",
        }),
      ]);
    const currentBranch = branch.trim();
    if (!currentBranch) throw new Error("Detached HEAD source backups are not supported");

    const bundlePath = path.join(partialDirectory, "repository.bundle");
    const patchPath = path.join(partialDirectory, "working-tree.patch");
    await run("git", ["bundle", "create", bundlePath, "--all"], {
      cwd: sourceRoot,
    });
    const { stdout: patch } = await run(
      "git",
      ["diff", "--binary", "--full-index", "HEAD"],
      { cwd: sourceRoot },
    );
    await writeFile(patchPath, patch, "utf8");

    const [untrackedPaths, candidateFiles, deletedTrackedPaths] = await Promise.all([
      gitNullList(sourceRoot, ["ls-files", "--others", "--exclude-standard", "-z"]),
      gitNullList(sourceRoot, [
        "ls-files",
        "--cached",
        "--others",
        "--exclude-standard",
        "-z",
      ]),
      gitNullList(sourceRoot, [
        "diff",
        "--name-only",
        "--diff-filter=D",
        "-z",
        "HEAD",
      ]),
    ]);
    const files = await existingFiles(sourceRoot, candidateFiles);
    for (const relativePath of files) {
      const destination = path.join(partialDirectory, "worktree", relativePath);
      await mkdir(path.dirname(destination), { recursive: true });
      await cp(path.join(sourceRoot, relativePath), destination);
    }
    const { stdout: refsOutput } = await run(
      "git",
      ["show-ref", "--heads", "--tags"],
      { cwd: sourceRoot },
    );
    const manifest = {
      schemaVersion: 1,
      backupId,
      createdAt: now.toISOString(),
      head: head.trim(),
      branch: currentBranch,
      dirty: statusOutput.length > 0,
      refs: parseRefs(refsOutput),
      bundleSha256: await sha256(bundlePath),
      patchSha256: await sha256(patchPath),
      files: await fingerprintFiles(sourceRoot, files),
      untrackedPaths: [...untrackedPaths].sort(),
      deletedTrackedPaths: [...deletedTrackedPaths].sort(),
      ignoredFilesIncluded: false,
    };
    await writeFile(
      path.join(partialDirectory, MANIFEST_FILE),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8",
    );

    await verifySourceBackup({ packageDirectory: partialDirectory });
    await rename(partialDirectory, finalDirectory);
    const result = await verifySourceBackup({ packageDirectory: finalDirectory });
    return { ...result, directoryName: path.basename(finalDirectory) };
  } catch (error) {
    await rm(partialDirectory, { recursive: true, force: true });
    await rm(finalDirectory, { recursive: true, force: true });
    throw error;
  }
};
