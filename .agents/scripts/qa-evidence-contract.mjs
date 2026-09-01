import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { findPrivacyTypes } from "../../scripts/lib/docs-privacy.mjs";
import { isCanonicalRepositoryRelativePath } from "../../scripts/lib/repository-path.mjs";
import { hasSecretLikeText } from "../../scripts/lib/sensitive-text.mjs";

const SHA40 = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const MODES = ["full", "quick", "client", "server", "e2e"];
const RESULTS = ["PASS", "PASS_WITH_RISK", "FAIL", "BLOCKED"];
const COMMANDS = {
  "release-build": "npm run build --prefix client",
  "compile-client": "cd client && npx vite build",
  "client-tests": "npm run test:unit:client",
  "server-tests": "npm run test:unit:server",
  e2e: "npm run test:e2e",
};
const REQUIRED = {
  full: ["release-build", "client-tests", "server-tests", "e2e"],
  quick: ["compile-client", "client-tests", "server-tests"],
  client: ["compile-client", "client-tests"],
  server: ["server-tests"],
  e2e: ["e2e"],
};
const TEST_COMMANDS = new Set(["client-tests", "server-tests", "e2e"]);
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 5_000;
const MAX_EVIDENCE_BYTES = 2 * 1024 * 1024;
const MAX_FINGERPRINT_FILE_BYTES = 32 * 1024 * 1024;
const MAX_FINGERPRINT_TOTAL_BYTES = 128 * 1024 * 1024;
const MAX_IGNORED_QA_INPUTS = 128;
const GIT_OWNER_EXECUTE_BIT = 0o100n;
const QA_EVIDENCE_DIRECTORY = ".local-data/qa-evidence/";
const QA_IGNORED_INPUT_DIRECTORIES = ["", "client", "server"];

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const closedObject = (value, allowed, name) => {
  assert(value && typeof value === "object" && !Array.isArray(value), `${name} must be an object`);
  for (const field of Object.keys(value)) {
    assert(allowed.includes(field), `${name} contains an unsupported field`);
  }
};

const canonicalTime = (value, name) => {
  const parsed = new Date(value);
  assert(Number.isFinite(parsed.getTime()) && parsed.toISOString() === value, `${name} must be canonical ISO-8601`);
  return parsed;
};

const safeRelativePath = (value) => {
  assert(isCanonicalRepositoryRelativePath(value), "Invalid repository-relative path");
  rejectSensitive(value, { repositoryPath: true });
  return value;
};

const hasSensitiveText = (value, secretOptions) => {
  const normalized = String(value ?? "").normalize("NFKC");
  if (findPrivacyTypes(normalized).length > 0) return true;
  return hasSecretLikeText(normalized, secretOptions);
};

function rejectSensitive(value, secretOptions) {
  assert(!hasSensitiveText(value, secretOptions), "QA evidence contains sensitive metadata");
}

const isValidatedFingerprintHash = (fieldPath) => (
  fieldPath[0] === "fingerprint" && (
    (fieldPath.length === 2 && ["head", "digest"].includes(fieldPath[1])) ||
    (
      fieldPath.length === 4 &&
      fieldPath[1] === "files" &&
      Number.isSafeInteger(fieldPath[2]) &&
      fieldPath[3] === "digest"
    )
  )
);

const scanStrings = (value, fieldPath = []) => {
  if (typeof value === "string") {
    if (!isValidatedFingerprintHash(fieldPath)) {
      rejectSensitive(value, { allowStandaloneGoogleAppPassword: true });
    }
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => scanStrings(item, [...fieldPath, index]));
  } else if (value && typeof value === "object") {
    Object.entries(value).forEach(([field, item]) => (
      scanStrings(item, [...fieldPath, field])
    ));
  }
};

const canonicalJson = (value) => JSON.stringify(value);

