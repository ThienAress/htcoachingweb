#!/usr/bin/env node
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  attachUiAuditBaseline,
  createUiAuditBaseline,
  parseUiAuditArgs,
  readUiAuditBaseline,
  renderUiAuditReport,
  runUiAudit,
  writeUiAuditBaseline,
} from "./index.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

try {
  const options = parseUiAuditArgs(process.argv.slice(2));
  let report = await runUiAudit({
    rootDir: repoRoot,
    target: options.target,
    category: options.category,
  });
  if (options.writeBaseline) {
    const baseline = createUiAuditBaseline(report);
    await writeUiAuditBaseline({
      rootDir: repoRoot,
      baselinePath: options.writeBaseline,
      baseline,
    });
    process.stderr.write(
      `UI audit baseline updated: ${options.writeBaseline} (${baseline.findings.length} findings)\n`,
    );
  } else if (options.baseline) {
    const baseline = await readUiAuditBaseline({
      rootDir: repoRoot,
      baselinePath: options.baseline,
    });
    report = attachUiAuditBaseline(report, baseline, options.baseline);
  }
  process.stdout.write(renderUiAuditReport(report, options.format));
  if (options.failOnNewHigh && report.regression?.shouldFail) {
    process.exitCode = 1;
  }
} catch (error) {
  process.stderr.write(`ui-audit: ${error.message}\n`);
  process.exitCode = 1;
}
