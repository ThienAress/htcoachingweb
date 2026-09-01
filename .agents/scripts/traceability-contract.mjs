import fs from "node:fs";
import path from "node:path";
import { isCanonicalRepositoryRelativePath } from "../../scripts/lib/repository-path.mjs";
import { stripNonContractMarkdown } from "./markdown-contract.mjs";

const TEST_EVIDENCE_PATTERN = /\.(?:test|spec)\.(?:[cm]?[jt]sx?)$/i;
const MAX_TRACE_BYTES = 2_000_000;

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

function readArtifactSnapshot(artifactSnapshots, field, relativePath) {
  const snapshot = artifactSnapshots[field];
  requireClosedObject(snapshot, ["path", "bytes"], `${field} snapshot`);
  if (snapshot.path !== relativePath || !Buffer.isBuffer(snapshot.bytes)) {
    throw new Error(`${field} snapshot does not match the declared artifact`);
  }
  return snapshot.bytes.toString("utf8").replace(/^\uFEFF/, "");
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
  if (fs.existsSync(resolved)) {
    const realRoot = fs.realpathSync(rootDir);
    const realPath = fs.realpathSync(resolved);
    if (!isInside(realRoot, realPath)) throw new Error(`${label} escapes the repository`);
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
    if (before.isSymbolicLink() || !before.isFile() || before.size > BigInt(MAX_TRACE_BYTES)) {
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

function extractSpecRequirementMap(content) {
  const contractContent = stripNonContractMarkdown(content);
  const headings = [...contractContent.matchAll(/^ {0,3}(#{1,6})[ \t]+([^\r\n]+)$/gm)].map((match) => ({
    index: match.index,
    level: match[1].length,
    title: match[2],
  }));
  const requirementHeadings = headings
    .map((heading, headingIndex) => {
      const requirementMatch = heading.title.match(/^(REQ-\d{3})\b/);
      return requirementMatch
        ? { ...heading, headingIndex, requirementId: requirementMatch[1] }
        : null;
    })
    .filter(Boolean);
  if (requirementHeadings.length === 0) {
    throw new Error("Spec must declare requirement headings");
  }
  const requirements = new Map();
  const acceptanceOwners = new Map();
  for (const heading of requirementHeadings) {
    const { requirementId } = heading;
    if (requirements.has(requirementId)) {
      throw new Error(`Spec contains duplicate requirement heading ${requirementId}`);
    }
    const nextBoundary = headings
      .slice(heading.headingIndex + 1)
      .find((candidate) => candidate.level <= heading.level);
    const sectionEnd = nextBoundary?.index ?? contractContent.length;
    const section = contractContent.slice(heading.index, sectionEnd);
    const acceptanceIds = new Set(
      [...section.matchAll(/^ {0,3}-[ \t]+(?:`(AC-\d{3})`|(AC-\d{3}))(?:[ \t]*:|\b)/gm)]
        .map((match) => match[1] ?? match[2]),
    );
    for (const acceptanceId of acceptanceIds) {
      const existingOwner = acceptanceOwners.get(acceptanceId);
      if (existingOwner && existingOwner !== requirementId) {
        throw new Error(
          `Acceptance criterion ${acceptanceId} belongs to multiple requirements`,
        );
      }
      acceptanceOwners.set(acceptanceId, requirementId);
    }
    requirements.set(requirementId, acceptanceIds);
  }
  return requirements;
}

export function validateTraceabilityManifest(
  input,
  { rootDir, fileName, artifactSnapshots } = {},
) {
  requireClosedObject(
    input,
    ["schemaVersion", "planId", "specPath", "planPath", "tasks", "requirements"],
    "Traceability manifest",
  );
  if (input.schemaVersion !== 1) {
    throw new Error("Traceability manifest must use schemaVersion 1");
  }
  requireString(input.planId, "planId", /^\d{3}[A-Z]?$/);
  if (fileName && fileName !== `${input.planId.toLowerCase()}.json`) {
    throw new Error(`${fileName}: filename must match planId ${input.planId}`);
  }
  if (artifactSnapshots !== undefined) {
    requireClosedObject(
      artifactSnapshots,
      ["specPath", "planPath"],
      "Artifact snapshots",
    );
  }
  const artifactContents = {};
  for (const [field, expectedPrefix] of [
    ["specPath", "docs/specs/"],
    ["planPath", "docs/plans/"],
  ]) {
    const resolved = resolveRepositoryPath(rootDir, input[field], field);
    const expectedDirectory = path.resolve(rootDir, expectedPrefix);
    if (!isInside(expectedDirectory, resolved)) {
      throw new Error(`${field} must stay under ${expectedPrefix}`);
    }
    if (!fs.existsSync(resolved)) throw new Error(`${field} does not exist`);
    if (path.extname(resolved).toLowerCase() !== ".md" || !fs.lstatSync(resolved).isFile()) {
      throw new Error(`${field} must be a regular Markdown file`);
    }
    if (!isInside(fs.realpathSync(expectedDirectory), fs.realpathSync(resolved))) {
      throw new Error(`${field} must stay under ${expectedPrefix}`);
    }
    artifactContents[field] = artifactSnapshots === undefined
      ? fs.readFileSync(resolved, "utf8").replace(/^\uFEFF/, "")
      : readArtifactSnapshot(artifactSnapshots, field, input[field]);
  }
  if (!path.basename(input.planPath).toUpperCase().startsWith(`${input.planId}-`)) {
    throw new Error("planPath must start with planId");
  }
  const specRequirements = extractSpecRequirementMap(artifactContents.specPath);
  const planContractContent = stripNonContractMarkdown(artifactContents.planPath);

  if (!Array.isArray(input.tasks) || input.tasks.length === 0) {
    throw new Error("tasks must contain at least one entry");
  }
  const taskIds = new Set();
  for (const [index, task] of input.tasks.entries()) {
    const label = `tasks[${index}]`;
    requireClosedObject(task, ["id", "title", "planStep"], label);
    requireString(task.id, `${label}.id`, /^TASK-\d{3}$/);
    if (taskIds.has(task.id)) throw new Error(`Duplicate task id: ${task.id}`);
    taskIds.add(task.id);
    requireString(task.title, `${label}.title`);
    requireString(task.planStep, `${label}.planStep`, /^Step \d+$/);
    const planStepPattern = new RegExp(
      `^ {0,3}#{1,6}[ \\t]+${task.planStep.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\b|:)`,
      "m",
    );
    if (!planStepPattern.test(planContractContent)) {
      throw new Error(`Plan step ${task.planStep} is not declared in plan`);
    }
  }

  if (!Array.isArray(input.requirements) || input.requirements.length === 0) {
    throw new Error("requirements must contain at least one entry");
  }
  const requirementIds = new Set();
  const acceptanceIds = new Set();
  let acceptanceCriteria = 0;
  for (const [requirementIndex, requirement] of input.requirements.entries()) {
    const requirementLabel = `requirements[${requirementIndex}]`;
    requireClosedObject(requirement, ["id", "acceptanceCriteria"], requirementLabel);
    requireString(requirement.id, `${requirementLabel}.id`, /^REQ-\d{3}$/);
    if (requirementIds.has(requirement.id)) {
      throw new Error(`Duplicate requirement id: ${requirement.id}`);
    }
    requirementIds.add(requirement.id);
    if (!specRequirements.has(requirement.id)) {
      throw new Error(`Requirement ${requirement.id} is not declared in spec`);
    }
    if (!Array.isArray(requirement.acceptanceCriteria) || requirement.acceptanceCriteria.length === 0) {
      throw new Error(`${requirementLabel}.acceptanceCriteria must not be empty`);
    }

    for (const [criterionIndex, criterion] of requirement.acceptanceCriteria.entries()) {
      const label = `${requirementLabel}.acceptanceCriteria[${criterionIndex}]`;
      requireClosedObject(
        criterion,
        ["id", "mustHave", "taskIds", "verifications"],
        label,
      );
      requireString(criterion.id, `${label}.id`, /^AC-\d{3}$/);
      if (acceptanceIds.has(criterion.id)) {
        throw new Error(`Duplicate acceptance criterion id: ${criterion.id}`);
      }
      acceptanceIds.add(criterion.id);
      if (!specRequirements.get(requirement.id).has(criterion.id)) {
        throw new Error(
          `Acceptance criterion ${criterion.id} is not declared under ${requirement.id} in spec`,
        );
      }
      acceptanceCriteria += 1;
      if (typeof criterion.mustHave !== "boolean") {
        throw new Error(`${label}.mustHave must be boolean`);
      }
      if (criterion.mustHave !== true) {
        throw new Error(`${criterion.id} must be marked mustHave in schemaVersion 1`);
      }
      if (!Array.isArray(criterion.taskIds)) throw new Error(`${label}.taskIds must be an array`);
      for (const taskId of criterion.taskIds) {
        if (!taskIds.has(taskId)) throw new Error(`${label} references unknown task ${taskId}`);
      }
      if (!Array.isArray(criterion.verifications)) {
        throw new Error(`${label}.verifications must be an array`);
      }
      if (criterion.taskIds.length === 0) {
        throw new Error(`Must-have ${criterion.id} requires at least one task`);
      }
      if (criterion.verifications.length === 0) {
        throw new Error(`Must-have ${criterion.id} requires at least one verification`);
      }

      for (const [verificationIndex, verification] of criterion.verifications.entries()) {
        const verificationLabel = `${label}.verifications[${verificationIndex}]`;
        requireObject(verification, verificationLabel);
        if (verification.type === "test") {
          requireClosedObject(verification, ["type", "path"], verificationLabel);
          const resolved = resolveRepositoryPath(
            rootDir,
            verification.path,
            `${verificationLabel}.path`,
          );
          if (!TEST_EVIDENCE_PATTERN.test(verification.path)) {
            throw new Error(
              `${verificationLabel}: test evidence must use a test or spec filename`,
            );
          }
          if (!fs.existsSync(resolved)) {
            throw new Error(`${verificationLabel}: verification path does not exist`);
          }
          if (!fs.lstatSync(resolved).isFile()) {
            throw new Error(`${verificationLabel}: test evidence must be a regular file`);
          }
        } else if (verification.type === "command") {
          requireClosedObject(verification, ["type", "command"], verificationLabel);
          requireString(verification.command, `${verificationLabel}.command`);
        } else {
          throw new Error(`${verificationLabel}.type must be test or command`);
        }
      }
    }
  }

  const specRequirementIds = new Set(specRequirements.keys());
  const specAcceptanceIds = new Set(
    [...specRequirements.values()].flatMap((criteria) => [...criteria]),
  );
  for (const requirementId of specRequirementIds) {
    if (!requirementIds.has(requirementId)) {
      throw new Error(`Spec requirement ${requirementId} is missing from traceability manifest`);
    }
  }
  for (const acceptanceId of specAcceptanceIds) {
    if (!acceptanceIds.has(acceptanceId)) {
      throw new Error(
        `Spec acceptance criterion ${acceptanceId} is missing from traceability manifest`,
      );
    }
  }
  return {
    planId: input.planId,
    requirements: requirementIds.size,
    acceptanceCriteria,
    tasks: taskIds.size,
  };
}

export function validateTraceabilityDirectory({ rootDir, directory }) {
  const expectedDirectory = path.resolve(rootDir, "docs", "plans", "traceability");
  if (path.resolve(directory) !== expectedDirectory || !fs.existsSync(expectedDirectory)) {
    throw new Error("Traceability directory is missing");
  }
  const directoryStats = fs.lstatSync(expectedDirectory, { bigint: true });
  const realRoot = fs.realpathSync(rootDir);
  const realDirectory = fs.realpathSync(expectedDirectory);
  if (
    directoryStats.isSymbolicLink()
    || !directoryStats.isDirectory()
    || !isInside(realRoot, realDirectory)
  ) {
    throw new Error("Traceability directory must be a repository directory");
  }
  const entries = fs.readdirSync(expectedDirectory, { withFileTypes: true });
  const jsonEntries = entries.filter((entry) => entry.name.endsWith(".json"));
  if (jsonEntries.some((entry) => !entry.isFile() || entry.isSymbolicLink())) {
    throw new Error("Traceability manifests must be regular files");
  }
  const files = jsonEntries.map((entry) => entry.name).sort();
  if (files.length === 0) throw new Error("Traceability directory must contain a manifest");
  let requirements = 0;
  let acceptanceCriteria = 0;
  const planIds = [];
  for (const fileName of files) {
    const input = JSON.parse(
      readRepositoryRegularFile(
        rootDir,
        path.join(expectedDirectory, fileName),
        "Traceability manifest",
      ).toString("utf8").replace(/^\uFEFF/, ""),
    );
    const summary = validateTraceabilityManifest(input, { rootDir, fileName });
    requirements += summary.requirements;
    acceptanceCriteria += summary.acceptanceCriteria;
    planIds.push(summary.planId);
  }
  return { manifests: files.length, requirements, acceptanceCriteria, planIds };
}