export const createWorktreeFingerprint = ({ head, entries }) => {
  assert(SHA40.test(String(head || "")), "Fingerprint head must be an exact Git SHA");
  assert(Array.isArray(entries) && entries.length <= MAX_ENTRIES, "Fingerprint entries are invalid");
  const seen = new Set();
  const files = entries.map((entry) => {
    closedObject(entry, ["path", "status", "digest"], "Fingerprint entry");
    const relativePath = safeRelativePath(entry.path);
    assert(!seen.has(relativePath), "Fingerprint contains a duplicate path");
    seen.add(relativePath);
    assert(typeof entry.status === "string" && /^[ MADRCUT?!]{2}$/.test(entry.status), "Fingerprint status is invalid");
    assert(SHA256.test(String(entry.digest || "")), "Fingerprint file digest is invalid");
    return { path: relativePath, status: entry.status, digest: entry.digest };
  }).sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  const projection = { head, state: files.length === 0 ? "clean" : "dirty", files };
  return {
    algorithm: "sha256",
    ...projection,
    digest: crypto.createHash("sha256").update(canonicalJson(projection)).digest("hex"),
  };
};

const sameFileSnapshot = (left, right) => (
  left.dev === right.dev
  && left.ino === right.ino
  && left.size === right.size
  && left.mode === right.mode
  && left.mtimeNs === right.mtimeNs
  && left.ctimeNs === right.ctimeNs
);

const escapesParent = (relativePath) => (
  relativePath === ".."
  || relativePath.startsWith(`..${path.sep}`)
  || path.isAbsolute(relativePath)
);

const hashPath = (rootDir, relativePath, remainingBytes) => {
  assert(
    Number.isSafeInteger(remainingBytes) && remainingBytes >= 0,
    "Aggregate fingerprint payload is too large",
  );
  const target = path.resolve(rootDir, ...relativePath.split("/"));
  const relative = path.relative(rootDir, target);
  assert(relative && !escapesParent(relative), "Worktree path escapes repository");
  let before;
  try {
    before = fs.lstatSync(target, { bigint: true });
  } catch (error) {
    if (error?.code === "ENOENT") {
      return {
        digest: crypto.createHash("sha256").update("missing").digest("hex"),
        byteLength: 0,
      };
    }
    throw error;
  }
  const hash = crypto.createHash("sha256");
  let byteLength;
  if (before.isSymbolicLink()) {
    const link = fs.readlinkSync(target);
    byteLength = Buffer.byteLength(link);
    assert(byteLength <= remainingBytes, "Aggregate fingerprint payload is too large");
    const after = fs.lstatSync(target, { bigint: true });
    assert(
      sameFileSnapshot(before, after) && link === fs.readlinkSync(target),
      "Worktree changed while fingerprinting",
    );
    hash.update("symlink:").update(link);
  } else {
    assert(before.isFile(), "Worktree fingerprint only supports file entries");
    assert(
      before.size <= BigInt(MAX_FINGERPRINT_FILE_BYTES),
      "Worktree file is too large to fingerprint safely",
    );
    assert(
      before.size <= BigInt(remainingBytes),
      "Aggregate fingerprint payload is too large",
    );
    const real = fs.realpathSync(target);
    const realRelative = path.relative(fs.realpathSync(rootDir), real);
    assert(!escapesParent(realRelative), "Worktree path escapes repository");
    const handle = fs.openSync(real, "r");
    const openedBefore = fs.fstatSync(handle, { bigint: true });
    assert(
      openedBefore.isFile() && sameFileSnapshot(before, openedBefore),
      "Worktree changed while fingerprinting",
    );
    hash.update(
      (openedBefore.mode & GIT_OWNER_EXECUTE_BIT) === 0n
        ? "file:100644:"
        : "file:100755:",
    );
    const buffer = Buffer.allocUnsafe(64 * 1024);
    const expectedBytes = Number(openedBefore.size);
    byteLength = 0;
    let openedAfter;
    try {
      for (let bytes = fs.readSync(handle, buffer, 0, buffer.length, null); bytes > 0; bytes = fs.readSync(handle, buffer, 0, buffer.length, null)) {
        byteLength += bytes;
        assert(byteLength <= expectedBytes, "Worktree changed while fingerprinting");
        hash.update(buffer.subarray(0, bytes));
      }
      assert(byteLength === expectedBytes, "Worktree changed while fingerprinting");
      openedAfter = fs.fstatSync(handle, { bigint: true });
    } finally {
      fs.closeSync(handle);
    }
    const after = fs.lstatSync(target, { bigint: true });
    assert(
      sameFileSnapshot(openedBefore, openedAfter)
        && sameFileSnapshot(openedAfter, after)
        && fs.realpathSync(target) === real,
      "Worktree changed while fingerprinting",
    );
  }
  return { digest: hash.digest("hex"), byteLength };
};

