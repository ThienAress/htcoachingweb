import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { safeFindingPath } from "./lib/docs-privacy.mjs";
import { isCanonicalRepositoryRelativePath } from "./lib/repository-path.mjs";
import {
  decodeSensitiveTextBytes,
  findCanonicalSecretTypes,
} from "./lib/sensitive-text.mjs";

const root = process.cwd();
const MAX_FILE_BYTES = 2_000_000;
const MAX_GIT_OUTPUT_BYTES = 16 * 1024 * 1024;
const MAX_BATCH_BYTES = 8 * 1024 * 1024;
const MAX_BATCH_OBJECTS = 128;
const MAX_INDEX_OBJECTS = 20_000;
const MAX_TOTAL_INDEX_BYTES = 128 * 1024 * 1024;
const runGit = (args) => execFileSync("git", args, {
  cwd: root,
  encoding: "utf8",
  maxBuffer: MAX_GIT_OUTPUT_BYTES,
});
const readGitState = () => ({
  rawFiles: runGit(["ls-files", "--cached", "--others", "--exclude-standard", "-z"]),
  rawWorking: runGit(["ls-files", "--modified", "--others", "--exclude-standard", "-z"]),
  rawStatus: runGit(["status", "--porcelain=v1", "-z", "--untracked-files=all"]),
  rawIndex: runGit(["ls-files", "--stage", "-z"]),
  rawIndexFlags: runGit(["ls-files", "-v", "-z"]),
});
try {
const initialGitState = readGitState();
const files = initialGitState.rawFiles.split("\0").filter(Boolean);
const workingTreeFiles = new Set(
  initialGitState.rawWorking.split("\0").filter(Boolean),
);
const parseStatusPaths = (rawStatus) => {
  const records = rawStatus.split("\0");
  const paths = new Set();
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record) continue;
    if (record.length < 4 || record[2] !== " ") {
      throw new Error("Unable to inspect Git status");
    }
    paths.add(record.slice(3));
    const status = record.slice(0, 2);
    if (status.includes("R") || status.includes("C")) {
      const source = records[index + 1];
      if (!source) throw new Error("Unable to inspect Git status");
      paths.add(source);
      index += 1;
    }
  }
  return paths;
};
const weakScanFiles = parseStatusPaths(initialGitState.rawStatus);
if (
  [...files, ...workingTreeFiles, ...weakScanFiles]
    .some((relative) => !isCanonicalRepositoryRelativePath(relative))
) {
  process.stderr.write("Secret scan blocked: non-canonical repository path detected.\n");
  process.exit(1);
}
const indexEntries = new Map();
const rawIndex = initialGitState.rawIndex;
for (const record of rawIndex.split("\0")) {
  if (!record) continue;
  const separator = record.indexOf("\t");
  if (separator <= 0) throw new Error("Unable to inspect Git index");
  const [mode, objectId, stage] = record.slice(0, separator).split(" ");
  if (
    stage !== "0"
    || !/^(?:100644|100755|120000|160000)$/.test(mode)
    || !/^[0-9a-f]{40,64}$/i.test(objectId)
  ) {
    throw new Error("Unable to inspect Git index");
  }
  const relative = record.slice(separator + 1);
  if (!isCanonicalRepositoryRelativePath(relative)) {
    process.stderr.write("Secret scan blocked: non-canonical repository path detected.\n");
    process.exit(1);
  }
  indexEntries.set(relative, { mode, objectId });
}
const rawIndexFlags = initialGitState.rawIndexFlags;
const hiddenIndexFlagsDetected = rawIndexFlags
  .split("\0")
  .filter(Boolean)
  .some((record) => (
    record.length < 3
    || record[1] !== " "
    || record[0] === "S"
    || /[a-z]/.test(record[0])
  ));
