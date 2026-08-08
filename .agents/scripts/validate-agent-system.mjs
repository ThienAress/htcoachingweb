#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateWatchlist } from "./skill-radar-contract.mjs";
import { validateSkillEvalDirectory } from "./skill-eval-contract.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "../..");
const AGENTS_ROOT = path.join(ROOT, ".agents");
const SKILLS_ROOT = path.join(AGENTS_ROOT, "skills");
const SKILL_EVAL_ROOT = path.join(AGENTS_ROOT, "evals", "skills");
const RULES_ROOT = path.join(AGENTS_ROOT, "rules");
const WORKFLOW_MAP = path.join(AGENTS_ROOT, "reference", "agent-workflow-map.md");
const UPSTREAM_WATCHLIST = path.join(AGENTS_ROOT, "upstream-skills", "watchlist.json");

let errors = 0;
let warnings = 0;

const relative = (filePath) => path.relative(ROOT, filePath).replaceAll("\\", "/");
const readText = (filePath) => fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function fail(message) {
  console.error(`  ❌ ${message}`);
  errors += 1;
}

function warn(message) {
  console.warn(`  ⚠️  ${message}`);
  warnings += 1;
}

function pass(message) {
  console.log(`  ✅ ${message}`);
}

function listFiles(directory, predicate = () => true) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(fullPath, predicate);
    return predicate(fullPath) ? [fullPath] : [];
  });
}

function countFiles(directory, matcher) {
  if (!fs.existsSync(directory)) return 0;
  return listFiles(directory, (filePath) => matcher.test(filePath)).length;
}

function countDirectFiles(directory, matcher) {
  if (!fs.existsSync(directory)) return 0;
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && matcher.test(entry.name)).length;
}

function getYamlSection(content, sectionName) {
  const lines = content.split(/\r?\n/);
  const sectionPattern = new RegExp(`^${escapeRegExp(sectionName)}:\\s*(?:#.*)?$`);
  const start = lines.findIndex((line) => sectionPattern.test(line));
  if (start === -1) return null;

  const sectionLines = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^\S/.test(line)) break;
    sectionLines.push(line);
  }
  return sectionLines.join("\n");
}

function decodeYamlScalar(rawValue) {
  const value = rawValue.trim();
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replaceAll("''", "'");
  }
  return value.replace(/\s+#.*$/, "").trim();
}

function getYamlField(section, fieldName) {
  if (section === null) return null;
  const fieldPattern = new RegExp(`^\\s+${escapeRegExp(fieldName)}:\\s*(.*?)\\s*$`, "m");
  const match = section.match(fieldPattern);
  if (!match) return null;
  return { raw: match[1].trim(), value: decodeYamlScalar(match[1]) };
}