const git = (rootDir, args) => execFileSync("git", ["-C", rootDir, ...args], {
  encoding: "utf8",
  maxBuffer: 16 * 1024 * 1024,
  stdio: ["ignore", "pipe", "pipe"],
});

const isQaEnvInputName = (name) => name === ".env" || name.startsWith(".env.");

const isQaIgnoredInputPath = (relativePath) => {
  const segments = relativePath.split("/");
  if (segments.length === 1) return isQaEnvInputName(segments[0]);
  return segments.length === 2
    && ["client", "server"].includes(segments[0])
    && isQaEnvInputName(segments[1]);
};

const discoverIgnoredQaInputCandidates = (rootDir) => {
  const candidates = [];
  for (const directory of QA_IGNORED_INPUT_DIRECTORIES) {
    const absoluteDirectory = directory
      ? path.resolve(rootDir, ...directory.split("/"))
      : rootDir;
    let directoryStat;
    try {
      directoryStat = fs.lstatSync(absoluteDirectory);
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }
    if (!directoryStat.isDirectory()) continue;
    const realDirectory = fs.realpathSync(absoluteDirectory);
    const realRelative = path.relative(rootDir, realDirectory);
    assert(
      realDirectory === rootDir || !escapesParent(realRelative),
      "QA input directory escapes repository",
    );
    for (const entry of fs.readdirSync(realDirectory, { withFileTypes: true })) {
      if (!isQaEnvInputName(entry.name) || entry.isDirectory()) continue;
      const relativePath = safeRelativePath(directory ? `${directory}/${entry.name}` : entry.name);
      candidates.push(relativePath);
      assert(
        candidates.length <= MAX_IGNORED_QA_INPUTS,
        "Ignored QA input set is too large",
      );
    }
  }
  return candidates.sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
};

const listIgnoredQaInputs = (rootDir) => {
  const candidates = discoverIgnoredQaInputCandidates(rootDir);
  if (candidates.length === 0) return "";
  return git(rootDir, [
    "ls-files",
    "--others",
    "--ignored",
    "--exclude-standard",
    "-z",
    "--",
    ...candidates.map((candidate) => `:(top,literal)${candidate}`),
  ]);
};

const rejectHiddenIndexFlags = (rawFlags) => {
  for (const record of rawFlags.split("\0")) {
    if (!record) continue;
    assert(record.length >= 3 && record[1] === " ", "Git index flag output is malformed");
    const tag = record[0];
    assert(
      tag !== "S" && !/[a-z]/.test(tag),
      "Worktree fingerprint rejects hidden Git index flags",
    );
  }
};