if (hiddenIndexFlagsDetected) {
  process.stderr.write("Secret scan blocked: hidden Git index flags detected.\n");
  process.exitCode = 1;
}
const ignoredExtensions = new Set([
  ".avif",
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".pdf",
  ".png",
  ".ttf",
  ".webm",
  ".webp",
  ".woff",
  ".woff2",
]);
const proseExtensions = new Set([".adoc", ".md", ".mdx", ".rst", ".txt"]);
const configSecretExtensions = new Set([
  ".cfg", ".conf", ".env", ".ini", ".properties", ".toml", ".yaml", ".yml",
]);
const TEST_FIXTURE_PATH_PATTERN = /(?:^|\/)(?:__tests__\/|e2e\/mock-api\.cjs$|[^/]+\.(?:test|spec)\.[cm]?[jt]sx?$)/i;
// Exact SHA-256 sentinels already committed in tests; applied only to test fixture paths.
const TEST_FIXTURE_CREDENTIAL_DIGESTS = new Set([
  "10bcc524fde1afb24d1da1129f31b5e5c1738b42246b44674af4e292e71eb594",
  "1df4b07d05b9b3b1115b4b6b22af319a2f99564a2fa2573a34896063c7513c10",
  "1fcc4b37141c12bdbd26dde9b38274d3722510565931d89e3e43526c2ea68feb",
  "26d141c9a7204906121db95e892d2c8b500c3db440c06d3eaa6715f0cbf8763f",
  "3bbc3a9700a71c6a53a34a2a354000fd31446310d4758902d42b2a3a0bb43e72",
  "4282e6cc3ac01e49a84f3b6c3f5d30c4b7f113012809f2d1d34c3e5b618923f8",
  "4c806362b613f7496abf284146efd31da90e4b16169fe001841ca17290f427c4",
  "5e2040ab40dda85da03488a044e0fe9b344d6479f9e26ae74d72d9e784e1d0c0",
  "6279a9ec428ed7659c7cf2f970b3f0820a20b4d5c6a9eeaa443052f426bc2db6",
  "62af8704764faf8ea82fc61ce9c4c3908b6cb97d463a634e9e587d7c885db0ef",
  "741982021a266663c140584a5792aad5f3e2b89322e849126dc3337431cdcccf",
  "7466789de6276df686bee0c8de78a13be486dce06e09555c6a458c2e1ca5ba04",
  "7a74316cbd7bff4ff5254596c29c3985b4479d1491e7711e8a16860a5f69cd5d",
  "7d19b716b1e5083012f0ec511be65a74992eeb0afd0ba6ea2649267df545f9b8",
  "894e01a8315fcc4199bed8138560585d3ebdd0b4a2e295e47d730dc45061d12b",
  "8a1914992d43ca2225bb7ea93ab149b4c455750da5bf8e987f391b935a11722b",
  "8ce203545dd0d74e5e89ca19d5a4cb9be76cb169d051a4cc461c9451b94d77dd",
  "8db73cd4b250647a94ab40feb1084aae4492dc33c1243dec7052647ece758016",
  "950141f5143d92b8f45b56cf546a3bef20e359c018127d87e656bd2ba2d1d842",
  "a79bbcbfc3f84f7c87ddc52d498a7e1c5fe52085a6f9f398770f906d6abed41b",
  "b2867617492e26c338ab49f72afabc984d798b59755a27e312b953716ae964d7",
  "c4c898416fbf99c92d3cc763cb09901585e71e10cfc7aa64dc045b8538b3ee26",
  "c775e7b757ede630cd0aa1113bd102661ab38829ca52a6422ab782862f268646",
  "ccf8329c60bc96986775b9f52040a15fd056d54bad04ac0d300ac51252b82f99",
  "d7f6b1fad67e63ce5f4cab1e2510217e9f6c8b614db44250090fe5fe73c5d11e",
  "e4c3cdb434986141bbf3c1f28ef756bf81d04097a76cf00b96546bbf8c662c42",
  "e54b74eb9192b48055c48d2062bffdd23469ef7d70f960ff1293a47f86c8eba2",
]);
const isSensitiveConfigPath = (relativePath) => {
  const basename = path.basename(relativePath).toLowerCase();
  if (basename === ".env" || basename.startsWith(".env.")) return true;
  return [...configSecretExtensions].some((extension) => (
    basename.endsWith(extension) || basename.includes(`${extension}.`)
  ));
};
const SENSITIVE_FILE_NAME_PATTERN = /(?:credential|password|secret|token)/i;
const allowStandaloneGoogleAppPassword = (relativePath) => (
  !proseExtensions.has(path.extname(relativePath).toLowerCase())
  || SENSITIVE_FILE_NAME_PATTERN.test(path.basename(relativePath))
);
const compareText = (left, right) => (left < right ? -1 : left > right ? 1 : 0);
const sameFileSnapshot = (left, right) => (
  left.dev === right.dev
  && left.ino === right.ino
  && left.size === right.size
  && left.mode === right.mode
  && left.mtimeNs === right.mtimeNs
  && left.ctimeNs === right.ctimeNs
);
const snapshotDigest = (snapshot) => createHash("sha256")
  .update([
    snapshot.dev,
    snapshot.ino,
    snapshot.size,
    snapshot.mode,
    snapshot.mtimeNs,
    snapshot.ctimeNs,
  ].map(String).join(":"))
  .digest("hex");
