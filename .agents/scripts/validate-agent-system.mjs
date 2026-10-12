#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkProjectInventory,
  collectProjectInventory,
} from "./project-inventory.mjs";
import {
  validatePlanStateFile,
  validatePlanTraceCoverage,
} from "./plan-state-contract.mjs";
import { validateWatchlist } from "./skill-radar-contract.mjs";
import { validateSkillEvalDirectory } from "./skill-eval-contract.mjs";
import { validateTraceabilityDirectory } from "./traceability-contract.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "../..");
const CLAUDE_MD = path.join(ROOT, "CLAUDE.md");
const CLAUDE_ROOT = path.join(ROOT, ".claude");
const SKILLS_ROOT = path.join(CLAUDE_ROOT, "skills");
const RULES_ROOT = path.join(CLAUDE_ROOT, "rules");
const AGENTS_DIR = path.join(CLAUDE_ROOT, "agents");
const SETTINGS = path.join(CLAUDE_ROOT, "settings.json");
const SKILL_EVAL_ROOT = path.join(ROOT, ".agents", "evals", "skills");
const PROJECT_INVENTORY = path.join(ROOT, ".agents", "reference", "project-inventory.json");
const UPSTREAM_WATCHLIST = path.join(ROOT, ".agents", "upstream-skills", "watchlist.json");
const PLAN_STATE = path.join(ROOT, "docs", "plans", "plan-state.json");
const TRACEABILITY_ROOT = path.join(ROOT, "docs", "plans", "traceability");

const CLAUDE_MD_MAX_LINES = 200;
const SKILL_MAX_LINES = 500;
const DESCRIPTION_MAX_CHARS = 1024;

let errors = 0;
let warnings = 0;

const relative = (filePath) => path.relative(ROOT, filePath).replaceAll("\\", "/");
const readText = (filePath) => fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
const lineCount = (content) => content.split(/\r?\n/).length;

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
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === "worktrees" ? [] : listFiles(fullPath, predicate);
    return predicate(fullPath) ? [fullPath] : [];
  });
}

function lineNumberAt(content, index) {
  return content.slice(0, index).split(/\r?\n/).length;
}