export const collectWorkingTreeFingerprint = (rootDir = process.cwd(), { excludePaths = [] } = {}) => {
  const resolvedRoot = fs.realpathSync(path.resolve(rootDir));
  const excluded = new Set(excludePaths.map(safeRelativePath));
  const captureGitState = () => {
    let state;
    try {
      state = {
        head: git(resolvedRoot, ["rev-parse", "HEAD"]).trim(),
        rawStatus: git(resolvedRoot, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]),
        rawIndex: git(resolvedRoot, ["ls-files", "--stage", "-z"]),
        rawIndexFlags: git(resolvedRoot, ["ls-files", "-v", "-z"]),
        rawIgnoredInputs: listIgnoredQaInputs(resolvedRoot),
      };
    } catch {
      throw new Error("Unable to read Git working tree");
    }
    rejectHiddenIndexFlags(state.rawIndexFlags);
    return state;
  };
  const sameGitState = (left, right) => (
    left.head === right.head
    && left.rawStatus === right.rawStatus
    && left.rawIndex === right.rawIndex
    && left.rawIndexFlags === right.rawIndexFlags
    && left.rawIgnoredInputs === right.rawIgnoredInputs
  );
  const initialState = captureGitState();
  const {
    head,
    rawStatus,
    rawIndex,
    rawIgnoredInputs,
  } = initialState;
  const records = rawStatus.split("\0");
  const items = [];
  for (let index = 0; index < records.length; index += 1) {
    if (!records[index]) continue;
    const record = records[index];
    assert(record.length >= 4 && record[2] === " ", "Git status output is malformed");
    const status = record.slice(0, 2);
    const destination = record.slice(3);
    items.push({ path: destination, status });
    if (status.includes("R") || status.includes("C")) {
      const source = records[index + 1];
      assert(source, "Git rename status is malformed");
      items.push({ path: source, status: "D " });
      index += 1;
    }
  }
  for (const relativePath of rawIgnoredInputs.split("\0").filter(Boolean)) {
    assert(isQaIgnoredInputPath(relativePath), "Ignored QA input path is invalid");
    items.push({ path: relativePath, status: "!!" });
  }
  const indexByPath = new Map();
  for (const record of rawIndex.split("\0")) {
    if (!record) continue;
    const separator = record.indexOf("\t");
    assert(separator > 0, "Git index output is malformed");
    const metadata = record.slice(0, separator);
    const relativePath = record.slice(separator + 1);
    indexByPath.set(relativePath, `${indexByPath.get(relativePath) || ""}|${metadata}`);
  }
  const candidates = items.filter(({ path: itemPath }) => !excluded.has(itemPath));
  assert(candidates.length <= MAX_ENTRIES, "Fingerprint entries are invalid");
  const seen = new Set();
  const preflightItems = candidates.map((item) => {
    const relativePath = safeRelativePath(item.path);
    assert(!seen.has(relativePath), "Fingerprint contains a duplicate path");
    seen.add(relativePath);
    assert(
      typeof item.status === "string" && /^[ MADRCUT?!]{2}$/.test(item.status),
      "Fingerprint status is invalid",
    );
    return { path: relativePath, status: item.status };
  });
  let aggregateBytes = 0;
  const hashedEntries = preflightItems.map((item) => {
    const content = hashPath(
      resolvedRoot,
      item.path,
      MAX_FINGERPRINT_TOTAL_BYTES - aggregateBytes,
    );
    aggregateBytes += content.byteLength;
    const digest = crypto.createHash("sha256")
      .update(content.digest)
      .update(indexByPath.get(item.path) || "untracked")
      .digest("hex");
    return { ...item, digest, byteLength: content.byteLength };
  });
  const finalState = captureGitState();
  assert(sameGitState(initialState, finalState), "Worktree changed while fingerprinting");
  let finalAggregateBytes = 0;
  for (const entry of hashedEntries) {
    const content = hashPath(
      resolvedRoot,
      entry.path,
      MAX_FINGERPRINT_TOTAL_BYTES - finalAggregateBytes,
    );
    finalAggregateBytes += content.byteLength;
    const digest = crypto.createHash("sha256")
      .update(content.digest)
      .update(indexByPath.get(entry.path) || "untracked")
      .digest("hex");
    assert(
      content.byteLength === entry.byteLength && digest === entry.digest,
      "Worktree changed while fingerprinting",
    );
  }
  const returnState = captureGitState();
  assert(sameGitState(initialState, returnState), "Worktree changed while fingerprinting");
  const entries = hashedEntries.map(({ path: entryPath, status, digest }) => ({
    path: entryPath,
    status,
    digest,
  }));
  return createWorktreeFingerprint({ head, entries });
};

