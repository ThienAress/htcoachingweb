import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverRoot = path.join(repositoryRoot, "server");
const testRoot = path.join(serverRoot, "src");
const reportDirectory = path.join(serverRoot, ".local-data");
const vitestEntry = path.join(serverRoot, "node_modules", "vitest", "vitest.mjs");
const batchSize = 32;

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

const run = () => {
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
        [vitestEntry, "run", "--reporter=json", `--outputFile=${reportPath}`, ...batch],
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

      const summary = summarizeVitestReport(JSON.parse(readFileSync(reportPath, "utf8")));
      if (result.status !== 0 || !summary.success) {
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