function isQuotedYamlScalar(rawValue) {
  return (
    (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
    (rawValue.startsWith("'") && rawValue.endsWith("'"))
  );
}

function hasExactSkillToken(content, skillName) {
  const pattern = new RegExp(`(?:^|[^A-Za-z0-9_-])\\$${escapeRegExp(skillName)}(?![A-Za-z0-9_-])`);
  return pattern.test(content);
}

function lineNumberAt(content, index) {
  return content.slice(0, index).split(/\r?\n/).length;
}

console.log("\n🔍 Agent Instruction Validation");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

const requiredPaths = [
  "AGENTS.md",
  ".agents/reference/project-guide.md",
  ".agents/reference/agent-workflow-map.md",
  ".agents/rules/workflow/task-orchestration.md",
  ".agents/rules/security/security.md",
  ".agents/rules/seo/seo.md",
  ".agents/skills/known-issues/SKILL.md",
  ".agents/skills/audit-playbook/SKILL.md",
];

console.log("📁 Required instruction files");
for (const item of requiredPaths) {
  const target = path.join(ROOT, item);
  if (fs.existsSync(target)) pass(item);
  else fail(`Missing required file: ${item}`);
}

console.log("\n🧩 Skill metadata");
const skillDirectories = fs
  .readdirSync(SKILLS_ROOT, { withFileTypes: true })
  .filter((entry) => entry.isDirectory());
const skillNames = new Set(skillDirectories.map((directory) => directory.name));
const implicitInvocationBySkill = new Map();

for (const directory of skillDirectories) {
  const metadataPath = path.join(SKILLS_ROOT, directory.name, "agents", "openai.yaml");
  if (!fs.existsSync(metadataPath)) {
    fail(`${directory.name}: missing agents/openai.yaml`);
  } else {
    const metadata = readText(metadataPath);
    const interfaceSection = getYamlSection(metadata, "interface");
    const policySection = getYamlSection(metadata, "policy");
    const displayName = getYamlField(interfaceSection, "display_name");
    const shortDescription = getYamlField(interfaceSection, "short_description");
    const defaultPrompt = getYamlField(interfaceSection, "default_prompt");
    const allowImplicitInvocation = getYamlField(policySection, "allow_implicit_invocation");

    if (
      !displayName ||
      !isQuotedYamlScalar(displayName.raw) ||
      typeof displayName.value !== "string" ||
      displayName.value.trim().length === 0
    ) {
      fail(`${relative(metadataPath)}: interface.display_name must be a non-empty quoted string`);
    }

    if (
      !shortDescription ||
      !isQuotedYamlScalar(shortDescription.raw) ||
      typeof shortDescription.value !== "string"
    ) {
      fail(`${relative(metadataPath)}: interface.short_description must be a quoted string`);
    } else {
      const descriptionLength = [...shortDescription.value.trim()].length;
      if (descriptionLength < 25 || descriptionLength > 64) {
        fail(
          `${relative(metadataPath)}: interface.short_description must be 25-64 characters ` +
            `(found ${descriptionLength})`,
        );
      }
    }

    if (
      !defaultPrompt ||
      !isQuotedYamlScalar(defaultPrompt.raw) ||
      typeof defaultPrompt.value !== "string"
    ) {
      fail(`${relative(metadataPath)}: interface.default_prompt must be a quoted string`);
    } else if (!hasExactSkillToken(defaultPrompt.value, directory.name)) {
      fail(`${relative(metadataPath)}: interface.default_prompt must contain exact token $${directory.name}`);
    }

    if (!allowImplicitInvocation || !/^(?:true|false)$/.test(allowImplicitInvocation.raw)) {
      fail(`${relative(metadataPath)}: policy.allow_implicit_invocation must be an explicit boolean`);
    } else {
      implicitInvocationBySkill.set(directory.name, allowImplicitInvocation.raw === "true");
    }
  }

  const skillPath = path.join(SKILLS_ROOT, directory.name, "SKILL.md");
  if (!fs.existsSync(skillPath)) {
    fail(`${directory.name}: missing SKILL.md`);
    continue;
  }

  const content = readText(skillPath);
  if (/\[\s*TODO\b/i.test(content)) {
    fail(`${relative(skillPath)}: unresolved TODO placeholder`);
  }

  const frontmatter = content.match(/^---\r?\nname:\s*([^\r\n]+)\r?\ndescription:\s*([^\r\n]+)\r?\n---/);
  if (!frontmatter) {
    fail(`${relative(skillPath)}: invalid name/description frontmatter`);
    continue;
  }

  if (frontmatter[1].trim() !== directory.name) {
    fail(`${relative(skillPath)}: name must match directory "${directory.name}"`);
  }

  const lineCount = content.split(/\r?\n/).length;
  if (lineCount > 500) fail(`${relative(skillPath)}: ${lineCount} lines exceeds 500-line skill limit`);
}
pass(`${skillDirectories.length} skill directories checked`);

console.log("\n🧪 Skill evaluation corpora");
try {
  const summary = validateSkillEvalDirectory({
    rootDir: SKILL_EVAL_ROOT,
    skillsRoot: SKILLS_ROOT,
  });
  pass(`${summary.corpora} corpora / ${summary.cases} scenarios checked`);
} catch (error) {
  fail(`Invalid skill eval catalog: ${error.message}`);
}

console.log("\n📡 Upstream skill watchlist");
try {
  const watchlist = validateWatchlist(JSON.parse(readText(UPSTREAM_WATCHLIST)));
  for (const entry of watchlist.entries) {
    for (const localTarget of entry.localTargets) {
      const resolved = path.resolve(ROOT, localTarget);
      if (!resolved.startsWith(`${ROOT}${path.sep}`) || !fs.existsSync(resolved)) {
        fail(`${entry.id}: missing or unsafe local target ${localTarget}`);
      }
    }
  }
  pass(`${watchlist.entries.length} upstream skills checked`);
} catch (error) {
  fail(`Invalid upstream watchlist: ${error.message}`);
}

console.log("\n📜 Rule metadata");
const ruleFiles = listFiles(RULES_ROOT, (filePath) => filePath.endsWith(".md"));
for (const rulePath of ruleFiles) {
  const content = readText(rulePath);
  if (!/^---\r?\nname:\s*[^\r\n]+\r?\ndescription:\s*[^\r\n]+\r?\n---/.test(content)) {
    fail(`${relative(rulePath)}: invalid name/description frontmatter`);
  }
}
pass(`${ruleFiles.length} rule files checked`);

const markdownFiles = [path.join(ROOT, "AGENTS.md"), ...listFiles(AGENTS_ROOT, (file) => file.endsWith(".md"))];

console.log("\n🧭 Skill references and workflow map");
const instructionFiles = listFiles(AGENTS_ROOT, (filePath) => /\.(?:md|ya?ml)$/i.test(filePath));
const ignoredDollarReferences = new Set(["skill-name"]);
const dollarReferencePattern = /\$([a-z][a-z0-9]*(?:-[a-z0-9]+)*)\b/g;
const backtickReferencePattern = /`([a-z][a-z0-9]*(?:-[a-z0-9]+)*)`/g;

for (const filePath of instructionFiles) {
  const content = readText(filePath);
  for (const match of content.matchAll(dollarReferencePattern)) {
    const skillName = match[1];
    if (skillNames.has(skillName) || ignoredDollarReferences.has(skillName)) continue;
    fail(`${relative(filePath)}:${lineNumberAt(content, match.index)}: dangling $${skillName} skill reference`);
  }

  for (const match of content.matchAll(backtickReferencePattern)) {
    const skillName = match[1];
    if (skillNames.has(skillName)) continue;
    const lineStart = content.lastIndexOf("\n", match.index) + 1;
    const nextLineBreak = content.indexOf("\n", match.index);
    const lineEnd = nextLineBreak === -1 ? content.length : nextLineBreak;
    const nearbyStart = Math.max(lineStart, match.index - 48);
    const nearbyEnd = Math.min(lineEnd, match.index + match[0].length + 48);
    const nearbyContext = content.slice(nearbyStart, nearbyEnd);
    if (!/(?:\bskills?\b|\bworkflows?\b|kỹ năng)/iu.test(nearbyContext)) continue;
    fail(`${relative(filePath)}:${lineNumberAt(content, match.index)}: dangling \`${skillName}\` skill reference`);
  }
}

if (fs.existsSync(WORKFLOW_MAP)) {
  const workflowMap = readText(WORKFLOW_MAP);
  const mappedSkills = new Set();
  const invocationBySkill = new Map();

  for (const match of workflowMap.matchAll(dollarReferencePattern)) {
    if (skillNames.has(match[1])) mappedSkills.add(match[1]);
  }
  for (const match of workflowMap.matchAll(backtickReferencePattern)) {
    if (skillNames.has(match[1])) mappedSkills.add(match[1]);
  }
  for (const match of workflowMap.matchAll(/(?:^|[\\/])skills[\\/]([a-z][a-z0-9-]*)(?:[\\/]|$)/gm)) {
    if (skillNames.has(match[1])) mappedSkills.add(match[1]);
  }
  for (const match of workflowMap.matchAll(/^\|\s*`\$([a-z][a-z0-9-]*)`\s*\|\s*(user|model)\s*\|/gm)) {
    if (invocationBySkill.has(match[1])) {
      fail(`${relative(WORKFLOW_MAP)}: duplicate invocation row for skill ${match[1]}`);
    }
    invocationBySkill.set(match[1], match[2]);
  }

  if (mappedSkills.size === 0) {
    warn(`${relative(WORKFLOW_MAP)}: router coverage could not be parsed`);
  } else {
    const missingMappedSkills = [];
    for (const skillName of skillNames) {
      if (!mappedSkills.has(skillName)) {
        missingMappedSkills.push(skillName);
        fail(`${relative(WORKFLOW_MAP)}: router does not cover skill ${skillName}`);
      }
    }
    if (missingMappedSkills.length === 0) {
      pass(`${mappedSkills.size}/${skillNames.size} skills covered by workflow map`);
    }
  }

  for (const skillName of skillNames) {
    const invocation = invocationBySkill.get(skillName);
    if (!invocation) {
      fail(`${relative(WORKFLOW_MAP)}: missing invocation row for skill ${skillName}`);
      continue;
    }
    const allowImplicit = implicitInvocationBySkill.get(skillName);
    const expectedAllowImplicit = invocation === "model";
    if (allowImplicit !== expectedAllowImplicit) {
      fail(
        `${relative(WORKFLOW_MAP)}: ${skillName} is ${invocation} but metadata ` +
          `allow_implicit_invocation is ${String(allowImplicit)}`,
      );
    }
  }
}

console.log("\n🔗 Relative Markdown links");
let checkedLinks = 0;
for (const markdownFile of markdownFiles) {
  const content = readText(markdownFile);
  const links = content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g);
  for (const match of links) {
    const rawTarget = match[1].trim().replace(/^<|>$/g, "");
    if (!rawTarget.startsWith("./") && !rawTarget.startsWith("../")) continue;
    const withoutAnchor = rawTarget.split("#")[0];
    if (!withoutAnchor) continue;
    checkedLinks += 1;
    const resolved = path.resolve(path.dirname(markdownFile), withoutAnchor);
    if (!fs.existsSync(resolved)) {
      fail(`${relative(markdownFile)}: broken link ${rawTarget}`);
    }
  }
}
pass(`${checkedLinks} relative Markdown links checked`);

console.log("\n🧹 Deprecated instruction references");
const deprecatedPatterns = [
  { regex: /\.\.\$audit-playbook\/SKILL\.md/g, label: "malformed audit-playbook path" },
  { regex: /(?:skills\/)?known_issues\.md/g, label: "legacy known_issues.md path" },
  { regex: /\.agents\/skills\/ai-chat-system\.md/g, label: "legacy ai-chat-system.md path" },
  { regex: /(?<![\w/-])tdd\.md(?![\w/-])/g, label: "legacy tdd.md path" },
  { regex: /(?<![\w/-])audit-playbook\.md(?![\w/-])/g, label: "legacy audit-playbook.md path" },
  { regex: /Decode JWT (?:tại|at) jwt\.io/gi, label: "external JWT decoding guidance" },
  { regex: /console\.log\([^\n]*req\.body/g, label: "raw request-body debug logging" },
];

for (const filePath of markdownFiles) {
  const content = readText(filePath);
  for (const pattern of deprecatedPatterns) {
    pattern.regex.lastIndex = 0;
    if (pattern.regex.test(content)) fail(`${relative(filePath)}: ${pattern.label}`);
  }
}
if (errors === 0) pass("No deprecated instruction references found");

console.log("\n📊 Drift-prone snapshots");
const snapshotPatterns = [
  /Test Files Hiện Tại \(\d+ files\)/,
  /có \d+ models và \d+ controllers/,
  /Request handlers \(\d+ controllers\)/,
  /Mongoose schemas \(\d+ models\)/,
  /Express routers \(\d+ route files\)/,
  /API call functions \(\d+ service files\)/,
  /admin\/[^\n]*\d+\+? admin pages/,
  /tools\/ \(\d+ tools\)/,
];
for (const filePath of markdownFiles) {
  const content = readText(filePath);
  for (const pattern of snapshotPatterns) {
    if (pattern.test(content)) fail(`${relative(filePath)}: hardcoded count should be generated from repo`);
  }
}

const inventory = {
  skills: skillDirectories.length,
  clientTests: countFiles(path.join(ROOT, "client", "src"), /\.(test|spec)\.(js|jsx|ts|tsx)$/),
  serverTests: countFiles(path.join(ROOT, "server", "src"), /\.(test|spec)\.(js|jsx|ts|tsx)$/),
  e2eTests: countFiles(path.join(ROOT, "e2e"), /\.(test|spec)\.(js|jsx|ts|tsx)$/),
  models: countDirectFiles(path.join(ROOT, "server", "src", "models"), /\.js$/),
  controllers: countDirectFiles(path.join(ROOT, "server", "src", "controllers"), /\.js$/),
  routes: countDirectFiles(path.join(ROOT, "server", "src", "routes"), /\.js$/),
};
console.log(`  ℹ️  Live inventory: ${JSON.stringify(inventory)}`);

console.log("\n🔎 Canonical contracts");
const homePage = readText(path.join(ROOT, "client", "src", "pages", "Home.jsx"));
const seoRule = readText(path.join(AGENTS_ROOT, "rules", "seo", "seo.md"));
const homeTypes = ["Organization", "ProfessionalService", "Service", "FAQPage"];
for (const type of homeTypes) {
  if (!homePage.includes(`"@type": "${type}"`)) fail(`Home.jsx missing JSON-LD type ${type}`);
  if (!seoRule.includes(type)) fail(`SEO rule missing Home JSON-LD type ${type}`);
}

const rootAgents = readText(path.join(ROOT, "AGENTS.md"));
if (!rootAgents.includes("task-orchestration.md")) fail("AGENTS.md does not route task orchestration rule");
if (!rootAgents.includes("npm run agents:validate")) fail("AGENTS.md does not list agent validation command");

const packageJson = JSON.parse(readText(path.join(ROOT, "package.json")));
if (packageJson.scripts?.["agents:validate"] !== "node .agents/scripts/validate-agent-system.mjs") {
  fail("package.json scripts.agents:validate is missing or incorrect");
}

const clientPackage = JSON.parse(readText(path.join(ROOT, "client", "package.json")));
const serverPackage = JSON.parse(readText(path.join(ROOT, "server", "package.json")));
const knownScripts = new Set([
  ...Object.keys(packageJson.scripts || {}),
  ...Object.keys(clientPackage.scripts || {}),
  ...Object.keys(serverPackage.scripts || {}),
]);
const referencedScripts = new Set();
for (const filePath of markdownFiles) {
  for (const match of readText(filePath).matchAll(/npm run ([A-Za-z0-9:_-]+)/g)) {
    referencedScripts.add(match[1]);
  }
}
for (const scriptName of referencedScripts) {
  if (!knownScripts.has(scriptName)) fail(`Instruction references missing npm script: ${scriptName}`);
}
pass(`${referencedScripts.size} referenced npm scripts checked`);

const ciWorkflow = readText(path.join(ROOT, ".github", "workflows", "ci.yml"));
if (!ciWorkflow.includes("npm run agents:validate")) fail("CI does not run agents:validate");

const preDeploy = readText(path.join(SKILLS_ROOT, "pre-deploy", "SKILL.md"));
if (!preDeploy.includes("npm run agents:validate")) fail("pre-deploy skill does not run agents:validate");

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
if (errors > 0) {
  console.error(`❌ FAIL — ${errors} error(s), ${warnings} warning(s)`);
  process.exit(1);
}

if (warnings > 0) {
  warn(`PASS WITH WARNINGS — ${warnings} warning(s)`);
} else {
  console.log(`✅ ALL PASS — ${skillDirectories.length} skills validated, 0 warnings`);
}
