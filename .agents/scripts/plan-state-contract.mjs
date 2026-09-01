import fs from "node:fs";
import path from "node:path";
import { isCanonicalRepositoryRelativePath } from "../../scripts/lib/repository-path.mjs";
import { stripNonContractMarkdown } from "./markdown-contract.mjs";

const LIFECYCLES = new Set(["planned", "in_progress", "done", "blocked", "rejected"]);
const VERIFICATIONS = new Set(["none", "focused", "local_full", "staging", "production"]);
const ROLLOUTS = new Set(["not_applicable", "not_started", "pending", "live"]);
const PRIORITIES = new Set(["P0", "P1", "P2", "P3"]);
const COMPLEXITIES = new Set(["simple", "moderate", "complex"]);
const LEGACY_CUTOFF = "076";
const PLANS_DIRECTORY = "docs/plans";
const PLANS_INDEX_PATH = `${PLANS_DIRECTORY}/README.md`;
const MAX_PLAN_DIRECTORY_ENTRIES = 512;
const PLAN_FILE_PATTERN = /^(\d{3})([a-z]?)-/i;
const PLAN_ENTRY_KINDS = new Set(["file", "directory", "symlink", "other"]);
const MAX_MANIFEST_BYTES = 2_000_000;
const compareText = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

function requireObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function requireClosedObject(value, allowedFields, label) {
  requireObject(value, label);
  for (const field of Object.keys(value)) {
    if (!allowedFields.includes(field)) {
      throw new Error(`${label} contains an unsupported field`);
    }
  }
}

function requireString(value, label, pattern) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  if (pattern && !pattern.test(value)) throw new Error(`${label} has an invalid format`);
}

function requireCalendarDate(value, label) {
  requireString(value, label, /^\d{4}-\d{2}-\d{2}$/);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`${label} has an invalid calendar date`);
  }
}

function resolveRepositoryPath(rootDir, relativePath, label) {
  requireString(relativePath, label);
  if (!isCanonicalRepositoryRelativePath(relativePath)) {
    throw new Error(`${label} must be repository-relative`);
  }
  const resolvedRoot = path.resolve(rootDir);
  const resolved = path.resolve(rootDir, relativePath);
  if (!resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`${label} escapes the repository`);
  }
  return resolved;
}

function isInside(parentPath, childPath) {
  const relativePath = path.relative(parentPath, childPath);
  return (
    relativePath === "" ||
    (!relativePath.startsWith(`..${path.sep}`) && relativePath !== ".." && !path.isAbsolute(relativePath))
  );
}

function sameDirectoryStats(left, right) {
  return (
    left.isDirectory()
    && right.isDirectory()
    && !left.isSymbolicLink()
    && !right.isSymbolicLink()
    && left.dev === right.dev
    && left.ino === right.ino
    && left.mode === right.mode
    && left.size === right.size
    && left.mtimeNs === right.mtimeNs
    && left.ctimeNs === right.ctimeNs
  );
}

function sameFileStats(left, right) {
  return (
    left.isFile()
    && right.isFile()
    && !left.isSymbolicLink()
    && !right.isSymbolicLink()
    && left.dev === right.dev
    && left.ino === right.ino
    && left.mode === right.mode
    && left.size === right.size
    && left.mtimeNs === right.mtimeNs
    && left.ctimeNs === right.ctimeNs
  );
}