const validateFingerprint = (value, name = "fingerprint") => {
  closedObject(value, ["algorithm", "head", "state", "files", "digest"], name);
  assert(value.algorithm === "sha256", `${name} algorithm is invalid`);
  const rebuilt = createWorktreeFingerprint({ head: value.head, entries: value.files });
  assert(value.state === rebuilt.state && value.digest === rebuilt.digest, `${name} is internally inconsistent`);
  return rebuilt;
};

const validateCounts = (value, status) => {
  closedObject(value, ["passed", "failed", "skipped"], "counts");
  for (const count of Object.values(value)) assert(Number.isSafeInteger(count) && count >= 0, "Test counts are invalid");
  if (status === "PASS") {
    assert(value.failed === 0, "PASS test counts cannot contain failures");
    assert(value.passed > 0, "PASS test counts must contain an executed passing test");
  }
  if (status === "FAIL") assert(value.failed > 0, "FAIL test counts must contain a failure");
};

const validateCommand = (item) => {
  closedObject(item, ["id", "command", "status", "exitCode", "counts", "reason", "residualRisk"], "command");
  assert(Object.hasOwn(COMMANDS, item.id) && item.command === COMMANDS[item.id], "QA command is not allowlisted");
  assert(["PASS", "FAIL", "BLOCKED", "SKIP"].includes(item.status), "QA command status is invalid");
  if (item.status === "PASS") assert(item.exitCode === 0, "Command status and exit code are inconsistent");
  if (item.status === "FAIL") assert(Number.isSafeInteger(item.exitCode) && item.exitCode > 0, "Command status and exit code are inconsistent");
  if (["BLOCKED", "SKIP"].includes(item.status)) {
    assert(item.exitCode === null, "Command status and exit code are inconsistent");
    assert(typeof item.reason === "string" && item.reason.trim().length >= 8 && item.reason.length <= 500, "Blocked or skipped command requires a reason");
  }
  if (item.status === "SKIP") {
    assert(item.id === "e2e", "Only E2E may be skipped");
    assert(typeof item.residualRisk === "string" && item.residualRisk.trim().length >= 8 && item.residualRisk.length <= 500, "E2E SKIP requires residual risk");
  }
  if (item.status !== "SKIP") assert(item.residualRisk === undefined, "Residual risk is only valid for E2E SKIP");
  if (TEST_COMMANDS.has(item.id) && ["PASS", "FAIL"].includes(item.status)) validateCounts(item.counts, item.status);
  else assert(item.counts === undefined, "Counts are only valid for executed test commands");
  if (["PASS", "FAIL"].includes(item.status)) assert(item.reason === undefined && item.residualRisk === undefined, "Executed command cannot contain skip metadata");
  return item;
};

