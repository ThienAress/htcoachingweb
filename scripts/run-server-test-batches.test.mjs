import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  assertRuntimeVersion,
  chunkItems,
  formatVitestFailures,
  resolveServerTestConfigLoader,
  resolveServerTestReportDirectory,
  sanitizeVitestDiagnostic,
  summarizeVitestReport,
} from "./run-server-test-batches.mjs";

const syntheticJwt = [
  "eyJhbGciOiJIUzI1NiJ9",
  "eyJzdWIiOiIxMjMifQ",
  "signature",
].join(".");

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

test("formatVitestFailures emits bounded repo-relative test identities", () => {
  const serverRoot = path.join(process.cwd(), "server");
  const report = {
    testResults: [
      {
        name: path.join(serverRoot, "src", "controllers", "__tests__", "deposit.test.js"),
        status: "failed",
        assertionResults: [
          {
            status: "failed",
            fullName: "deposit rejects missing config\nwithout leaking raw output",
          },
          { status: "passed", fullName: "deposit succeeds" },
        ],
      },
      {
        name: path.join(serverRoot, "src", "utils", "__tests__", "logger.test.js"),
        status: "failed",
        assertionResults: [],
      },
    ],
  };

  assert.deepEqual(formatVitestFailures(report, { serverRoot, limit: 2 }), [
    "src/controllers/__tests__/deposit.test.js :: deposit rejects missing config without leaking raw output",
    "src/utils/__tests__/logger.test.js :: suite failed before assertions",
  ]);
});

test("formatVitestFailures includes only sanitized first-line diagnostics", () => {
  const serverRoot = path.join(process.cwd(), "server");
  const report = {
    testResults: [
      {
        name: path.join(serverRoot, "src", "controllers", "__tests__", "deposit.test.js"),
        status: "failed",
        assertionResults: [
          {
            status: "failed",
            fullName: "deposit rejects invalid callback",
            failureMessages: [
              "AssertionError: expected \"customer@example.com\" to equal '0901234567' https://example.com/callback?token=secret\n    at C:\\workspace\\server\\deposit.test.js:42:7",
            ],
          },
        ],
      },
      {
        name: path.join(serverRoot, "src", "utils", "__tests__", "logger.test.js"),
        status: "failed",
        assertionResults: [],
        message: `Error: ${["Bearer", syntheticJwt].join(" ")} at /home/runner/work/private/server/logger.test.js:9:3\nmore details`,
      },
    ],
  };

  assert.deepEqual(formatVitestFailures(report, { serverRoot, limit: 2 }), [
    "src/controllers/__tests__/deposit.test.js :: deposit rejects invalid callback :: AssertionError: expected [redacted] to equal [redacted] [url]",
    "src/utils/__tests__/logger.test.js :: suite failed before assertions :: Error: Bearer [redacted] at [path]",
  ]);
});

test("formatVitestFailures bounds sanitized records after adding diagnostics", () => {
  const serverRoot = path.join(process.cwd(), "server");
  const report = {
    testResults: Array.from({ length: 6 }, (_, index) => ({
      name: path.join(serverRoot, "src", "__tests__", `failure-${index}.test.js`),
      status: "failed",
      assertionResults: [],
      message: `Error: ${"x".repeat(250)} secret@example.com`,
    })),
  };

  const failures = formatVitestFailures(report, { serverRoot });
  assert.equal(failures.length, 5);
  assert.equal(failures.every((failure) => failure.length <= 180), true);
  assert.equal(failures.some((failure) => failure.includes("secret@example.com")), false);
});

test("sanitizeVitestDiagnostic redacts common secret and PII shapes", () => {
  assert.equal(
    sanitizeVitestDiagnostic(
      `Error: customer@example.com called +84 901 234 567 with ${syntheticJwt} at /home/runner/private.test.js:2:1?token=secret`,
    ),
    "Error: [redacted] called [redacted] with [redacted] at [path]?[redacted]",
  );
});
