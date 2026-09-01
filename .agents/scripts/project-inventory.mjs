#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const DEFAULT_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../..");

function listGitIndexPaths(rootDir) {
  const result = spawnSync("git", ["ls-files", "--cached", "-z"], {
    cwd: rootDir,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0 || result.error) {
    throw new Error("Unable to enumerate the Git index for project inventory");
  }
  return result.stdout.split("\0").filter(Boolean).sort();
}

function collectEvalInventory(rootDir) {
  const evalRoot = path.join(rootDir, ".agents", "evals", "skills");
  const files = fs.existsSync(evalRoot)
    ? fs
        .readdirSync(evalRoot, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map((entry) => path.join(evalRoot, entry.name))
        .sort()
    : [];
  let scenarios = 0;
  for (const filePath of files) {
    const corpus = JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
    scenarios += Array.isArray(corpus.cases) ? corpus.cases.length : 0;
  }
  return { corpora: files.length, scenarios };
}

export function collectProjectInventory(rootDir = DEFAULT_ROOT) {
  const skillsRoot = path.join(rootDir, ".agents", "skills");
  const skills = fs.existsSync(skillsRoot)
    ? fs
        .readdirSync(skillsRoot, { withFileTypes: true })
        .filter(
          (entry) =>
            entry.isDirectory() &&
            fs.existsSync(path.join(skillsRoot, entry.name, "SKILL.md")),
        ).length
    : 0;
  const evalInventory = collectEvalInventory(rootDir);
  const indexedPaths = listGitIndexPaths(rootDir);
  const countIndexed = (pattern) => indexedPaths.filter((filePath) => pattern.test(filePath)).length;

  return {
    schemaVersion: 1,
    basis: {
      agentGovernance: "working_tree_candidates",
      productSurfaces: "git_index",
    },
    skills,
    evalCorpora: evalInventory.corpora,
    evalScenarios: evalInventory.scenarios,
    testFiles: {
      client: countIndexed(/^client\/src\/.*\.(?:test|spec)\.(?:js|jsx|ts|tsx)$/),
      server: countIndexed(/^server\/src\/.*\.(?:test|spec)\.(?:js|jsx|ts|tsx)$/),
      e2e: countIndexed(/^e2e\/.*\.(?:test|spec)\.(?:js|jsx|ts|tsx)$/),
    },
    serverModules: {
      models: countIndexed(/^server\/src\/models\/[^/]+\.js$/),
      controllers: countIndexed(/^server\/src\/controllers\/[^/]+\.js$/),
      routes: countIndexed(/^server\/src\/routes\/[^/]+\.js$/),
    },
  };
}

export function serializeProjectInventory(inventory) {
  return `${JSON.stringify(inventory, null, 2)}\n`;
}

export function checkProjectInventory({
  rootDir = DEFAULT_ROOT,
  inventoryPath = path.join(rootDir, ".agents", "reference", "project-inventory.json"),
} = {}) {
  const expected = serializeProjectInventory(collectProjectInventory(rootDir));
  if (!fs.existsSync(inventoryPath)) {
    throw new Error(`Generated inventory is missing: ${path.relative(rootDir, inventoryPath)}`);
  }
  const actual = fs
    .readFileSync(inventoryPath, "utf8")
    .replace(/^\uFEFF/, "")
    .replaceAll("\r\n", "\n");
  if (actual !== expected) {
    throw new Error("Generated project inventory is stale; run npm run agents:inventory");
  }
  return JSON.parse(actual);
}

function runCli() {
  const mode = process.argv[2] || "--print";
  const inventoryPath = path.join(
    DEFAULT_ROOT,
    ".agents",
    "reference",
    "project-inventory.json",
  );
  if (mode === "--write") {
    fs.writeFileSync(
      inventoryPath,
      serializeProjectInventory(collectProjectInventory(DEFAULT_ROOT)),
      "utf8",
    );
    process.stdout.write("Project inventory updated.\n");
    return;
  }
  if (mode === "--check") {
    checkProjectInventory({ rootDir: DEFAULT_ROOT, inventoryPath });
    process.stdout.write("Project inventory is current.\n");
    return;
  }
  if (mode !== "--print") throw new Error(`Unknown mode: ${mode}`);
  process.stdout.write(serializeProjectInventory(collectProjectInventory(DEFAULT_ROOT)));
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  try {
    runCli();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