export const validateQaEvidence = (evidence, { currentFingerprint, now = new Date().toISOString() } = {}) => {
  closedObject(evidence, ["schemaVersion", "kind", "mode", "createdAt", "expiresAt", "fingerprint", "commands", "result", "releaseEligible"], "QA evidence");
  assert(evidence.schemaVersion === 1 && evidence.kind === "qa-evidence", "QA evidence identity is invalid");
  assert(MODES.includes(evidence.mode), "QA evidence mode is invalid");
  const createdAt = canonicalTime(evidence.createdAt, "createdAt");
  const expiresAt = canonicalTime(evidence.expiresAt, "expiresAt");
  const checkedAt = canonicalTime(now, "now");
  assert(expiresAt > createdAt && expiresAt - createdAt <= MAX_AGE_MS, "QA evidence expiry is invalid");
  assert(createdAt <= checkedAt, "QA evidence creation time is in the future");
  assert(checkedAt <= expiresAt, "QA evidence has expired");
  const recorded = validateFingerprint(evidence.fingerprint);
  const current = validateFingerprint(currentFingerprint, "current fingerprint");
  scanStrings(evidence);
  assert(canonicalJson(recorded) === canonicalJson(current), "QA evidence has a stale fingerprint");
  assert(Array.isArray(evidence.commands) && evidence.commands.length <= 4, "QA evidence commands must be a bounded array");
  const commands = evidence.commands.map(validateCommand);
  const ids = commands.map(({ id }) => id);
  assert(new Set(ids).size === ids.length, "QA evidence contains a duplicate command ID");
  assert(REQUIRED[evidence.mode].every((id) => ids.includes(id)) && ids.every((id) => REQUIRED[evidence.mode].includes(id)), "QA evidence is missing or includes an invalid required command");
  const derivedResult = commands.some(({ status }) => status === "FAIL")
    ? "FAIL"
    : commands.some(({ status }) => status === "BLOCKED")
      ? "BLOCKED"
      : commands.some(({ status }) => status === "SKIP") ? "PASS_WITH_RISK" : "PASS";
  assert(RESULTS.includes(evidence.result) && evidence.result === derivedResult, "QA evidence result is inconsistent");
  const byId = Object.fromEntries(commands.map((item) => [item.id, item]));
  const derivedReleaseEligible = evidence.mode === "full" && ["PASS", "PASS_WITH_RISK"].includes(derivedResult)
    && ["release-build", "client-tests", "server-tests"].every((id) => byId[id]?.status === "PASS")
    && ["PASS", "SKIP"].includes(byId.e2e?.status);
  assert(
    typeof evidence.releaseEligible === "boolean" &&
      evidence.releaseEligible === derivedReleaseEligible,
    "QA evidence release eligibility is false or inconsistent",
  );
  return structuredClone(evidence);
};

const inside = (root, target) => {
  const relative = path.relative(root, target);
  return relative && !escapesParent(relative);
};

const readExactEvidenceBytes = (handle, snapshot) => {
  assert(
    snapshot.size <= BigInt(MAX_EVIDENCE_BYTES),
    "Evidence file is invalid or too large",
  );
  const expectedBytes = Number(snapshot.size);
  const buffer = Buffer.alloc(expectedBytes + 1);
  let total = 0;
  while (total < buffer.length) {
    const bytes = fs.readSync(
      handle,
      buffer,
      total,
      buffer.length - total,
      total,
    );
    if (bytes === 0) break;
    total += bytes;
  }
  assert(total === expectedBytes, "Evidence file changed during validation");
  return buffer.subarray(0, total);
};

const openEvidenceArtifact = (root, target) => {
  const pathBefore = fs.lstatSync(target, { bigint: true });
  assert(
    pathBefore.isFile()
      && !pathBefore.isSymbolicLink()
      && pathBefore.size <= BigInt(MAX_EVIDENCE_BYTES),
    "Evidence file is invalid or too large",
  );
  const real = fs.realpathSync(target);
  assert(inside(root, real), "Evidence path is outside repository");
  const handle = fs.openSync(real, "r");
  try {
    const openedBefore = fs.fstatSync(handle, { bigint: true });
    assert(
      openedBefore.isFile() && sameFileSnapshot(pathBefore, openedBefore),
      "Evidence file changed during validation",
    );
    const bytes = readExactEvidenceBytes(handle, openedBefore);
    const openedAfter = fs.fstatSync(handle, { bigint: true });
    const pathAfter = fs.lstatSync(target, { bigint: true });
    assert(
      sameFileSnapshot(openedBefore, openedAfter)
        && sameFileSnapshot(openedAfter, pathAfter)
        && fs.realpathSync(target) === real,
      "Evidence file changed during validation",
    );
    return {
      bytes,
      digest: crypto.createHash("sha256").update(bytes).digest("hex"),
      handle,
      real,
      snapshot: openedAfter,
      target,
    };
  } catch (error) {
    fs.closeSync(handle);
    throw error;
  }
};

