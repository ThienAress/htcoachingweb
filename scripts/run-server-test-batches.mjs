import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverRoot = path.join(repositoryRoot, "server");
const testRoot = path.join(serverRoot, "src");
const vitestEntry = path.join(serverRoot, "node_modules", "vitest", "vitest.mjs");
const batchSize = 32;
const requiredNodeVersion = readFileSync(path.join(repositoryRoot, ".node-version"), "utf8").trim();

export const assertRuntimeVersion = (actualVersion, expectedVersion) => {
  if (actualVersion !== expectedVersion) {
    throw new Error(
      `Server unit test runner requires Node ${expectedVersion}; current runtime is ${actualVersion}`,
    );
  }
};

export const chunkItems = (items, size) => {
  if (!Number.isSafeInteger(size) || size <= 0) {
    throw new Error("Batch size must be a positive safe integer");
  }

  const batches = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
};

export const resolveServerTestReportDirectory = (root, configuredDirectory) => {
  if (!configuredDirectory) return path.join(root, ".local-data");
  if (!path.isAbsolute(configuredDirectory)) {
    throw new Error("Server test report directory must be an absolute path");
  }
  return path.normalize(configuredDirectory);
};

export const resolveServerTestConfigLoader = (configuredLoader) => {
  if (!configuredLoader) return null;
  if (configuredLoader !== "runner") {
    throw new Error("Server test config loader must be runner");
  }
  return configuredLoader;
};

const collectTestFiles = (directory) => readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectTestFiles(absolutePath);
    if (!entry.isFile() || !entry.name.endsWith(".test.js")) return [];
    if (!absolutePath.includes(`${path.sep}__tests__${path.sep}`)) return [];
    return [path.relative(serverRoot, absolutePath).split(path.sep).join("/")];
  });

export const summarizeVitestReport = (report) => {
  const files = Array.isArray(report?.testResults) ? report.testResults.length : 0;
  const tests = Number.isSafeInteger(report?.numTotalTests) ? report.numTotalTests : 0;
  const failedTests = Number.isSafeInteger(report?.numFailedTests) ? report.numFailedTests : 0;
  const success = report?.success === true && files > 0 && tests > 0 && failedTests === 0;
  return { files, tests, failedTests, success };
};

const boundedIdentity = (value, fallback) => {
  const normalized = String(value || fallback)
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (normalized || fallback).slice(0, 180);
};

const firstNonEmptyLine = (value) => String(value || "")
  .split(/\r?\n/)
  .map((line) => line.trim())
  .find(Boolean) || "";

