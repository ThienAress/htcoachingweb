import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  checkProjectInventory,
  collectProjectInventory,
  serializeProjectInventory,
} from "./project-inventory.mjs";

function writeFixture(root, relativePath, content = "") {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
}

function initializeGitIndex(root, paths = ["."]) {
  const init = spawnSync("git", ["init", "--quiet"], { cwd: root });
  assert.equal(init.status, 0);
  const add = spawnSync("git", ["add", "--", ...paths], { cwd: root });
  assert.equal(add.status, 0);
}

test("collectProjectInventory counts repository surfaces from files", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ht-inventory-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));

  writeFixture(root, ".agents/skills/qa/SKILL.md");
  writeFixture(root, ".agents/skills/audit/SKILL.md");
  writeFixture(
    root,
    ".agents/evals/skills/qa.json",
    JSON.stringify({ cases: [{}, {}, {}, {}] }),
  );
  writeFixture(root, "client/src/a.test.js");
  writeFixture(root, "client/src/b.spec.jsx");
  writeFixture(root, "server/src/a.test.js");
  writeFixture(root, "e2e/home.spec.js");
  writeFixture(root, "server/src/models/User.js");
  writeFixture(root, "server/src/controllers/user.controller.js");
  writeFixture(root, "server/src/routes/user.routes.js");
  writeFixture(root, "client/src/scratch.test.js");
  writeFixture(root, "server/src/models/Scratch.js");
  initializeGitIndex(root, [
    "client/src/a.test.js",
    "client/src/b.spec.jsx",
    "server/src/a.test.js",
    "e2e/home.spec.js",
    "server/src/models/User.js",
    "server/src/controllers/user.controller.js",
    "server/src/routes/user.routes.js",
  ]);

  assert.deepEqual(collectProjectInventory(root), {
    schemaVersion: 1,
    basis: {
      agentGovernance: "working_tree_candidates",
      productSurfaces: "git_index",
    },
    skills: 2,
    evalCorpora: 1,
    evalScenarios: 4,
    testFiles: { client: 2, server: 1, e2e: 1 },
    serverModules: { models: 1, controllers: 1, routes: 1 },
  });
});

test("serializeProjectInventory is stable and newline terminated", () => {
  const inventory = {
    schemaVersion: 1,
    basis: {
      agentGovernance: "working_tree_candidates",
      productSurfaces: "git_index",
    },
    skills: 2,
    evalCorpora: 1,
    evalScenarios: 4,
    testFiles: { client: 2, server: 1, e2e: 1 },
    serverModules: { models: 1, controllers: 1, routes: 1 },
  };

  const first = serializeProjectInventory(inventory);
  const second = serializeProjectInventory(structuredClone(inventory));
  assert.equal(first, second);
  assert.ok(first.endsWith("\n"));
});

test("checkProjectInventory accepts Git CRLF conversion", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ht-inventory-eol-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const inventoryPath = path.join(root, "project-inventory.json");
  initializeGitIndex(root, []);
  const expected = collectProjectInventory(root);
  fs.writeFileSync(
    inventoryPath,
    serializeProjectInventory(expected).replaceAll("\n", "\r\n"),
    "utf8",
  );

  assert.deepEqual(checkProjectInventory({ rootDir: root, inventoryPath }), expected);
});