const recheckEvidenceArtifact = (artifact) => {
  const pathBefore = fs.lstatSync(artifact.target, { bigint: true });
  const openedBefore = fs.fstatSync(artifact.handle, { bigint: true });
  assert(
    sameFileSnapshot(artifact.snapshot, pathBefore)
      && sameFileSnapshot(artifact.snapshot, openedBefore)
      && fs.realpathSync(artifact.target) === artifact.real,
    "Evidence file changed during validation",
  );
  const bytes = readExactEvidenceBytes(artifact.handle, openedBefore);
  const openedAfter = fs.fstatSync(artifact.handle, { bigint: true });
  const pathAfter = fs.lstatSync(artifact.target, { bigint: true });
  const digest = crypto.createHash("sha256").update(bytes).digest("hex");
  assert(
    sameFileSnapshot(artifact.snapshot, openedAfter)
      && sameFileSnapshot(artifact.snapshot, pathAfter)
      && fs.realpathSync(artifact.target) === artifact.real
      && digest === artifact.digest,
    "Evidence file changed during validation",
  );
};

const assertEvidenceGitState = (root, relativePath) => {
  let tracked = false;
  try {
    git(root, ["ls-files", "--error-unmatch", "--", relativePath]);
    tracked = true;
  } catch {
    tracked = false;
  }
  assert(!tracked, "QA evidence artifact must not be tracked by Git");
  let presentInHead = false;
  try {
    git(root, ["cat-file", "-e", `HEAD:${relativePath}`]);
    presentInHead = true;
  } catch {
    presentInHead = false;
  }
  assert(!presentInHead, "QA evidence artifact must not replace a path from HEAD");
  const evidenceStatus = git(root, [
    "status", "--porcelain=v1", "-z", "--untracked-files=all", "--", relativePath,
  ]);
  assert(
    evidenceStatus === "" || evidenceStatus === `?? ${relativePath}\0`,
    "QA evidence artifact has an unsafe Git status",
  );
};

const runCli = () => {
  assert(process.argv.length === 4 && process.argv[2] === "--evidence", "Usage: --evidence <repository-relative.json>");
  const root = fs.realpathSync(process.cwd());
  const relativePath = safeRelativePath(process.argv[3]);
  const evidenceName = relativePath.slice(QA_EVIDENCE_DIRECTORY.length);
  assert(
    relativePath.startsWith(QA_EVIDENCE_DIRECTORY)
      && evidenceName.endsWith(".json")
      && !evidenceName.includes("/"),
    "Evidence must be an untracked JSON file in the QA evidence directory",
  );
  assertEvidenceGitState(root, relativePath);
  const target = path.resolve(root, ...relativePath.split("/"));
  assert(inside(root, target), "Evidence path is outside repository");
  const artifact = openEvidenceArtifact(root, target);
  try {
    const evidence = JSON.parse(artifact.bytes.toString("utf8"));
    const validated = validateQaEvidence(evidence, {
      currentFingerprint: collectWorkingTreeFingerprint(root, { excludePaths: [relativePath] }),
    });
    assertEvidenceGitState(root, relativePath);
    recheckEvidenceArtifact(artifact);
    process.stdout.write(`${JSON.stringify({
      schemaValid: true,
      mode: validated.mode,
      result: validated.result,
      releaseEligible: validated.releaseEligible,
      attestationTrust: "SELF_ATTESTED",
      releaseAuthorized: false,
    })}\n`);
  } finally {
    fs.closeSync(artifact.handle);
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    runCli();
  } catch {
    process.stderr.write("QA evidence validation failed\n");
    process.exitCode = 1;
  }
}
