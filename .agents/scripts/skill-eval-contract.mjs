import fs from "node:fs";
import path from "node:path";
import { findPrivacyTypes } from "../../scripts/lib/docs-privacy.mjs";
import { isCanonicalRepositoryRelativePath } from "../../scripts/lib/repository-path.mjs";
import { hasSecretLikeText } from "../../scripts/lib/sensitive-text.mjs";

const CASE_KINDS = new Set(["should_trigger", "should_not_trigger"]);
const ABSOLUTE_PATH_PATTERN =
  /(?<![A-Za-z0-9+.-])(?:[A-Za-z]:[\\/]|\/(?:Users|home|tmp)\/)/;
const POSIX_LOCAL_PATH_PATTERN =
  /(?<![A-Za-z0-9._~:/%-])\/(?:boot|dev|etc|home|media|mnt|opt|private|proc|root|run|srv|sys|tmp|usr|var|workspaces?)(?:\/[^\s`"'<>|)]*)?/i;

export const REQUIRED_SKILL_EVAL_BASELINE = Object.freeze({
  "ai-chat-system": 4,
  "code-review": 6,
  debugging: 4,
  "feature-spec": 6,
  "impact-check": 6,
  "plan-template": 6,
  qa: 6,
  "schema-change": 6,
  "skill-radar": 4,
  "ui-quality": 4,
});

const requireObject = (value, label) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
};

const closedObject = (value, allowedFields, label) => {
  requireObject(value, label);
  for (const field of Object.keys(value)) {
    if (!allowedFields.includes(field)) {
      throw new Error(`${label} contains an unsupported field`);
    }
  }
};

const requireString = (value, label, { min = 1, max = 1_000 } = {}) => {
  if (typeof value !== "string" || value.trim().length < min || value.length > max) {
    throw new Error(`${label} must be a string between ${min} and ${max} characters`);
  }
};

const rejectSensitiveText = (value, label) => {
  if (ABSOLUTE_PATH_PATTERN.test(value) || POSIX_LOCAL_PATH_PATTERN.test(value)) {
    throw new Error(`${label} contains an absolute path`);
  }
  if (hasSecretLikeText(value)) throw new Error(`${label} contains secret-like data`);
  if (findPrivacyTypes(value).length > 0) {
    throw new Error(`${label} contains personal data`);
  }
};

const validateEvalFileName = (fileName) => {
  if (
    !isCanonicalRepositoryRelativePath(fileName)
    || fileName.includes("/")
  ) {
    throw new Error("Eval corpus filename is invalid");
  }
  rejectSensitiveText(fileName, "Eval corpus filename");
  return fileName;
};

export function validateSkillEvalCorpus(input, { knownSkills, fileName } = {}) {
  if (fileName !== undefined) {
    validateEvalFileName(fileName);
  }
  closedObject(input, ["schemaVersion", "skill", "cases"], "Skill eval corpus");
  if (input.schemaVersion !== 1) throw new Error("Skill eval corpus must use schemaVersion 1");
  requireString(input.skill, "skill", { max: 80 });
  rejectSensitiveText(input.skill, "skill");
  if (!/^[a-z][a-z0-9-]*$/.test(input.skill)) throw new Error("skill must use kebab-case");
  if (knownSkills && !knownSkills.has(input.skill)) {
    throw new Error(`Unknown target skill: ${input.skill}`);
  }
  if (fileName && fileName !== `${input.skill}.json`) {
    throw new Error("Eval corpus filename must match skill");
  }
  if (!Array.isArray(input.cases) || input.cases.length < 4) {
    throw new Error(`${input.skill}: cases must contain at least four scenarios`);
  }

  const ids = new Set();
  const kinds = new Map();
  for (const [index, evalCase] of input.cases.entries()) {
    const label = `${input.skill}.cases[${index}]`;
    closedObject(evalCase, ["id", "kind", "prompt", "expectedEvidence"], label);
    requireString(evalCase.id, `${label}.id`, { max: 100 });
    rejectSensitiveText(evalCase.id, `${label}.id`);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(evalCase.id)) {
      throw new Error(`${label}.id must use kebab-case`);
    }
    if (ids.has(evalCase.id)) throw new Error(`${input.skill}: duplicate case id ${evalCase.id}`);
    ids.add(evalCase.id);
    requireString(evalCase.kind, `${label}.kind`, { max: 40 });
    rejectSensitiveText(evalCase.kind, `${label}.kind`);
    if (!CASE_KINDS.has(evalCase.kind)) throw new Error(`${label}.kind is invalid`);
    kinds.set(evalCase.kind, (kinds.get(evalCase.kind) || 0) + 1);
    requireString(evalCase.prompt, `${label}.prompt`, { min: 12, max: 1_000 });
    rejectSensitiveText(evalCase.prompt, `${label}.prompt`);
    if (!Array.isArray(evalCase.expectedEvidence) || evalCase.expectedEvidence.length === 0) {
      throw new Error(`${label}.expectedEvidence must not be empty`);
    }
    for (const [evidenceIndex, evidence] of evalCase.expectedEvidence.entries()) {
      const evidenceLabel = `${label}.expectedEvidence[${evidenceIndex}]`;
      requireString(evidence, evidenceLabel, { min: 8, max: 240 });
      rejectSensitiveText(evidence, evidenceLabel);
    }
  }

  for (const kind of CASE_KINDS) {
    if ((kinds.get(kind) || 0) < 2) {
      throw new Error(`${input.skill}: requires at least two ${kind} cases`);
    }
  }
  return input;
}

export function validateSkillEvalDirectory({ rootDir, skillsRoot }) {
  const knownSkills = new Set(
    fs.readdirSync(skillsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name),
  );
  const files = fs.readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort();
  if (files.length === 0) throw new Error("Skill eval directory must contain JSON corpora");

  let cases = 0;
  const casesBySkill = new Map();
  for (const fileName of files) {
    validateEvalFileName(fileName);
    const filePath = path.join(rootDir, fileName);
    const corpus = JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
    validateSkillEvalCorpus(corpus, { knownSkills, fileName });
    cases += corpus.cases.length;
    casesBySkill.set(corpus.skill, corpus.cases.length);
  }
  for (const [skill, minimumCases] of Object.entries(REQUIRED_SKILL_EVAL_BASELINE)) {
    if (!casesBySkill.has(skill)) {
      throw new Error(`Required baseline corpus ${skill} is missing`);
    }
    if (casesBySkill.get(skill) < minimumCases) {
      throw new Error(
        `Required baseline corpus ${skill} requires at least ${minimumCases} scenarios`,
      );
    }
  }
  return { corpora: files.length, cases };
}