function readRepositoryRegularFile(rootDir, filePath, label) {
  const resolvedRoot = path.resolve(rootDir);
  const resolvedPath = path.resolve(filePath);
  if (!isInside(resolvedRoot, resolvedPath)) throw new Error(`${label} escapes the repository`);
  let descriptor;
  try {
    const before = fs.lstatSync(resolvedPath, { bigint: true });
    if (before.isSymbolicLink() || !before.isFile() || before.size > BigInt(MAX_MANIFEST_BYTES)) {
      throw new Error(`${label} must be a bounded regular file`);
    }
    const realRoot = fs.realpathSync(resolvedRoot);
    const realPath = fs.realpathSync(resolvedPath);
    if (!isInside(realRoot, realPath)) throw new Error(`${label} escapes the repository`);
    descriptor = fs.openSync(
      resolvedPath,
      fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0),
    );
    const opened = fs.fstatSync(descriptor, { bigint: true });
    if (!sameFileStats(before, opened)) throw new Error(`${label} changed while reading`);
    const bytes = Buffer.alloc(Number(opened.size));
    let offset = 0;
    while (offset < bytes.length) {
      const read = fs.readSync(descriptor, bytes, offset, bytes.length - offset, null);
      if (read === 0) throw new Error(`${label} changed while reading`);
      offset += read;
    }
    const after = fs.fstatSync(descriptor, { bigint: true });
    const pathAfter = fs.lstatSync(resolvedPath, { bigint: true });
    if (
      !sameFileStats(opened, after)
      || !sameFileStats(after, pathAfter)
      || fs.realpathSync(resolvedPath) !== realPath
    ) {
      throw new Error(`${label} changed while reading`);
    }
    return bytes;
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

function discoverPlanEntries(plansDirectory, resolvedRoot) {
  const entries = [];
  let observedEntries = 0;
  const visit = (directoryPath) => {
    const directoryEntries = fs.readdirSync(directoryPath, { withFileTypes: true })
      .sort((left, right) => compareText(left.name, right.name));
    observedEntries += directoryEntries.length;
    if (observedEntries > MAX_PLAN_DIRECTORY_ENTRIES) {
      throw new Error("Plan directory exceeds entry limit");
    }
    for (const entry of directoryEntries) {
      const entryPath = path.join(directoryPath, entry.name);
      const stats = fs.lstatSync(entryPath, { bigint: true });
      if (stats.isSymbolicLink()) {
        throw new Error("Plan directory symbolic links are not allowed");
      }
      const relativePath = path.relative(resolvedRoot, entryPath).replaceAll("\\", "/");
      if (PLAN_FILE_PATTERN.test(entry.name)) {
        if (!stats.isFile() || path.dirname(entryPath) !== plansDirectory) {
          throw new Error("Plan files must be regular files directly under docs/plans");
        }
        entries.push({ path: relativePath, kind: "file" });
      }
      if (stats.isDirectory()) visit(entryPath);
    }
  };
  visit(plansDirectory);
  return entries.sort((left, right) => compareText(left.path, right.path));
}

function getEntryKind(stats) {
  if (stats.isFile()) return "file";
  if (stats.isDirectory()) return "directory";
  if (stats.isSymbolicLink()) return "symlink";
  return "other";
}

function toRepositoryRelativePath(realRoot, resolvedPath) {
  if (!isInside(realRoot, resolvedPath)) return null;
  const relativePath = path.relative(realRoot, resolvedPath).replaceAll("\\", "/");
  return isCanonicalRepositoryRelativePath(relativePath) ? relativePath : null;
}

export function capturePlanDirectorySnapshot({ rootDir, planPaths = [] }) {
  const resolvedRoot = path.resolve(rootDir);
  const plansDirectory = path.join(resolvedRoot, "docs", "plans");
  try {
    if (!Array.isArray(planPaths) || planPaths.length > MAX_PLAN_DIRECTORY_ENTRIES) {
      throw new Error("Invalid plan directory snapshot");
    }
    const realRoot = fs.realpathSync(resolvedRoot);
    const initialDirectoryStats = fs.lstatSync(plansDirectory, { bigint: true });
    const realPlansDirectory = fs.realpathSync(plansDirectory);
    if (
      !initialDirectoryStats.isDirectory()
      || initialDirectoryStats.isSymbolicLink()
      || !isInside(realRoot, realPlansDirectory)
    ) {
      throw new Error("Invalid plan directory snapshot");
    }
    const entries = discoverPlanEntries(plansDirectory, resolvedRoot);
    const uniquePlanPaths = [...new Set(planPaths)].sort(compareText);
    const paths = uniquePlanPaths.map((relativePath) => {
      if (!isCanonicalRepositoryRelativePath(relativePath)) {
        throw new Error("Invalid plan directory snapshot");
      }
      const resolvedPath = path.resolve(resolvedRoot, relativePath);
      if (!isInside(plansDirectory, resolvedPath)) {
        throw new Error("Invalid plan directory snapshot");
      }
      const stats = fs.lstatSync(resolvedPath, { bigint: true });
      const kind = getEntryKind(stats);
      let realPath = null;
      if (kind === "file" || kind === "directory") {
        const resolvedRealPath = fs.realpathSync(resolvedPath);
        if (isInside(realPlansDirectory, resolvedRealPath)) {
          realPath = toRepositoryRelativePath(realRoot, resolvedRealPath);
        }
      }
      return { path: relativePath, kind, realPath };
    });
    const finalDirectoryStats = fs.lstatSync(plansDirectory, { bigint: true });
    const finalRealPlansDirectory = fs.realpathSync(plansDirectory);
    if (
      !sameDirectoryStats(initialDirectoryStats, finalDirectoryStats)
      || realPlansDirectory !== finalRealPlansDirectory
    ) {
      throw new Error("Plan directory changed while capturing metadata");
    }
    return {
      schemaVersion: 1,
      directory: PLANS_DIRECTORY,
      entries,
      paths,
    };
  } catch (error) {
    if (error?.message?.startsWith("Plan directory")) throw error;
    throw new Error("Invalid plan directory snapshot");
  }
}

function requirePlanDirectorySnapshot(snapshot, rootDir) {
  requireClosedObject(
    snapshot,
    ["schemaVersion", "directory", "entries", "paths"],
    "Plan directory snapshot",
  );
  if (
    snapshot.schemaVersion !== 1
    || snapshot.directory !== PLANS_DIRECTORY
    || !Array.isArray(snapshot.entries)
    || !Array.isArray(snapshot.paths)
    || snapshot.entries.length > MAX_PLAN_DIRECTORY_ENTRIES
    || snapshot.paths.length > MAX_PLAN_DIRECTORY_ENTRIES
  ) {
    throw new Error("Plan directory snapshot is invalid");
  }
  const plansDirectory = path.resolve(rootDir, PLANS_DIRECTORY);
  const validateEntryPath = (entry, label, { immediate }) => {
    requireClosedObject(entry, ["path", "kind", "realPath"].filter((field) =>
      field !== "realPath" || Object.hasOwn(entry, field)), label);
    const resolvedEntryPath = path.resolve(rootDir, entry.path);
    if (
      !isCanonicalRepositoryRelativePath(entry.path)
      || !isInside(plansDirectory, resolvedEntryPath)
      || (immediate && path.dirname(resolvedEntryPath) !== plansDirectory)
      || !PLAN_FILE_PATTERN.test(path.basename(entry.path))
      || !PLAN_ENTRY_KINDS.has(entry.kind)
    ) {
      throw new Error("Plan directory snapshot is invalid");
    }
  };
  let previousEntryPath;
  for (const [index, entry] of snapshot.entries.entries()) {
    const label = `Plan directory snapshot entries[${index}]`;
    validateEntryPath(entry, label, { immediate: true });
    if (Object.hasOwn(entry, "realPath") || (previousEntryPath && previousEntryPath >= entry.path)) {
      throw new Error("Plan directory snapshot is invalid");
    }
    previousEntryPath = entry.path;
  }
  const pathsByPath = new Map();
  let previousPlanPath;
  for (const [index, entry] of snapshot.paths.entries()) {
    const label = `Plan directory snapshot paths[${index}]`;
    validateEntryPath(entry, label, { immediate: false });
    if (previousPlanPath && previousPlanPath >= entry.path) {
      throw new Error("Plan directory snapshot is invalid");
    }
    if (entry.kind === "file" || entry.kind === "directory") {
      if (!isCanonicalRepositoryRelativePath(entry.realPath)) {
        throw new Error("Plan directory snapshot is invalid");
      }
      const resolvedRealPath = path.resolve(rootDir, entry.realPath);
      if (!isInside(plansDirectory, resolvedRealPath)) {
        throw new Error("Plan directory snapshot is invalid");
      }
    } else if (entry.realPath !== null) {
      throw new Error("Plan directory snapshot is invalid");
    }
    pathsByPath.set(entry.path, entry);
    previousPlanPath = entry.path;
  }
  return { entries: snapshot.entries, pathsByPath };
}

function readPlansIndex(rootDir, plansIndexPath, plansIndexSnapshot) {
  if (!fs.existsSync(plansIndexPath)) throw new Error(`${PLANS_INDEX_PATH} is missing`);
  if (plansIndexSnapshot === undefined) {
    return readRepositoryRegularFile(rootDir, plansIndexPath, "Plans index")
      .toString("utf8")
      .replace(/^\uFEFF/, "");
  }
  requireClosedObject(plansIndexSnapshot, ["path", "bytes"], "Plans index snapshot");
  if (
    plansIndexSnapshot.path !== PLANS_INDEX_PATH
    || !Buffer.isBuffer(plansIndexSnapshot.bytes)
  ) {
    throw new Error("Plans index snapshot does not match the declared artifact");
  }
  return plansIndexSnapshot.bytes.toString("utf8").replace(/^\uFEFF/, "");
}

export function validatePlanStateManifest(
  input,
  { rootDir, plansIndexSnapshot, planDirectorySnapshot } = {},
) {
  requireClosedObject(input, ["schemaVersion", "legacyCutoff", "plans"], "Plan state manifest");
  if (input.schemaVersion !== 1) throw new Error("Plan state manifest must use schemaVersion 1");
  requireString(input.legacyCutoff, "legacyCutoff", /^\d{3}$/);
  if (input.legacyCutoff !== LEGACY_CUTOFF) {
    throw new Error(`legacyCutoff must remain ${LEGACY_CUTOFF} for schemaVersion 1`);
  }
  if (!Array.isArray(input.plans) || input.plans.length === 0) {
    throw new Error("plans must contain at least one entry");
  }

  const ids = new Set();
  const cutoff = Number(input.legacyCutoff);
  const plansDirectory = path.join(rootDir, "docs", "plans");
  const plansIndexPath = path.join(plansDirectory, "README.md");
  const plansIndex = stripNonContractMarkdown(
    readPlansIndex(rootDir, plansIndexPath, plansIndexSnapshot),
  );
  const boundDirectory = planDirectorySnapshot === undefined
    ? null
    : requirePlanDirectorySnapshot(planDirectorySnapshot, rootDir);
  for (const [index, plan] of input.plans.entries()) {
    const label = `plans[${index}]`;
    requireClosedObject(
      plan,
      ["id", "title", "path", "priority", "complexity", "lifecycle", "verification", "rollout", "owner", "updatedAt"],
      label,
    );
    requireString(plan.id, `${label}.id`, /^\d{3}[A-Z]?$/);
    if (ids.has(plan.id)) throw new Error(`Duplicate plan id: ${plan.id}`);
    ids.add(plan.id);
    if (Number(plan.id.slice(0, 3)) <= cutoff) {
      throw new Error(`Plan ${plan.id} must be newer than legacyCutoff ${input.legacyCutoff}`);
    }
    requireString(plan.title, `${label}.title`);
    requireString(plan.owner, `${label}.owner`, /^[a-z0-9][a-z0-9_-]*$/i);
    requireCalendarDate(plan.updatedAt, `${label}.updatedAt`);
    if (!PRIORITIES.has(plan.priority)) throw new Error(`${label}.priority is invalid`);
    if (!COMPLEXITIES.has(plan.complexity)) throw new Error(`${label}.complexity is invalid`);
    if (!LIFECYCLES.has(plan.lifecycle)) throw new Error(`${label}.lifecycle is invalid`);
    if (!VERIFICATIONS.has(plan.verification)) {
      throw new Error(`${label}.verification is invalid`);
    }
    if (!ROLLOUTS.has(plan.rollout)) throw new Error(`${label}.rollout is invalid`);

    const planPath = resolveRepositoryPath(rootDir, plan.path, `${label}.path`);
    if (path.dirname(planPath) !== plansDirectory) {
      throw new Error(`${label}.path must be directly under docs/plans`);
    }
    const boundPlanPath = boundDirectory?.pathsByPath.get(plan.path);
    if (boundDirectory && !boundPlanPath) throw new Error(`${label}.path does not exist`);
    if (path.extname(planPath).toLowerCase() !== ".md") {
      throw new Error(`${label}.path must be a regular Markdown file`);
    }
    if (!boundDirectory && !fs.existsSync(planPath)) throw new Error(`${label}.path does not exist`);
    if (
      (boundDirectory && boundPlanPath.kind !== "file")
      || (!boundDirectory && !fs.lstatSync(planPath).isFile())
    ) {
      throw new Error(`${label}.path must be a regular Markdown file`);
    }
    const realPlanPath = boundDirectory
      ? path.resolve(rootDir, boundPlanPath.realPath)
      : fs.realpathSync(planPath);
    const realRoot = boundDirectory ? path.resolve(rootDir) : fs.realpathSync(rootDir);
    const realPlansDirectory = boundDirectory
      ? path.resolve(rootDir, PLANS_DIRECTORY)
      : fs.realpathSync(plansDirectory);
    if (!isInside(realRoot, realPlanPath)) throw new Error(`${label}.path escapes the repository`);
    if (!isInside(realPlansDirectory, realPlanPath)) {
      throw new Error(`${label}.path must stay under docs/plans`);
    }
    const expectedPrefix = `${plan.id.toLowerCase()}-`;
    if (!path.basename(plan.path).toLowerCase().startsWith(expectedPrefix)) {
      throw new Error(`${label}.path must start with plan id ${plan.id}`);
    }
    const indexRowPattern = new RegExp(`^\\|[ \\t]*${plan.id}[ \\t]*\\|`, "im");
    if (!indexRowPattern.test(plansIndex)) {
      throw new Error(`Plan ${plan.id} is missing from docs/plans/README.md`);
    }
  }

  if (boundDirectory || fs.existsSync(plansDirectory)) {
    const planFileNames = boundDirectory
      ? boundDirectory.entries.map((entry) => path.basename(entry.path))
      : discoverPlanEntries(plansDirectory, path.resolve(rootDir))
        .map((entry) => path.basename(entry.path));
    const postCutoffIds = planFileNames
      .map((entryName) => entryName.match(PLAN_FILE_PATTERN))
      .filter(Boolean)
      .filter((match) => Number(match[1]) > cutoff)
      .map((match) => `${match[1]}${match[2].toUpperCase()}`);
    const discoveredIdCounts = new Map();
    for (const id of postCutoffIds) {
      discoveredIdCounts.set(id, (discoveredIdCounts.get(id) || 0) + 1);
    }
    for (const [id, count] of discoveredIdCounts) {
      if (count > 1) throw new Error(`Multiple plan files declare canonical id ${id}`);
    }
    for (const id of postCutoffIds) {
      if (!ids.has(id)) throw new Error(`Post-cutoff plan ${id} is missing from machine state`);
    }
  }
  return input;
}

export function validatePlanTraceCoverage(planState, traceabilitySummary) {
  const tracedPlanIds = new Set(traceabilitySummary.planIds || []);
  for (const plan of planState.plans) {
    if (
      (plan.complexity === "moderate" || plan.complexity === "complex") &&
      !tracedPlanIds.has(plan.id)
    ) {
      throw new Error(`Plan ${plan.id} requires a traceability manifest`);
    }
  }
  for (const planId of tracedPlanIds) {
    if (!planState.plans.some((plan) => plan.id === planId)) {
      throw new Error(`Traceability manifest ${planId} has no machine plan state`);
    }
  }
  return true;
}

export function validatePlanStateFile({ rootDir, manifestPath }) {
  const expectedPath = path.resolve(rootDir, "docs", "plans", "plan-state.json");
  if (path.resolve(manifestPath) !== expectedPath) {
    throw new Error("Plan state manifest path is invalid");
  }
  const input = JSON.parse(
    readRepositoryRegularFile(rootDir, expectedPath, "Plan state manifest")
      .toString("utf8")
      .replace(/^\uFEFF/, ""),
  );
  return validatePlanStateManifest(input, { rootDir });
}
