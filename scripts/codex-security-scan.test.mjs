import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_MAX_COST,
  MAX_ALLOWED_COST,
  buildCodexSecurityInvocation,
} from "./codex-security-scan.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const build = (args) => buildCodexSecurityInvocation(args, { repoRoot });

test("defaults to a dry-run working-tree scan with a low budget", () => {
  const result = build([]);
  assert.deepEqual(result.summary, {
    mode: "working-tree",
    target: ".",
    maxCostUsd: DEFAULT_MAX_COST,
    dryRun: true,
  });
  assert.deepEqual(result.args.slice(0, 7), [
    "@openai/codex-security",
    "scan",
    ".",
    "--working-tree",
    "--base",
    "HEAD",
    "--max-cost",
  ]);
  assert.equal(result.args.at(-1), "--dry-run");
});

test("execute removes dry-run but preserves the cost guard", () => {
  const result = build(["--working-tree", "--max-cost", "1.5", "--execute"]);
  assert.equal(result.summary.dryRun, false);
  assert.equal(result.summary.maxCostUsd, 1.5);
  assert.equal(result.args.includes("--dry-run"), false);
  assert.deepEqual(result.args.slice(-2), ["--max-cost", "1.5"]);
});

test("builds a bounded diff scan", () => {
  const result = build(["--diff", "origin/main"]);
  assert.equal(result.summary.mode, "diff");
  assert.deepEqual(result.args.slice(3, 7), [
    "--diff",
    "origin/main",
    "--head",
    "HEAD",
  ]);
});

test("accepts only an existing repository-relative directory target", () => {
  const result = build(["--path", "server/src/routes"]);
  assert.equal(result.summary.mode, "path");
  assert.equal(result.summary.target, "server/src/routes");
  assert.throws(() => build(["--path", "../outside"]), /does not exist|inside/);
  assert.throws(
    () => build(["--path", "server/package.json"]),
    /must target a directory/,
  );
});

test("full and deep scans require an explicit acknowledgement", () => {
  assert.throws(() => build(["--full"]), /requires --ack-full-scan/);
  assert.throws(() => build(["--deep"]), /requires --ack-full-scan/);

  const full = build(["--full", "--ack-full-scan"]);
  assert.equal(full.summary.mode, "full");
  assert.equal(full.args.includes("--mode"), false);

  const deep = build(["--deep", "--ack-full-scan"]);
  assert.equal(deep.summary.mode, "deep");
  assert.deepEqual(deep.args.slice(3, 5), ["--mode", "deep"]);
});

test("rejects budget, mode and option policy violations", () => {
  assert.throws(
    () => build(["--max-cost", String(MAX_ALLOWED_COST + 0.01)]),
    /policy ceiling/,
  );
  assert.throws(
    () => build(["--diff", "origin/main", "--full"]),
    /exactly one/,
  );
  assert.throws(
    () => build(["--execute", "--dry-run"]),
    /cannot be combined/,
  );
  assert.throws(
    () => build(["--diff", "origin/main & whoami"]),
    /unsupported characters/,
  );
  assert.throws(() => build(["--unknown"]), /Unknown option/);
});