export const sanitizeVitestDiagnostic = (value) => firstNonEmptyLine(value)
  .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "")
  .replace(/\bBearer\s+\S+/gi, "Bearer [redacted]")
  .replace(/\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[redacted]")
  .replace(/\bhttps?:\/\/[^\s]+/gi, "[url]")
  .replace(/(?:[A-Za-z]:\\|\\\\)[^\s"'`]+/g, "[path]")
  .replace(/(^|[\s(])\/(?:[^/\s]+\/)+[^:\s),]+(?::\d+(?::\d+)?)?/g, "$1[path]")
  .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted]")
  .replace(/(?<!\w)(?:\+?\d[\d .()-]{7,}\d)(?!\w)/g, "[redacted]")
  .replace(/\?[A-Za-z0-9_.~-]+=[^\s#]+/g, "?[redacted]")
  .replace(/(["'`])(?:\\.|(?!\1)[^\\\r\n])*\1/g, "[redacted]")
  .replace(/\s+/g, " ")
  .trim();

const withDiagnostic = (identity, rawDiagnostic) => {
  const diagnostic = sanitizeVitestDiagnostic(rawDiagnostic);
  return boundedIdentity(diagnostic ? `${identity} :: ${diagnostic}` : identity, identity);
};

export const formatVitestFailures = (report, options = {}) => {
  const reportServerRoot = options.serverRoot || serverRoot;
  const limit = options.limit ?? 5;
  if (!Number.isSafeInteger(limit) || limit <= 0 || limit > 10) {
    throw new Error("Vitest failure detail limit must be between 1 and 10");
  }

  const failures = [];
  for (const result of Array.isArray(report?.testResults) ? report.testResults : []) {
    const absoluteName = String(result?.name || "");
    const relativeName = absoluteName ? path.relative(reportServerRoot, absoluteName) : "";
    const isInsideServer = relativeName
      && relativeName !== ".."
      && !relativeName.startsWith(`..${path.sep}`)
      && !path.isAbsolute(relativeName);
    const fileName = boundedIdentity(
      isInsideServer ? relativeName.split(path.sep).join("/") : path.basename(absoluteName),
      "unknown test file",
    );
    const failedAssertions = Array.isArray(result?.assertionResults)
      ? result.assertionResults.filter((assertion) => assertion?.status === "failed")
      : [];

    if (failedAssertions.length === 0 && result?.status === "failed") {
      const identity = `${fileName} :: suite failed before assertions`;
      failures.push(withDiagnostic(identity, result?.message));
    } else {
      for (const assertion of failedAssertions) {
        const identity = `${fileName} :: ${boundedIdentity(
          assertion?.fullName || assertion?.title,
          "unnamed test",
        )}`;
        failures.push(withDiagnostic(identity, assertion?.failureMessages?.[0]));
      }
    }

    if (failures.length >= limit) break;
  }
  return failures.slice(0, limit);
};

const run = () => {
  assertRuntimeVersion(process.versions.node, requiredNodeVersion);

  const reportDirectory = resolveServerTestReportDirectory(
    serverRoot,
    process.env.SERVER_TEST_REPORT_DIRECTORY,
  );
  const configLoader = resolveServerTestConfigLoader(
    process.env.SERVER_TEST_CONFIG_LOADER,
  );

  if (!existsSync(vitestEntry)) {
    throw new Error("Vitest entrypoint is missing; install server dependencies first");
  }

  const testFiles = collectTestFiles(testRoot).sort((left, right) => left.localeCompare(right));
  const batches = chunkItems(testFiles, batchSize);
  if (batches.length === 0) throw new Error("No server unit tests were discovered");

  mkdirSync(reportDirectory, { recursive: true });
  const totals = { files: 0, tests: 0 };

  for (const [index, batch] of batches.entries()) {
    const reportPath = path.join(reportDirectory, `vitest-batch-${process.pid}-${index + 1}.json`);
    process.stdout.write(`Server unit batch ${index + 1}/${batches.length}: ${batch.length} files\n`);

    try {
      const result = spawnSync(
        process.execPath,
        [
          vitestEntry,
          "run",
          ...(configLoader ? ["--configLoader", configLoader] : []),
          "--reporter=json",
          `--outputFile=${reportPath}`,
          ...batch,
        ],
        {
          cwd: serverRoot,
          env: process.env,
          stdio: "inherit",
          windowsHide: true,
        },
      );

      if (result.error) throw result.error;
      if (!existsSync(reportPath)) {
        throw new Error(`Vitest batch ${index + 1} did not produce a report`);
      }

      const report = JSON.parse(readFileSync(reportPath, "utf8"));
      const summary = summarizeVitestReport(report);
      if (result.status !== 0 || !summary.success) {
        const failureIdentities = formatVitestFailures(report);
        if (failureIdentities.length > 0) {
          process.stderr.write(
            `Vitest batch ${index + 1} failure identities (bounded):\n${failureIdentities.map((identity) => `- ${identity}`).join("\n")}\n`,
          );
        }
        throw new Error(
          `Vitest batch ${index + 1} failed (exit=${result.status ?? "signal"}, failedTests=${summary.failedTests})`,
        );
      }

      totals.files += summary.files;
      totals.tests += summary.tests;
      process.stdout.write(
        `Server unit batch ${index + 1}/${batches.length}: PASS (${summary.files} files / ${summary.tests} tests)\n`,
      );
    } finally {
      rmSync(reportPath, { force: true });
    }
  }

  if (totals.files !== testFiles.length) {
    throw new Error(`Server test coverage mismatch: discovered=${testFiles.length}, reported=${totals.files}`);
  }

  process.stdout.write(`Server unit tests: PASS (${totals.files} files / ${totals.tests} tests)\n`);
};

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    run();
  } catch (error) {
    process.stderr.write(`Server unit test runner failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
