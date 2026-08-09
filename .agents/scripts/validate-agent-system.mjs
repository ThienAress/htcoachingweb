#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "../..");
const AGENTS_ROOT = path.join(ROOT, ".agents");
const SKILLS_ROOT = path.join(AGENTS_ROOT, "skills");
const RULES_ROOT = path.join(AGENTS_ROOT, "rules");

let errors = 0;
let warnings = 0;

const relative = (filePath) => path.relative(ROOT, filePath).replaceAll("\\", "/");
const readText = (filePath) => fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");

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

console.log("\n🔍 Agent Instruction Validation");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

const requiredPaths = [
  "AGENTS.md",
  ".agents/reference/project-guide.md",
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

for (const directory of skillDirectories) {
  const skillPath = path.join(SKILLS_ROOT, directory.name, "SKILL.md");
  if (!fs.existsSync(skillPath)) {
    fail(`${directory.name}: missing SKILL.md`);
    continue;
  }

  const content = readText(skillPath);
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
