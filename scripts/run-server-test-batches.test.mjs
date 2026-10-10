import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  assertRuntimeVersion,
  chunkItems,
  summarizeVitestReport,
} from "./run-server-test-batches.mjs";

const createCliFixture = (mode) => {
  const root = mkdtempSync(path.join(os.tmpdir(), "server-batches-"));
  const fixtureServer = path.join(root, "server");
  const fixtureVitest = path.join(fixtureServer, "node_modules", "vitest");
  mkdirSync(path.join(fixtureServer, "src", "feature", "__tests__"), { recursive: true });
  mkdirSync(fixtureVitest, { recursive: true });
  mkdirSync(path.join(root, "scripts"), { recursive: true });
  writeFileSync(path.join(root, ".node-version"), `${process.versions.node}\n`);
  writeFileSync(path.join(fixtureServer, "src", "feature", "__tests__", "fixture.test.js"), "// fixture\n");
  cpSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "run-server-test-batches.mjs"), path.join(root, "scripts", "run-server-test-batches.mjs"));
  writeFileSync(
    path.join(fixtureVitest, "vitest.mjs"),
    `import { writeFileSync } from "node:fs";
const output = process.argv.find((argument) => argument.startsWith("--outputFile="))?.slice("--outputFile=".length);
if (process.env.FIXTURE_MODE === "corrupt") writeFileSync(output, "fixture-report-content-must-stay-private");
else if (process.env.FIXTURE_MODE !== "missing") writeFileSync(output, JSON.stringify({ success: process.env.FIXTURE_MODE === "success", numTotalTests: 1, numFailedTests: process.env.FIXTURE_MODE === "success" ? 0 : 1, testResults: [{}] }));
process.exitCode = process.env.FIXTURE_MODE === "success" ? 0 : 1;
`,
  );
  return { root, mode };
};

const runCliFixture = ({ root, mode }) => {
  try {
    return {
      status: 0,
      output: execFileSync(process.execPath, [path.join(root, "scripts", "run-server-test-batches.mjs")], {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, FIXTURE_MODE: mode },
        stdio: ["ignore", "pipe", "pipe"],
      }),
    };
  } catch (error) {
    return { status: error.status, output: `${error.stdout}${error.stderr}` };
  }
};

test("CLI retains failed or corrupt reports, cleans successful reports, and fails without a report", (t) => {
  for (const [mode, expectedStatus, expectedReports] of [
    ["failed", 1, 1],
    ["corrupt", 1, 1],
    ["success", 0, 0],
    ["missing", 1, 0],
  ]) {
    const fixture = createCliFixture(mode);
    t.after(() => rmSync(fixture.root, { recursive: true, force: true }));
    const result = runCliFixture(fixture);
    const reportRoot = path.join(fixture.root, "server", ".local-data");
    const reports = existsSync(reportRoot) ? readdirSync(reportRoot).filter((file) => file.endsWith(".json")) : [];
    assert.equal(result.status, expectedStatus, `${mode} exit status`);
    assert.equal(reports.length, expectedReports, `${mode} retained report count`);
    if (expectedReports > 0) {
      assert.match(result.output, /Vitest batch 1 report retained: server\/.local-data\/vitest-batch-\d+-1\.json/);
      assert.doesNotMatch(result.output, /numFailedTests|testResults/);
      assert.doesNotMatch(result.output, /fixture-report-content/);
    }
  }
});

test("assertRuntimeVersion rejects a runtime that drifts from the repository pin", () => {
  assert.throws(
    () => assertRuntimeVersion("24.15.0", "22.23.1"),
    /requires Node 22\.23\.1; current runtime is 24\.15\.0/,
  );
});

test("assertRuntimeVersion accepts the repository-pinned runtime", () => {
  assert.doesNotThrow(() => assertRuntimeVersion("22.23.1", "22.23.1"));
});

test("chunkItems partitions every file once and preserves order", () => {
  assert.deepEqual(chunkItems(["a", "b", "c", "d", "e"], 2), [
    ["a", "b"],
    ["c", "d"],
    ["e"],
  ]);
});

test("chunkItems rejects an unsafe batch size", () => {
  assert.throws(() => chunkItems(["a"], 0), /positive safe integer/);
});

test("summarizeVitestReport fails closed on incomplete or failed reports", () => {
  assert.deepEqual(
    summarizeVitestReport({
      success: true,
      numTotalTests: 4,
      numFailedTests: 1,
      testResults: [{}, {}],
    }),
    { files: 2, tests: 4, failedTests: 1, success: false },
  );
  assert.equal(summarizeVitestReport({ success: true }).success, false);
});
