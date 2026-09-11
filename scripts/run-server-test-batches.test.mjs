import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  assertRuntimeVersion,
  chunkItems,
  resolveServerTestConfigLoader,
  resolveServerTestReportDirectory,
  summarizeVitestReport,
} from "./run-server-test-batches.mjs";

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

test("server test runtime accepts only an absolute report directory", () => {
  const serverRoot = path.join(process.cwd(), "server");
  const reportDirectory = path.join(path.parse(process.cwd()).root, "tmp", "server-test-reports");

  assert.equal(
    resolveServerTestReportDirectory(serverRoot, reportDirectory),
    path.normalize(reportDirectory),
  );
  assert.throws(
    () => resolveServerTestReportDirectory(serverRoot, "relative/reports"),
    /absolute path/,
  );
});

test("server test runtime allows only the read-only-safe config loader override", () => {
  assert.equal(resolveServerTestConfigLoader(undefined), null);
  assert.equal(resolveServerTestConfigLoader("runner"), "runner");
  assert.throws(() => resolveServerTestConfigLoader("bundle"), /config loader/);
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