// Parse simple YAML frontmatter: scalar `key: value` and `key:` followed by `- item` lists.
export function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return null;
  const fields = {};
  let listKey = null;
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const item = line.match(/^\s+-\s+(.*)$/);
    if (item && listKey) {
      fields[listKey].push(item[1].trim().replace(/^["']|["']$/g, ""));
      continue;
    }
    const pair = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (!pair) return { invalidLine: line };
    const [, key, rawValue] = pair;
    if (rawValue === "") {
      fields[key] = [];
      listKey = key;
    } else {
      fields[key] = rawValue.trim().replace(/^"([\s\S]*)"$/, "$1").replace(/^'([\s\S]*)'$/, "$1");
      listKey = null;
    }
  }
  return { fields };
}

console.log("\n🔍 Claude Code configuration validation");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

const requiredPaths = [
  "CLAUDE.md",
  "CONTEXT.md",
  ".claude/settings.json",
  ".claude/hooks/guard.mjs",
  ".claude/rules/security.md",
  ".claude/rules/seo.md",
  ".claude/rules/known-issues.md",
  ".claude/rules/release-promotion.md",
  ".claude/agents/security-reviewer.md",
  ".agents/reference/project-inventory.json",
  "docs/plans/plan-state.json",
  "docs/plans/traceability",
];

console.log("📁 Required files");
for (const item of requiredPaths) {
  if (fs.existsSync(path.join(ROOT, item))) pass(item);
  else fail(`Missing required file: ${item}`);
}

const legacyPaths = ["AGENTS.md", ".agents/skills", ".agents/rules", ".codex"];
for (const item of legacyPaths) {
  if (fs.existsSync(path.join(ROOT, item))) fail(`Legacy Codex path must not return: ${item}`);
}

console.log("\n📏 CLAUDE.md budget");
const claudeMd = fs.existsSync(CLAUDE_MD) ? readText(CLAUDE_MD) : "";
const claudeMdLines = lineCount(claudeMd);
if (claudeMdLines > CLAUDE_MD_MAX_LINES) {
  fail(`CLAUDE.md has ${claudeMdLines} lines; keep it under ${CLAUDE_MD_MAX_LINES} and move detail into rules/skills`);
} else {
  pass(`CLAUDE.md ${claudeMdLines}/${CLAUDE_MD_MAX_LINES} lines`);
}

console.log("\n🧩 Skills");
const skillDirectories = fs.existsSync(SKILLS_ROOT)
  ? fs.readdirSync(SKILLS_ROOT, { withFileTypes: true }).filter((entry) => entry.isDirectory())
  : [];
const skillNames = new Set(skillDirectories.map((directory) => directory.name));
const userOnlySkills = new Set();

for (const directory of skillDirectories) {
  const skillPath = path.join(SKILLS_ROOT, directory.name, "SKILL.md");
  if (!fs.existsSync(skillPath)) {
    fail(`${directory.name}: missing SKILL.md`);
    continue;
  }
  const content = readText(skillPath);
  const frontmatter = parseFrontmatter(content);
  if (!frontmatter || frontmatter.invalidLine !== undefined) {
    fail(`${relative(skillPath)}: invalid frontmatter`);
    continue;
  }
  const { name, description } = frontmatter.fields;
  if (name !== directory.name) fail(`${relative(skillPath)}: name must match directory "${directory.name}"`);
  if (typeof description !== "string" || description.trim().length < 40) {
    fail(`${relative(skillPath)}: description must say what the skill does and when to use it`);
  } else if ([...description].length > DESCRIPTION_MAX_CHARS) {
    fail(`${relative(skillPath)}: description exceeds ${DESCRIPTION_MAX_CHARS} characters`);
  }
  const disable = frontmatter.fields["disable-model-invocation"];
  if (disable !== undefined && !["true", "false"].includes(disable)) {
    fail(`${relative(skillPath)}: disable-model-invocation must be true or false`);
  }
  if (disable === "true") userOnlySkills.add(directory.name);
  if (/\[\s*TODO\b/i.test(content)) fail(`${relative(skillPath)}: unresolved TODO placeholder`);
  if (lineCount(content) > SKILL_MAX_LINES) {
    fail(`${relative(skillPath)}: ${lineCount(content)} lines exceeds ${SKILL_MAX_LINES}-line skill limit`);
  }
  for (const leftover of listFiles(path.join(SKILLS_ROOT, directory.name), (file) => /openai\.ya?ml$/i.test(file))) {
    fail(`${relative(leftover)}: Codex metadata is not used by Claude Code`);
  }
}
pass(`${skillDirectories.length} skills checked (${userOnlySkills.size} user-invoked only)`);

const userOnlyLine = claudeMd.split(/\r?\n/).findIndex((line) => /Chỉ chạy khi user gọi:/.test(line));
if (userOnlyLine === -1) {
  fail("CLAUDE.md must list user-invoked skills after 'Chỉ chạy khi user gọi:'");
} else {
  const block = claudeMd.split(/\r?\n/).slice(userOnlyLine, userOnlyLine + 3).join(" ");
  const listed = new Set([...block.matchAll(/`\/([a-z][a-z0-9-]*)`/g)].map((match) => match[1]));
  for (const skill of userOnlySkills) {
    if (!listed.has(skill)) fail(`CLAUDE.md does not list user-invoked skill /${skill}`);
  }
  for (const skill of listed) {
    if (!userOnlySkills.has(skill)) fail(`CLAUDE.md lists /${skill} as user-invoked but its SKILL.md does not disable model invocation`);
  }
  pass(`${listed.size} user-invoked skills match CLAUDE.md`);
}

console.log("\n📜 Rules");
const ruleFiles = listFiles(RULES_ROOT, (filePath) => filePath.endsWith(".md"));
for (const rulePath of ruleFiles) {
  const content = readText(rulePath);
  if (!content.startsWith("---")) continue;
  const frontmatter = parseFrontmatter(content);
  if (!frontmatter || frontmatter.invalidLine !== undefined) {
    fail(`${relative(rulePath)}: invalid frontmatter`);
    continue;
  }
  const { paths } = frontmatter.fields;
  if (!Array.isArray(paths) || paths.length === 0) {
    fail(`${relative(rulePath)}: frontmatter must declare a non-empty paths list`);
    continue;
  }
  const unknownKeys = Object.keys(frontmatter.fields).filter((key) => key !== "paths");
  if (unknownKeys.length > 0) fail(`${relative(rulePath)}: unsupported frontmatter keys ${unknownKeys.join(", ")}`);
}
pass(`${ruleFiles.length} rule files checked`);

console.log("\n🤖 Subagents");
const agentFiles = listFiles(AGENTS_DIR, (filePath) => filePath.endsWith(".md"));
for (const agentPath of agentFiles) {
  const frontmatter = parseFrontmatter(readText(agentPath));
  const expectedName = path.basename(agentPath, ".md");
  if (!frontmatter || frontmatter.invalidLine !== undefined) {
    fail(`${relative(agentPath)}: invalid frontmatter`);
  } else if (frontmatter.fields.name !== expectedName || !frontmatter.fields.description) {
    fail(`${relative(agentPath)}: name must match file name and description is required`);
  }
}
pass(`${agentFiles.length} subagents checked`);

console.log("\n🪝 Settings and hooks");
try {
  const settings = JSON.parse(readText(SETTINGS));
  const hookCommands = (settings.hooks?.PreToolUse || []).flatMap((entry) => entry.hooks || []).map((hook) => hook.command || "");
  if (!hookCommands.some((command) => command.includes(".claude/hooks/guard.mjs"))) {
    fail(".claude/settings.json must register .claude/hooks/guard.mjs as a PreToolUse hook");
  } else {
    pass("PreToolUse guard hook registered");
  }
} catch (error) {
  fail(`.claude/settings.json is not valid JSON: ${error.message}`);
}

console.log("\n🧪 Skill evaluation corpora");
try {
  const summary = validateSkillEvalDirectory({ rootDir: SKILL_EVAL_ROOT, skillsRoot: SKILLS_ROOT });
  pass(`${summary.corpora} corpora / ${summary.cases} scenarios checked`);
} catch (error) {
  fail(`Invalid skill eval catalog: ${error.message}`);
}

console.log("\n📦 Generated project inventory");
try {
  const inventory = checkProjectInventory({ rootDir: ROOT, inventoryPath: PROJECT_INVENTORY });
  pass(`Inventory is current: ${JSON.stringify(inventory)}`);
} catch (error) {
  fail(error.message);
}

console.log("\n🗂️ Machine-readable plan state");
let planState = null;
try {
  planState = validatePlanStateFile({ rootDir: ROOT, manifestPath: PLAN_STATE });
  pass(`${planState.plans.length} post-cutoff plan state entries checked`);
} catch (error) {
  fail(`Invalid plan state: ${error.message}`);
}

console.log("\n🔗 Requirement traceability");
try {
  const summary = validateTraceabilityDirectory({ rootDir: ROOT, directory: TRACEABILITY_ROOT });
  pass(
    `${summary.manifests} manifests / ${summary.requirements} requirements / ` +
      `${summary.acceptanceCriteria} acceptance criteria checked`,
  );
  if (planState) {
    validatePlanTraceCoverage(planState, summary);
    pass("Plan complexity and traceability coverage agree");
  }
} catch (error) {
  fail(`Invalid traceability catalog: ${error.message}`);
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

const instructionFiles = [CLAUDE_MD, ...listFiles(CLAUDE_ROOT, (file) => file.endsWith(".md"))].filter((file) =>
  fs.existsSync(file),
);

console.log("\n🧭 Skill references");
const legacySkillToken = /(?<![\w$`])\$([a-z][a-z0-9]*(?:-[a-z0-9]+)+|qa|audit|ship|goad)\b/g;
const backtickReferencePattern = /`\/?([a-z][a-z0-9]*(?:-[a-z0-9]+)*)`/g;
for (const filePath of instructionFiles) {
  const content = readText(filePath);
  for (const match of content.matchAll(legacySkillToken)) {
    fail(`${relative(filePath)}:${lineNumberAt(content, match.index)}: legacy Codex skill syntax $${match[1]}; use /${match[1]} or the skill name`);
  }
  for (const match of content.matchAll(backtickReferencePattern)) {
    const skillName = match[1];
    if (skillNames.has(skillName)) continue;
    const lineStart = content.lastIndexOf("\n", match.index) + 1;
    const nextLineBreak = content.indexOf("\n", match.index);
    const lineEnd = nextLineBreak === -1 ? content.length : nextLineBreak;
    const nearby = content.slice(Math.max(lineStart, match.index - 32), Math.min(lineEnd, match.index + match[0].length + 32));
    if (!/(?:\bskills?\b|kỹ năng)/iu.test(nearby)) continue;
    if (["code-review", "security-review", "security-reviewer"].includes(skillName)) continue;
    fail(`${relative(filePath)}:${lineNumberAt(content, match.index)}: dangling \`${skillName}\` skill reference`);
  }
}
pass(`${instructionFiles.length} instruction files scanned`);

console.log("\n🗺️ Repository paths in instructions");
const PATH_ROOTS = "client|server|scripts|docs|e2e|workers|\\.claude|\\.agents|\\.github";
const pathPattern = new RegExp(`\`((?:${PATH_ROOTS})/[^\`\\s]+|CLAUDE\\.md|CONTEXT\\.md|SECURITY\\.md|package\\.json)\``, "g");
let checkedPaths = 0;
for (const filePath of instructionFiles) {
  const content = readText(filePath);
  for (const match of content.matchAll(pathPattern)) {
    const target = match[1].replace(/[),.:;]+$/, "");
    if (/[*<>{}$|]|NNN|YYYY|XX|\.\.\.|…/.test(target)) continue;
    if (/^client\/scripts\/\.generated\//.test(target)) continue;
    checkedPaths += 1;
    const resolved = path.resolve(ROOT, target);
    if (!fs.existsSync(resolved)) {
      fail(`${relative(filePath)}:${lineNumberAt(content, match.index)}: referenced path does not exist: ${target}`);
    }
  }
}
pass(`${checkedPaths} repository paths verified`);

console.log("\n🔗 Relative Markdown links");
let checkedLinks = 0;
for (const markdownFile of instructionFiles) {
  const content = readText(markdownFile);
  for (const match of content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const rawTarget = match[1].trim().replace(/^<|>$/g, "");
    if (/^[a-z][a-z0-9+.-]*:/i.test(rawTarget) || rawTarget.startsWith("#") || rawTarget.startsWith("/")) continue;
    const withoutAnchor = rawTarget.split("#")[0];
    if (!withoutAnchor) continue;
    checkedLinks += 1;
    const resolved = path.resolve(path.dirname(markdownFile), withoutAnchor);
    if (!fs.existsSync(resolved)) fail(`${relative(markdownFile)}: broken link ${rawTarget}`);
  }
}
pass(`${checkedLinks} relative Markdown links checked`);

console.log("\n🧹 Deprecated instruction references");
const deprecatedPatterns = [
  { regex: /\bAGENTS\.md\b/g, label: "AGENTS.md was replaced by CLAUDE.md" },
  { regex: /\.agents\/(?:skills|rules|reference\/(?:project-guide|agent-workflow-map))/g, label: "legacy .agents instruction path" },
  { regex: /codex-session-governor|session-governance\.md|task-orchestration\.md/g, label: "removed Codex session workflow" },
  { regex: /Decode JWT (?:tại|at) jwt\.io/gi, label: "external JWT decoding guidance" },
  { regex: /console\.log\([^\n]*req\.body/g, label: "raw request-body debug logging" },
];
const errorsBeforeDeprecated = errors;
for (const filePath of instructionFiles) {
  const content = readText(filePath);
  for (const pattern of deprecatedPatterns) {
    pattern.regex.lastIndex = 0;
    if (pattern.regex.test(content)) fail(`${relative(filePath)}: ${pattern.label}`);
  }
}
if (errors === errorsBeforeDeprecated) pass("No deprecated instruction references found");

console.log("\n📊 Drift-prone snapshots");
const snapshotPatterns = [
  /Test Files Hiện Tại \(\d+ files\)/,
  /Project có\s+\*{0,2}\d+\s+tests/iu,
  /có \d+ models và \d+ controllers/,
  /Request handlers \(\d+ controllers\)/,
  /Mongoose schemas \(\d+ models\)/,
  /Express routers \(\d+ route files\)/,
  /API call functions \(\d+ service files\)/,
  /admin\/[^\n]*\d+\+? admin pages/,
  /tools\/ \(\d+ tools\)/,
];
for (const filePath of instructionFiles) {
  const content = readText(filePath);
  for (const pattern of snapshotPatterns) {
    if (pattern.test(content)) fail(`${relative(filePath)}: hardcoded count should be generated from repo`);
  }
}
console.log(`  ℹ️  Live inventory: ${JSON.stringify(collectProjectInventory(ROOT))}`);

console.log("\n🔎 Canonical contracts");
const homePage = readText(path.join(ROOT, "client", "src", "pages", "Home.jsx"));
const seoRule = readText(path.join(RULES_ROOT, "seo.md"));
for (const type of ["Organization", "ProfessionalService", "Service", "FAQPage"]) {
  if (!homePage.includes(`"@type": "${type}"`)) fail(`Home.jsx missing JSON-LD type ${type}`);
  if (!seoRule.includes(type)) fail(`SEO rule missing Home JSON-LD type ${type}`);
}

if (!claudeMd.includes("npm run agents:validate")) fail("CLAUDE.md does not list agent validation command");

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
for (const filePath of instructionFiles) {
  for (const match of readText(filePath).matchAll(/npm(?:\.cmd)? run ([A-Za-z0-9:_-]+)/g)) {
    referencedScripts.add(match[1]);
  }
}
for (const scriptName of referencedScripts) {
  if (!knownScripts.has(scriptName)) fail(`Instruction references missing npm script: ${scriptName}`);
}
pass(`${referencedScripts.size} referenced npm scripts checked`);

const ciWorkflow = readText(path.join(ROOT, ".github", "workflows", "ci.yml"));
if (!ciWorkflow.includes("npm run agents:validate")) fail("CI does not run agents:validate");

const releaseSkill = path.join(SKILLS_ROOT, "release", "SKILL.md");
if (!fs.existsSync(releaseSkill) || !readText(releaseSkill).includes("npm run agents:validate")) {
  fail("release skill does not run agents:validate");
}

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
if (errors > 0) {
  console.error(`❌ FAIL — ${errors} error(s), ${warnings} warning(s)`);
  process.exit(1);
}

if (warnings > 0) {
  warn(`PASS WITH WARNINGS — ${warnings} warning(s)`);
} else {
  console.log(`✅ ALL PASS — ${skillDirectories.length} skills, ${ruleFiles.length} rules validated, 0 warnings`);
}
