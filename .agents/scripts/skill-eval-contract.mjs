import fs from "node:fs";
import path from "node:path";

const CASE_KINDS = new Set(["should_trigger", "should_not_trigger"]);
const ABSOLUTE_PATH_PATTERN = /(?:[A-Za-z]:[\\/]|\/(?:Users|home|tmp)\/)/;
const SECRET_PATTERN = /(?:sk-[A-Za-z0-9]{16,}|gh[pousr]_[A-Za-z0-9]{16,}|Bearer\s+[A-Za-z0-9._-]{12,})/i;

const requireObject = (value, label) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
};

const requireString = (value, label, { min = 1, max = 1_000 } = {}) => {
  if (typeof value !== "string" || value.trim().length < min || value.length > max) {
    throw new Error(`${label} must be a string between ${min} and ${max} characters`);
  }
};

const rejectSensitiveText = (value, label) => {
  if (ABSOLUTE_PATH_PATTERN.test(value)) throw new Error(`${label} contains an absolute path`);
  if (SECRET_PATTERN.test(value)) throw new Error(`${label} contains secret-like data`);
};

export function validateSkillEvalCorpus(input, { knownSkills, fileName } = {}) {
  requireObject(input, "Skill eval corpus");
  if (input.schemaVersion !== 1) throw new Error("Skill eval corpus must use schemaVersion 1");
  requireString(input.skill, "skill", { max: 80 });
  if (!/^[a-z][a-z0-9-]*$/.test(input.skill)) throw new Error("skill must use kebab-case");
  if (knownSkills && !knownSkills.has(input.skill)) {
    throw new Error(`Unknown target skill: ${input.skill}`);
  }
  if (fileName && fileName !== `${input.skill}.json`) {
    throw new Error(`${fileName}: filename must match skill ${input.skill}`);
  }
  if (!Array.isArray(input.cases) || input.cases.length < 4) {
    throw new Error(`${input.skill}: cases must contain at least four scenarios`);
  }

  const ids = new Set();
  const kinds = new Map();
  for (const [index, evalCase] of input.cases.entries()) {
    const label = `${input.skill}.cases[${index}]`;
    requireObject(evalCase, label);
    requireString(evalCase.id, `${label}.id`, { max: 100 });
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(evalCase.id)) {
      throw new Error(`${label}.id must use kebab-case`);
    }
    if (ids.has(evalCase.id)) throw new Error(`${input.skill}: duplicate case id ${evalCase.id}`);
    ids.add(evalCase.id);
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
  for (const fileName of files) {
    const filePath = path.join(rootDir, fileName);
    const corpus = JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
    validateSkillEvalCorpus(corpus, { knownSkills, fileName });
    cases += corpus.cases.length;
  }
  return { corpora: files.length, cases };
}
