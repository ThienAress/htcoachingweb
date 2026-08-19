import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const safeRepoPath = (value) => {
  const normalized = value.replaceAll("\\", "/");
  if (
    !normalized ||
    path.posix.isAbsolute(normalized) ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized.includes("/../")
  ) {
    throw new Error(`Unsafe repository path: ${value}`);
  }
  return normalized;
};

export const sha256 = async (filePath) => {
  const hash = createHash("sha256");
  hash.update(await readFile(filePath));
  return hash.digest("hex");
};

export const fingerprintFiles = async (root, relativePaths) => {
  const fingerprints = [];
  for (const relativePath of [...relativePaths].sort()) {
    fingerprints.push({
      path: safeRepoPath(relativePath),
      sha256: await sha256(path.join(root, relativePath)),
    });
  }
  return fingerprints;
};

export const parseRefs = (value) =>
  value
    .trim()
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf(" ");
      if (separator < 1) throw new Error("Invalid Git ref output");
      return { object: line.slice(0, separator), ref: line.slice(separator + 1) };
    })
    .sort((left, right) => left.ref.localeCompare(right.ref));

export const assertSourceBackupManifest = (manifest) => {
  if (!manifest || manifest.schemaVersion !== 1) {
    throw new Error("Unsupported source backup manifest");
  }
  if (
    !Array.isArray(manifest.files) ||
    !Array.isArray(manifest.refs) ||
    !Array.isArray(manifest.untrackedPaths) ||
    !Array.isArray(manifest.deletedTrackedPaths)
  ) {
    throw new Error("Source backup manifest is incomplete");
  }
  if (!/^htcoachingweb-source-\d{8}T\d{6}Z$/u.test(manifest.backupId)) {
    throw new Error("Source backup manifest contains an invalid backup ID");
  }
  for (const entry of manifest.files) {
    safeRepoPath(entry.path);
    if (!/^[a-f0-9]{64}$/u.test(entry.sha256)) {
      throw new Error("Source backup manifest contains an invalid checksum");
    }
  }
  for (const entry of manifest.refs) {
    if (
      !/^[a-f0-9]{40,64}$/u.test(entry.object) ||
      !/^refs\/(heads|tags)\//u.test(entry.ref)
    ) {
      throw new Error("Source backup manifest contains an invalid Git ref");
    }
  }
  for (const relativePath of manifest.untrackedPaths) safeRepoPath(relativePath);
  for (const relativePath of manifest.deletedTrackedPaths) safeRepoPath(relativePath);
};