const canonicalRoot = fs.realpathSync(root);
const isInsideRoot = (target) => {
  const relative = path.relative(canonicalRoot, target);
  return relative === "" || (
    relative !== ".."
    && !relative.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relative)
  );
};
const readWorkingCandidate = (absolute, { decodeRegularContent = true } = {}) => {
  const before = fs.lstatSync(absolute, { bigint: true });
  if (before.isSymbolicLink()) {
    const content = fs.readlinkSync(absolute);
    const after = fs.lstatSync(absolute, { bigint: true });
    if (!sameFileSnapshot(before, after) || content !== fs.readlinkSync(absolute)) {
      throw new Error("Working candidate changed during scanning");
    }
    return {
      content,
      digest: createHash("sha256").update("symlink:").update(content).digest("hex"),
      kind: "symlink",
      oversized: false,
    };
  }
  if (!before.isFile()) return null;
  if (before.size > BigInt(MAX_FILE_BYTES)) {
    return { content: null, digest: snapshotDigest(before), oversized: true };
  }
  const real = fs.realpathSync(absolute);
  if (!isInsideRoot(real)) throw new Error("Working candidate escapes repository");
  const handle = fs.openSync(real, "r");
  let openedBefore;
  let openedAfter;
  let bytes;
  try {
    openedBefore = fs.fstatSync(handle, { bigint: true });
    if (!openedBefore.isFile() || !sameFileSnapshot(before, openedBefore)) {
      throw new Error("Working candidate changed during scanning");
    }
    bytes = fs.readFileSync(handle);
    openedAfter = fs.fstatSync(handle, { bigint: true });
  } finally {
    fs.closeSync(handle);
  }
  const after = fs.lstatSync(absolute, { bigint: true });
  if (
    !sameFileSnapshot(openedBefore, openedAfter)
    || !sameFileSnapshot(openedAfter, after)
    || fs.realpathSync(absolute) !== real
    || bytes.length !== Number(openedAfter.size)
  ) {
    throw new Error("Working candidate changed during scanning");
  }
  return {
    content: decodeRegularContent ? decodeSensitiveTextBytes(bytes) : null,
    digest: createHash("sha256")
      .update((openedAfter.mode & 0o100n) === 0n ? "file:100644:" : "file:100755:")
      .update(bytes)
      .digest("hex"),
    kind: "file",
    oversized: false,
  };
};
const indexObjectIds = [...new Set(
  [...indexEntries.entries()]
    .filter(([relative, entry]) => (
      entry.mode !== "160000"
    ))
    .map(([, entry]) => entry.objectId),
)];
const readIndexBlobs = (objectIds, consumeBlob) => {
  const oversizedObjectIds = new Set();
  if (objectIds.length > MAX_INDEX_OBJECTS) {
    throw new Error("Git index exceeds the object scan limit");
  }
  if (objectIds.length === 0) return { oversizedObjectIds };
  const metadataOutput = execFileSync(
    "git",
    ["cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)"],
    {
      cwd: root,
      encoding: "utf8",
      input: `${objectIds.join("\n")}\n`,
      maxBuffer: Math.max(1024, objectIds.length * 128),
    },
  );
  const metadata = metadataOutput.trimEnd().split("\n").map((line, index) => {
    const [objectId, objectType, rawSize] = line.split(" ");
    const size = Number(rawSize);
    if (
      objectId !== objectIds[index]
      || objectType !== "blob"
      || !Number.isSafeInteger(size)
      || size < 0
    ) {
      throw new Error("Unable to inspect Git index");
    }
    return { objectId, size };
  });
  if (metadata.length !== objectIds.length) {
    throw new Error("Unable to inspect Git index");
  }
  const totalIndexBytes = metadata.reduce((total, { size }) => total + size, 0);
  if (!Number.isSafeInteger(totalIndexBytes) || totalIndexBytes > MAX_TOTAL_INDEX_BYTES) {
    throw new Error("Git index exceeds the aggregate scan size limit");
  }
  for (const { objectId, size } of metadata) {
    if (size > MAX_FILE_BYTES) oversizedObjectIds.add(objectId);
  }
  const batches = [];
  let batch = [];
  let batchBytes = 0;
  for (const item of metadata.filter(({ size }) => size <= MAX_FILE_BYTES)) {
    if (
      batch.length > 0
      && (
        batch.length >= MAX_BATCH_OBJECTS
        || batchBytes + item.size > MAX_BATCH_BYTES
      )
    ) {
      batches.push(batch);
      batch = [];
      batchBytes = 0;
    }
    batch.push(item);
    batchBytes += item.size;
  }
  if (batch.length > 0) batches.push(batch);

  for (const items of batches) {
    const output = execFileSync("git", ["cat-file", "--batch"], {
      cwd: root,
      input: `${items.map(({ objectId }) => objectId).join("\n")}\n`,
      maxBuffer: items.reduce((total, { size }) => total + size + 128, 1),
    });
    let offset = 0;
    for (const item of items) {
      const headerEnd = output.indexOf(0x0a, offset);
      if (headerEnd === -1) throw new Error("Unable to inspect Git index");
      const header = output.subarray(offset, headerEnd).toString("ascii");
      if (header !== `${item.objectId} blob ${item.size}`) {
        throw new Error("Unable to inspect Git index");
      }
      const contentStart = headerEnd + 1;
      const contentEnd = contentStart + item.size;
      if (contentEnd >= output.length || output[contentEnd] !== 0x0a) {
        throw new Error("Unable to inspect Git index");
      }
      consumeBlob(item.objectId, output.subarray(contentStart, contentEnd));
      offset = contentEnd + 1;
    }
    if (offset !== output.length) throw new Error("Unable to inspect Git index");
  }
  return { oversizedObjectIds };
};
const findings = [];
const workingSnapshots = new Map();
const recordContentFindings = (relative, content) => {
  const configCandidate = isSensitiveConfigPath(relative);
  for (const type of findCanonicalSecretTypes(content, {
    allowStandaloneGoogleAppPassword: allowStandaloneGoogleAppPassword(relative),
    allowBearerToken: true,
    allowCredentialAssignment: true,
    allowUnquotedCredentialAssignment: configCandidate,
    credentialNamePolicy: "all",
    minimumBearerLength: 12,
    minimumCredentialLength: 8,
    credentialValueDigestAllowlist: TEST_FIXTURE_PATH_PATTERN.test(relative)
      ? TEST_FIXTURE_CREDENTIAL_DIGESTS
      : undefined,
  })) {
    findings.push({ file: relative, type });
  }
};
const indexPathsByObjectId = new Map();
for (const [relative, entry] of indexEntries) {
  if (entry.mode === "160000") continue;
  const paths = indexPathsByObjectId.get(entry.objectId) || [];
  paths.push({ mode: entry.mode, relative });
  indexPathsByObjectId.set(entry.objectId, paths);
}
const { oversizedObjectIds } = readIndexBlobs(indexObjectIds, (objectId, bytes) => {
  const paths = (indexPathsByObjectId.get(objectId) || []).filter(({ mode, relative }) => (
    mode === "120000"
    || !ignoredExtensions.has(path.extname(relative).toLowerCase())
  ) && !(
    path.basename(relative).startsWith(".env")
    && !relative.endsWith(".example")
  ));
  if (paths.length === 0) return;
  const content = decodeSensitiveTextBytes(bytes);
  for (const { relative } of paths) recordContentFindings(relative, content);
});
for (const relative of files) {
  for (const type of findCanonicalSecretTypes(relative, { repositoryPath: true })) {
    findings.push({ file: relative, type });
  }
  if (
    path.basename(relative).startsWith(".env") &&
    !relative.endsWith(".example")
  ) {
    findings.push({ file: relative, type: "tracked-env-file" });
    continue;
  }
  const indexEntry = indexEntries.get(relative);
  if (
    indexEntry
    && indexEntry.mode !== "160000"
  ) {
    if (oversizedObjectIds.has(indexEntry.objectId)) {
      if (!ignoredExtensions.has(path.extname(relative).toLowerCase())) {
        findings.push({ file: relative, type: "oversized-candidate" });
      }
    }
  }
  if (!workingTreeFiles.has(relative)) continue;
  const absolute = path.join(root, relative);
  const decodeRegularContent = !ignoredExtensions.has(
    path.extname(relative).toLowerCase(),
  );
  let candidate;
  try {
    candidate = readWorkingCandidate(absolute, { decodeRegularContent });
  } catch (error) {
    if (error?.code === "ENOENT") continue;
    throw error;
  }
  if (!candidate) continue;
  workingSnapshots.set(relative, {
    decodeRegularContent,
    digest: candidate.digest,
    oversized: candidate.oversized,
  });
  if (candidate.oversized) {
    if (!ignoredExtensions.has(path.extname(relative).toLowerCase())) {
      findings.push({ file: relative, type: "oversized-candidate" });
    }
    continue;
  }
  if (candidate.content !== null) recordContentFindings(relative, candidate.content);
}

