import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { evaluate } from "./guard.mjs";

const decision = (tool, input) => evaluate(tool, input)?.decision ?? "allow";

test("blocks reading real env and private files", () => {
  for (const file of [".env", "server/.env", "server\\.env.development", "client/.env.production", ".env-backup/a.txt", "server/.private/key.pem"]) {
    assert.equal(decision("Read", { file_path: file }), "deny", file);
  }
  assert.equal(decision("Edit", { file_path: "server/.env.staging" }), "deny");
  assert.equal(decision("Grep", { pattern: "x", path: ".env-backup" }), "deny");
});

test("allows env examples and ordinary files", () => {
  for (const file of ["server/.env.production.example", "client/.env.example", "server/src/config/db.js", "docs/env-notes.md"]) {
    assert.equal(decision("Read", { file_path: file }), "allow", file);
  }
});

test("blocks shell commands that print secrets", () => {
  for (const command of ["cat server/.env", "type .env.local", "Get-Content client\\.env.production", "printenv", "env | sort", "Get-ChildItem env:", "ls .private"]) {
    assert.equal(decision("Bash", { command }), "deny", command);
  }
  assert.equal(decision("PowerShell", { command: "gci env:" }), "deny");
});

test("does not flag code that mentions process.env or dotenv", () => {
  for (const command of ["node -e \"console.log(process.env.NODE_ENV)\"", "npm run test:unit:server", "rg dotenv server/src", "cat server/.env.production.example", "git status", "git diff --stat"]) {
    assert.equal(decision("Bash", { command }), "allow", command);
  }
});

test("asks before git writes", () => {
  for (const command of ["git commit -m x", "git push origin main", "cd repo && git reset --hard", "git checkout main", "git -C repo rebase main", "git stash pop"]) {
    assert.equal(decision("Bash", { command }), "ask", command);
  }
});

test("asks before real-data scripts", () => {
  for (const command of [
    "npm run migrate:phase1 --prefix server",
    "npm run seed:staging --prefix server",
    "node src/scripts/publicTestCatalogSync.js --target=staging --apply",
    "NODE_ENV=production node server.js",
    "npm.cmd run sync:account:staging",
  ]) {
    assert.equal(decision("Bash", { command }), "ask", command);
  }
  assert.equal(decision("Bash", { command: "npm run preflight:account-sync:local --prefix server" }), "allow");
});

test("CLI emits PreToolUse decision JSON", () => {
  const script = fileURLToPath(new URL("./guard.mjs", import.meta.url));
  const denied = spawnSync(process.execPath, [script], {
    input: JSON.stringify({ tool_name: "Read", tool_input: { file_path: ".env" } }),
    encoding: "utf8",
  });
  assert.equal(denied.status, 0);
  assert.equal(JSON.parse(denied.stdout).hookSpecificOutput.permissionDecision, "deny");

  const allowed = spawnSync(process.execPath, [script], {
    input: JSON.stringify({ tool_name: "Read", tool_input: { file_path: "README.md" } }),
    encoding: "utf8",
  });
  assert.equal(allowed.status, 0);
  assert.equal(allowed.stdout, "");
});
