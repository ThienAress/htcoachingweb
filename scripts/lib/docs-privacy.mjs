import { createHash } from "node:crypto";
import { lstat, open, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import {
  assertGitDocumentationStateUnchanged,
  collectGitDocumentationCandidates,
  readGitIndexDocument,
} from "./docs-privacy-git.mjs";
import {
  decodeSensitiveTextBytes,
  hasSecretLikeText,
  normalizeSensitiveText,
} from "./sensitive-text.mjs";
export const DEFAULT_TRACKED_DOC_PATHS = Object.freeze([
  "docs/handoffs",
  "docs/audits",
  "docs/plans",
]);

export const DOCUMENT_EXTENSIONS = new Set([
  ".adoc",
  ".json",
  ".md",
  ".mdx",
  ".rst",
  ".txt",
]);

export const MAX_DOCUMENT_BYTES = 2_000_000;
export const MAX_DOCUMENT_COUNT = 5_000;
export const MAX_TOTAL_DOCUMENT_BYTES = 64 * 1024 * 1024;

export const PLACEHOLDER_EMAIL_DOMAINS = new Set([
  "example.com",
  "example.net",
  "example.org",
  "example.invalid",
  "test.invalid",
]);

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})\b/gi;
const WINDOWS_ABSOLUTE_PATH_PATTERN = /\b[A-Z]:[\\/][^\s`"'\r\n|]+/gi;
const UNC_ABSOLUTE_PATH_PATTERN =
  /(?<![:A-Za-z0-9._~/%-])((?:\\\\|\/\/)[^\\/\s`"'\r\n|]+[\\/][^\s`"'\r\n|]+)/g;
const POSIX_LOCAL_PATH_PATTERN =
  /(?<![A-Za-z0-9._~/%-])((?:\/(?:home|Users|root)\/|\/workspaces?\/|\/mnt\/[a-z]\/Users\/|\/(?:private\/)?tmp\/|\/(?:private\/)?var\/(?:tmp|folders)\/)[^\s`"'\r\n|]+)/gi;
const FILE_URI_PATTERN = /\bfile:\/\/([^\s`"'\r\n|]+)/gi;
const VIETNAMESE_PHONE_PREFIX =
  String.raw`(?:(?:(?:\((?:\+|00)84\)|(?:\+|00)84)(?:[ .()-]{0,4}\(0\))?)|84|0)`;
const VIETNAMESE_MOBILE_PATTERN = new RegExp(
  String.raw`(?<!\d)${VIETNAMESE_PHONE_PREFIX}[ .()-]{0,4}[35789](?:[ .()-]{0,4}\d){8}(?!\d)`,
  "g",
);
const VIETNAMESE_FIXED_LINE_PATTERN = new RegExp(
  String.raw`(?<!\d)${VIETNAMESE_PHONE_PREFIX}[ .()-]{0,4}2(?:[ .()-]{0,4}\d){9}(?!\d)`,
  "g",
);
const UNSAFE_OUTPUT_PATH_PATTERN =
  /(?:[\p{C}\p{Zl}\p{Zp}]|\p{Default_Ignorable_Code_Point})/u;
const PATH_PLACEHOLDER =
  String.raw`(?:<(?:user(?:name)?|repo(?:sitory)?|workspace|project)>|\{(?:user(?:name)?|repo(?:sitory)?|workspace|project)\}|\[(?:user(?:name)?|repo(?:sitory)?|workspace|project)\])`;
const ALLOWED_PLACEHOLDER_PATH_PATTERNS = [
  new RegExp(`^[A-Z]:[\\\\/]Users[\\\\/]${PATH_PLACEHOLDER}(?:[\\\\/]|$)`, "i"),
  new RegExp(`^[A-Z]:[\\\\/]${PATH_PLACEHOLDER}(?:[\\\\/]|$)`, "i"),
  new RegExp(`^/(?:home|Users)/${PATH_PLACEHOLDER}(?:/|$)`, "i"),
  new RegExp(`^/root/${PATH_PLACEHOLDER}(?:/|$)`, "i"),
  new RegExp(`^/workspaces?/${PATH_PLACEHOLDER}(?:/|$)`, "i"),
  new RegExp(`^/mnt/[a-z]/Users/${PATH_PLACEHOLDER}(?:/|$)`, "i"),
  new RegExp(`^/(?:private/)?(?:tmp|var/(?:tmp|folders))/${PATH_PLACEHOLDER}(?:/|$)`, "i"),
];

const compareText = (left, right) => (left < right ? -1 : left > right ? 1 : 0);
const toPortablePath = (value) => value.split(path.sep).join("/");
const isDocumentFile = (filePath) =>
  DOCUMENT_EXTENSIONS.has(path.extname(filePath).toLowerCase());

const isInside = (parentPath, childPath) => {
  const relativePath = path.relative(parentPath, childPath);
  return relativePath === "" || (
    relativePath !== ".."
    && !relativePath.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relativePath)
  );
};

const statSnapshot = (fileStat) => Object.freeze({
  birthtimeNs: fileStat.birthtimeNs.toString(),
  ctimeNs: fileStat.ctimeNs.toString(),
  dev: fileStat.dev.toString(),
  ino: fileStat.ino.toString(),
  mode: fileStat.mode.toString(),
  mtimeNs: fileStat.mtimeNs.toString(),
  nlink: fileStat.nlink.toString(),
  size: fileStat.size.toString(),
});

const sameStatSnapshot = (left, right) =>
  Object.keys(left).every((key) => left[key] === right[key]);

const SCAN_CONTEXT = Symbol("docs-privacy-scan-context");
const attachScanContext = (targets, context) => {
  Object.defineProperty(targets, SCAN_CONTEXT, {
    configurable: false,
    enumerable: false,
    value: Object.freeze(context),
    writable: false,
  });
  return targets;
};

const safeDisplayPath = (absolutePath, repositoryRoot, externalRoot) => {
  if (isInside(repositoryRoot, absolutePath)) {
    return toPortablePath(path.relative(repositoryRoot, absolutePath));
  }

  if (externalRoot && isInside(externalRoot, absolutePath)) {
    const relativePath = path.relative(externalRoot, absolutePath);
    return toPortablePath(relativePath || path.basename(absolutePath));
  }

  return path.basename(absolutePath);
};

const listDirectoryDocuments = async (directoryPath) => {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const documents = [];

  for (const entry of entries.sort((left, right) => compareText(left.name, right.name))) {
    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error("Documentation symbolic links are not allowed");
    }
    if (entry.isDirectory()) {
      documents.push(...(await listDirectoryDocuments(entryPath)));
    } else if (entry.isFile() && isDocumentFile(entryPath)) {
      documents.push(entryPath);
    }
  }

  return documents;
};

const captureDirectoryDocuments = async (directoryPath) => {
  const changedMessage = "Documentation directory changed during scanning";
  const directoryStatBefore = await lstat(directoryPath, { bigint: true });
  if (directoryStatBefore.isSymbolicLink() || !directoryStatBefore.isDirectory()) {
    throw new Error(changedMessage);
  }
  const canonicalPath = await realpath(directoryPath);
  const documents = await listDirectoryDocuments(directoryPath);
  const directoryStatAfter = await lstat(directoryPath, { bigint: true });
  const canonicalPathAfter = await realpath(directoryPath);
  if (
    directoryStatAfter.isSymbolicLink()
    || !directoryStatAfter.isDirectory()
    || canonicalPathAfter !== canonicalPath
    || !sameStatSnapshot(
      statSnapshot(directoryStatBefore),
      statSnapshot(directoryStatAfter),
    )
  ) {
    throw new Error(changedMessage);
  }

  return {
    documents,
    snapshot: Object.freeze({
      canonicalPath,
      directoryPath,
      documentPaths: Object.freeze(documents.map((documentPath) =>
        toPortablePath(path.relative(directoryPath, documentPath)))),
      stat: statSnapshot(directoryStatAfter),
    }),
  };
};

const assertDirectoryDocumentsUnchanged = async (snapshot) => {
  const current = await captureDirectoryDocuments(snapshot.directoryPath);
  if (
    current.snapshot.canonicalPath !== snapshot.canonicalPath
    || !sameStatSnapshot(current.snapshot.stat, snapshot.stat)
    || current.snapshot.documentPaths.length !== snapshot.documentPaths.length
    || current.snapshot.documentPaths.some(
      (documentPath, index) => documentPath !== snapshot.documentPaths[index],
    )
  ) {
    throw new Error("Documentation directory changed during scanning");
  }
};

const listTrackedDocuments = async (repositoryRoot, trackedPaths) => {
  const allowedRoot = await realpath(repositoryRoot);
  const {
    gitStateSnapshot,
    indexTargets,
    workingTreeDisplayPaths,
  } = collectGitDocumentationCandidates({
    repositoryRoot,
    allowedRoot,
    trackedPaths,
    isDocumentFile,
  });
  const targets = [...indexTargets];

  for (const displayPath of workingTreeDisplayPaths) {
    const absolutePath = path.resolve(repositoryRoot, displayPath);
    if (!isInside(repositoryRoot, absolutePath)) {
      throw new Error("Documentation path escapes the repository");
    }
    let fileStat;
    try {
      fileStat = await lstat(absolutePath);
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }
    if (fileStat.isSymbolicLink()) {
      throw new Error("Documentation symbolic links are not allowed");
    }
    if (!fileStat.isFile()) continue;
    targets.push({
      source: "working-tree",
      absolutePath,
      displayPath: toPortablePath(displayPath),
      allowedRoot,
      gitStateSnapshot,
    });
  }
  return attachScanContext(targets, {
    directorySnapshots: Object.freeze([]),
    gitStateSnapshots: Object.freeze([gitStateSnapshot]),
  });
};

export const collectScanTargets = async ({
  inputs = [],
  repositoryRoot = process.cwd(),
  trackedPaths = DEFAULT_TRACKED_DOC_PATHS,
} = {}) => {
  if (inputs.length === 0) {
    return listTrackedDocuments(repositoryRoot, trackedPaths);
  }

  const targets = [];
  const directorySnapshots = [];
  for (const input of inputs) {
    const absoluteInput = path.resolve(repositoryRoot, input);
    const inputStat = await lstat(absoluteInput);
    if (inputStat.isSymbolicLink()) {
      throw new Error("Documentation symbolic links are not allowed");
    }

    if (inputStat.isDirectory()) {
      const { documents, snapshot: directorySnapshot } =
        await captureDirectoryDocuments(absoluteInput);
      const allowedRoot = directorySnapshot.canonicalPath;
      directorySnapshots.push(directorySnapshot);
      for (const documentPath of documents) {
        targets.push({
          source: "working-tree",
          absolutePath: documentPath,
          displayPath: safeDisplayPath(documentPath, repositoryRoot, absoluteInput),
          allowedRoot,
          directorySnapshot,
        });
      }
    } else if (inputStat.isFile() && isDocumentFile(absoluteInput)) {
      targets.push({
        source: "working-tree",
        absolutePath: absoluteInput,
        displayPath: safeDisplayPath(absoluteInput, repositoryRoot),
        allowedRoot: await realpath(path.dirname(absoluteInput)),
      });
    }
  }

  const uniqueTargets = new Map();
  for (const target of targets) {
    const sourceKey = target.source === "git-index"
      ? `${target.source}:${target.objectId}:${target.displayPath}`
      : `${target.source}:${target.absolutePath}`;
    uniqueTargets.set(sourceKey, target);
  }

  return attachScanContext(
    [...uniqueTargets.values()].sort((left, right) =>
      compareText(left.displayPath, right.displayPath)),
    {
      directorySnapshots: Object.freeze([...directorySnapshots]),
      gitStateSnapshots: Object.freeze([]),
    },
  );
};

const isAllowedEmail = (domain) => PLACEHOLDER_EMAIL_DOMAINS.has(domain.toLowerCase());
const isAllowedPath = (value) =>
  ALLOWED_PLACEHOLDER_PATH_PATTERNS.some((pattern) => pattern.test(value));
const normalizeForClassification = (value) => normalizeSensitiveText(value)
  .replace(/[\u2044\u2215\u29f8]/g, "/")
  .replace(/[\u2216\u29f5]/g, "\\");
const isAllowedFileUri = (body) => {
  let host = "";
  let uriPath = body;
  if (!body.startsWith("/")) {
    const separatorIndex = body.indexOf("/");
    if (separatorIndex === -1) return false;
    host = body.slice(0, separatorIndex);
    uriPath = body.slice(separatorIndex);
  }
  const comparablePath = /^\/[A-Z]:\//i.test(uriPath) ? uriPath.slice(1) : uriPath;
  return (!host || host.toLowerCase() === "localhost") && isAllowedPath(comparablePath);
};

export const findPrivacyTypes = (line) => {
  const types = new Set();
  const normalizedLine = normalizeForClassification(line);

  EMAIL_PATTERN.lastIndex = 0;
  for (const match of normalizedLine.matchAll(EMAIL_PATTERN)) {
    if (!isAllowedEmail(match[1])) {
      types.add("personal-email");
    }
  }

  WINDOWS_ABSOLUTE_PATH_PATTERN.lastIndex = 0;
  for (const match of normalizedLine.matchAll(WINDOWS_ABSOLUTE_PATH_PATTERN)) {
    if (!isAllowedPath(match[0])) {
      types.add("absolute-local-path");
    }
  }

  UNC_ABSOLUTE_PATH_PATTERN.lastIndex = 0;
  for (const match of normalizedLine.matchAll(UNC_ABSOLUTE_PATH_PATTERN)) {
    if (!isAllowedPath(match[1])) types.add("absolute-local-path");
  }

  POSIX_LOCAL_PATH_PATTERN.lastIndex = 0;
  for (const match of normalizedLine.matchAll(POSIX_LOCAL_PATH_PATTERN)) {
    if (!isAllowedPath(match[1])) {
      types.add("absolute-local-path");
    }
  }

  FILE_URI_PATTERN.lastIndex = 0;
  for (const match of normalizedLine.matchAll(FILE_URI_PATTERN)) {
    if (!isAllowedFileUri(match[1])) types.add("absolute-local-path");
  }

  VIETNAMESE_MOBILE_PATTERN.lastIndex = 0;
  VIETNAMESE_FIXED_LINE_PATTERN.lastIndex = 0;
  if (
    VIETNAMESE_MOBILE_PATTERN.test(normalizedLine) ||
    VIETNAMESE_FIXED_LINE_PATTERN.test(normalizedLine)
  ) {
    types.add("personal-phone");
  }

  return [...types].sort(compareText);
};

const redactDisplayPath = (value) =>
  `redacted-path-${createHash("sha256").update(String(value)).digest("hex").slice(0, 12)}`;

export const safeFindingPath = (value) => {
  const displayPath = String(value ?? "");
  return findPrivacyTypes(displayPath).length > 0
    || hasSecretLikeText(displayPath, { repositoryPath: true })
    || UNSAFE_OUTPUT_PATH_PATTERN.test(displayPath)
    ? redactDisplayPath(displayPath)
    : displayPath;
};

const assertBoundedRegularFile = (fileStat, changedMessage) => {
  if (fileStat.isSymbolicLink() || !fileStat.isFile()) {
    throw new Error(changedMessage);
  }
  if (fileStat.size > BigInt(MAX_DOCUMENT_BYTES)) {
    throw new Error("Documentation target exceeds the scan size limit");
  }
};

const readWorkingTreeDocument = async (target) => {
  const changedMessage = "Documentation target changed during scanning";
  const allowedRoot = await realpath(
    target.allowedRoot || path.dirname(target.absolutePath),
  );
  const pathStatBefore = await lstat(target.absolutePath, { bigint: true });
  assertBoundedRegularFile(pathStatBefore, changedMessage);
  const canonicalPath = await realpath(target.absolutePath);
  if (!isInside(allowedRoot, canonicalPath)) {
    throw new Error("Documentation target escapes its allowed root");
  }

  const handle = await open(canonicalPath, "r");
  try {
    const handleStatBefore = await handle.stat({ bigint: true });
    assertBoundedRegularFile(handleStatBefore, changedMessage);
    const pathBeforeSnapshot = statSnapshot(pathStatBefore);
    const handleBeforeSnapshot = statSnapshot(handleStatBefore);
    if (!sameStatSnapshot(pathBeforeSnapshot, handleBeforeSnapshot)) {
      throw new Error(changedMessage);
    }

    const bytes = await handle.readFile();
    if (
      bytes.length > MAX_DOCUMENT_BYTES
      || BigInt(bytes.length) !== handleStatBefore.size
    ) {
      throw new Error(changedMessage);
    }

    const handleStatAfter = await handle.stat({ bigint: true });
    const pathStatAfter = await lstat(target.absolutePath, { bigint: true });
    assertBoundedRegularFile(handleStatAfter, changedMessage);
    assertBoundedRegularFile(pathStatAfter, changedMessage);
    const canonicalPathAfter = await realpath(target.absolutePath);
    const handleAfterSnapshot = statSnapshot(handleStatAfter);
    const pathAfterSnapshot = statSnapshot(pathStatAfter);
    if (
      canonicalPathAfter !== canonicalPath
      || !isInside(allowedRoot, canonicalPathAfter)
      || !sameStatSnapshot(handleBeforeSnapshot, handleAfterSnapshot)
      || !sameStatSnapshot(handleAfterSnapshot, pathAfterSnapshot)
    ) {
      throw new Error(changedMessage);
    }

    return {
      byteLength: bytes.length,
      content: decodeSensitiveTextBytes(bytes),
      snapshot: Object.freeze({
        allowedRoot,
        canonicalPath,
        digest: createHash("sha256").update(bytes).digest("hex"),
        stat: handleAfterSnapshot,
        target,
      }),
    };
  } finally {
    await handle.close();
  }
};

const assertWorkingTreeDocumentUnchanged = async (snapshot) => {
  const current = await readWorkingTreeDocument(snapshot.target);
  if (
    current.snapshot.allowedRoot !== snapshot.allowedRoot
    || current.snapshot.canonicalPath !== snapshot.canonicalPath
    || current.snapshot.digest !== snapshot.digest
    || !sameStatSnapshot(current.snapshot.stat, snapshot.stat)
  ) {
    throw new Error("Documentation target changed during scanning");
  }
};

export const scanDocuments = async (targets) => {
  if (!Array.isArray(targets) || targets.length > MAX_DOCUMENT_COUNT) {
    throw new Error("Documentation target count exceeds the scan limit");
  }
  const findings = [];
  const scanContext = targets?.[SCAN_CONTEXT];
  const directorySnapshots = new Set(scanContext?.directorySnapshots || []);
  const gitStateSnapshots = new Set(scanContext?.gitStateSnapshots || []);
  const workingTreeSnapshots = [];
  let totalDocumentBytes = 0;
  for (const target of targets) {
    if (target.gitStateSnapshot) gitStateSnapshots.add(target.gitStateSnapshot);
    if (target.directorySnapshot) directorySnapshots.add(target.directorySnapshot);
    const pathTypes = findPrivacyTypes(target.displayPath);
    const findingPath = safeFindingPath(target.displayPath);
    for (const type of pathTypes) findings.push({ file: findingPath, line: 0, type });
    let document;
    if (target.source === "git-index") {
      document = readGitIndexDocument(target, { maxDocumentBytes: MAX_DOCUMENT_BYTES });
    } else {
      const workingDocument = await readWorkingTreeDocument(target);
      document = workingDocument;
      workingTreeSnapshots.push(workingDocument.snapshot);
    }
    totalDocumentBytes += document.byteLength;
    if (totalDocumentBytes > MAX_TOTAL_DOCUMENT_BYTES) {
      throw new Error("Documentation targets exceed the aggregate scan size limit");
    }
    const lines = document.content.split(/\r?\n/);

    for (const [lineIndex, line] of lines.entries()) {
      for (const type of findPrivacyTypes(line)) {
        findings.push({
          file: findingPath,
          line: lineIndex + 1,
          type,
        });
      }
    }
  }

  for (let verificationRound = 0; verificationRound < 2; verificationRound += 1) {
    for (const snapshot of workingTreeSnapshots) {
      await assertWorkingTreeDocumentUnchanged(snapshot);
    }
    for (const snapshot of directorySnapshots) {
      await assertDirectoryDocumentsUnchanged(snapshot);
    }
    for (const snapshot of gitStateSnapshots) {
      assertGitDocumentationStateUnchanged(snapshot);
    }
  }

  const uniqueFindings = new Map();
  for (const finding of findings) {
    uniqueFindings.set(`${finding.file}\0${finding.line}\0${finding.type}`, finding);
  }

  return [...uniqueFindings.values()].sort(
    (left, right) =>
      compareText(left.file, right.file) ||
      left.line - right.line ||
      compareText(left.type, right.type),
  );
};

export const formatFinding = ({ file, line, type }) =>
  `${safeFindingPath(file)}:${line}:${type}`;