const uniqueFindings = [...new Map(
  findings.map((finding) => [`${finding.file}\0${finding.type}`, finding]),
).values()].sort((left, right) => (
  compareText(left.file, right.file) || compareText(left.type, right.type)
));

let gitStateDrift = false;
try {
  const finalGitState = readGitState();
  const verifyWorkingSnapshots = () => {
    for (const [relative, initialSnapshot] of workingSnapshots) {
      const currentSnapshot = readWorkingCandidate(path.join(root, relative), {
        decodeRegularContent: initialSnapshot.decodeRegularContent,
      });
      if (
        !currentSnapshot
        || currentSnapshot.digest !== initialSnapshot.digest
        || currentSnapshot.oversized !== initialSnapshot.oversized
      ) {
        throw new Error("Working candidate changed during scanning");
      }
    }
  };
  verifyWorkingSnapshots();
  const returnGitState = readGitState();
  verifyWorkingSnapshots();
  gitStateDrift = Object.keys(initialGitState).some((field) => (
    initialGitState[field] !== finalGitState[field]
      || initialGitState[field] !== returnGitState[field]
  ));
} catch {
  gitStateDrift = true;
}
if (gitStateDrift) {
  process.stderr.write("Secret scan blocked: Git state changed during scanning.\n");
  process.exitCode = 1;
}

if (uniqueFindings.length > 0) {
  process.stderr.write(
    "Potential secrets found:\n" +
      uniqueFindings
        .map((finding) =>
          "- " + safeFindingPath(finding.file) + " (" + finding.type + ")")
        .join("\n") +
      "\n",
  );
  process.exitCode = 1;
} else if (!hiddenIndexFlagsDetected && !gitStateDrift) {
  process.stdout.write("Secret scan passed.\n");
}
} catch {
  process.stderr.write("Secret scan failed.\n");
  process.exitCode = 1;
}
